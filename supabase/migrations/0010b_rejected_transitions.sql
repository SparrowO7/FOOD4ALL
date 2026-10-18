-- ============================================================================
-- Food4All — 0010b_rejected_transitions.sql
--
-- Run AFTER 0010a_rejected_enum.sql has committed.
--
-- Three things, which cannot sensibly be separated:
--   1. failure_reason — a closed list, so failures are countable
--   2. the 'rejected' edges in is_valid_transition()
--   3. transition_donation() gains p_reason, and enforces it
--
-- On (1): donation_events.note has been free text since 0001_schema.sql:121.
-- Free text cannot produce the sentence the pilot needs — "42% of failed
-- rescues happened because no volunteer was available after 21:00" — because
-- every operator phrases it differently. A closed enum with 'other' + a
-- mandatory note keeps the escape hatch while making the common cases
-- countable. Promote recurring 'other' notes into the enum after Phase 5.
--
-- On (3): adding a parameter via CREATE OR REPLACE does NOT replace a function
-- in PostgreSQL — it creates an overload. Two transition_donation functions
-- would make PostgREST's resolution ambiguous, so the old four-argument form is
-- dropped first. Check afterwards with:
--     select proname, pronargs from pg_proc where proname = 'transition_donation';
-- Exactly one row is expected.
--
-- One hardening change rides along, because this file rewrites the function
-- anyway: the SECURITY DEFINER search_path goes from `public` to
-- `public, pg_temp`. PostgreSQL searches pg_temp FIRST by default and any role
-- can create objects there, so omitting it from an explicit search_path on a
-- SECURITY DEFINER function leaves a shadowing hole. The other SECURITY
-- DEFINER functions in 0001/0005/0007 still say `search_path = public` and
-- should get the same one-word fix in their own migration — not silently here.
-- ============================================================================

-- ---------- the closed failure list -----------------------------------------

do $$
begin
  if not exists (select 1 from pg_type where typname = 'failure_reason') then
    create type failure_reason as enum (
      'no_volunteer',             -- nobody available in the window
      'ngo_capacity_full',        -- NGO at its daily capacity
      'donor_cancelled',          -- donor withdrew
      'pickup_too_far',           -- beyond the service radius
      'insufficient_time',        -- not enough time before best_before
      'food_unsafe',              -- refused on inspection — Schedule-I 2(4)
      'food_below_minimum',       -- under the agreed minimum servings
      'donor_unreachable',        -- no contact at pickup
      'ngo_unreachable',          -- no contact at handover
      'outside_operating_hours',  -- outside the NGO's hours
      'other'                     -- requires reason_note
    );
  end if;
end $$;

alter table public.donation_events
  add column if not exists reason failure_reason;

comment on column public.donation_events.reason is
  'Structured reason, recorded at the moment a human ends a donation (cancelled / rejected / manually expired). Immutable, like the rest of this table. The free-text elaboration goes in the existing note column. NULL for ordinary forward transitions and for the system expiry sweeper, which cannot know why nobody collected the food — see 0011 for that case.';

-- ---------- allowed edges, with rejection -----------------------------------
--
-- Schedule-I 2(4) contemplates food found unfit at any point after it leaves
-- the donor, so rejection is reachable from the three states where the food is
-- in transit or has just arrived. It is terminal: nothing leaves 'rejected'.
-- Food refused on safety grounds must not be re-offered by changing its status.

create or replace function public.is_valid_transition(p_from donation_status, p_to donation_status)
returns boolean language sql immutable as $$
  select case p_from
    when 'draft'            then p_to in ('available', 'cancelled')
    when 'available'        then p_to in ('claimed', 'cancelled', 'expired')
    when 'claimed'          then p_to in ('pickup_scheduled', 'available', 'expired', 'cancelled')
    when 'pickup_scheduled' then p_to in ('picked_up', 'cancelled', 'rejected')
    when 'picked_up'        then p_to in ('delivered', 'rejected')
    when 'delivered'        then p_to in ('completed', 'rejected')
    else false
  end;
$$;

-- ---------- the guarded entry point, now carrying a reason ------------------

drop function if exists public.transition_donation(uuid, donation_status, text, uuid);

create or replace function public.transition_donation(
  p_id        uuid,
  p_to        donation_status,
  p_note      text default null,
  p_volunteer uuid default null,
  p_reason    failure_reason default null
)
returns public.donations
language plpgsql
security definer set search_path = public, pg_temp
as $$
declare
  d      public.donations;
  v_uid  uuid      := auth.uid();
  v_role user_role := public.app_role(auth.uid());
  v_from donation_status;
begin
  if v_uid is null then
    raise exception 'Not authenticated' using errcode = '28000';
  end if;

  select * into d from public.donations where id = p_id for update;
  if not found then
    raise exception 'Donation % not found', p_id using errcode = 'no_data_found';
  end if;
  v_from := d.status;

  if not public.is_valid_transition(v_from, p_to) then
    raise exception 'Illegal transition: % -> %', v_from, p_to using errcode = 'check_violation';
  end if;

  -- A donation that ends badly must say why. This is the whole point of the
  -- failure taxonomy: an unexplained 'expired' is not a finding.
  --
  -- Exception: draft -> cancelled. A draft was never published, so no rescue
  -- was ever attempted and there is nothing to explain. Demanding a reason there
  -- would file every discarded draft into the failure statistics and inflate
  -- them with events that never reached an NGO.
  if p_to in ('expired', 'rejected')
     or (p_to = 'cancelled' and v_from <> 'draft') then
    if p_reason is null then
      raise exception 'A reason is required when ending a donation as %', p_to
        using errcode = 'check_violation';
    end if;
  end if;
  if p_reason = 'other' and coalesce(btrim(p_note), '') = '' then
    raise exception 'reason "other" requires a note explaining it'
      using errcode = 'check_violation';
  end if;

  -- role + guard checks and side-effects, per target state
  if p_to = 'available' and v_from = 'draft' then                 -- publish
    if not (d.donor_id = v_uid or v_role = 'admin') then
      raise exception 'Only the donor can publish this donation';
    end if;
    if d.best_before <= now() then
      raise exception 'best_before must be in the future to publish';
    end if;

  elsif p_to = 'available' and v_from = 'claimed' then            -- NGO releases
    if not (d.claimed_by_ngo = v_uid or v_role = 'admin') then
      raise exception 'Only the claiming NGO can release this donation';
    end if;
    d.claimed_by_ngo := null;
    d.assigned_volunteer := null;

  elsif p_to = 'claimed' then
    if not (v_role in ('ngo', 'admin')) then
      raise exception 'Only an NGO can claim a donation';
    end if;
    if d.best_before <= now() then
      raise exception 'Donation is past its freshness window';
    end if;
    d.claimed_by_ngo := v_uid;

  elsif p_to = 'pickup_scheduled' then
    if v_role = 'volunteer' then
      d.assigned_volunteer := v_uid;                              -- self-accept
    elsif v_role in ('ngo', 'admin') then
      if p_volunteer is null then
        raise exception 'p_volunteer is required when an NGO/admin assigns a pickup';
      end if;
      d.assigned_volunteer := p_volunteer;
    else
      raise exception 'Not allowed to schedule a pickup';
    end if;

  elsif p_to = 'picked_up' then
    if not (d.assigned_volunteer = v_uid or v_role = 'admin') then
      raise exception 'Only the assigned volunteer can mark pickup';
    end if;

  elsif p_to = 'delivered' then
    if not (d.assigned_volunteer = v_uid or v_role = 'admin') then
      raise exception 'Only the assigned volunteer can mark delivery';
    end if;

  elsif p_to = 'completed' then
    if not (d.claimed_by_ngo = v_uid or v_role = 'admin') then
      raise exception 'Only the claiming NGO can confirm receipt';
    end if;

  elsif p_to = 'rejected' then
    -- The receiving side refuses the food: the NGO that claimed it, or the
    -- volunteer carrying it. NOT the donor — a donor who no longer wants the
    -- donation collected is cancelling, not rejecting, and conflating the two
    -- would corrupt the failure statistics.
    if not (d.claimed_by_ngo = v_uid or d.assigned_volunteer = v_uid
            or v_role = 'admin') then
      raise exception 'Only the claiming NGO or the assigned volunteer can reject food';
    end if;

  elsif p_to = 'cancelled' then
    if not (d.donor_id = v_uid or d.claimed_by_ngo = v_uid
            or d.assigned_volunteer = v_uid or v_role = 'admin') then
      raise exception 'Not allowed to cancel this donation';
    end if;

  elsif p_to = 'expired' then
    if v_role <> 'admin' then
      raise exception 'Only the system can expire donations';
    end if;
  end if;

  update public.donations
     set status             = p_to,
         claimed_by_ngo     = d.claimed_by_ngo,
         assigned_volunteer = d.assigned_volunteer,
         updated_at         = now()
   where id = p_id
   returning * into d;

  insert into public.donation_events(
    donation_id, from_status, to_status, actor_id, actor_role, note, reason)
  values (p_id, v_from, p_to, v_uid, v_role, p_note, p_reason);

  return d;
end;
$$;

grant execute on function
  public.transition_donation(uuid, donation_status, text, uuid, failure_reason)
  to authenticated;

comment on function public.transition_donation(uuid, donation_status, text, uuid, failure_reason) is
  'The one guarded entry point for donation state changes. Validates the edge, checks the caller''s role, applies side-effects and writes the audit row atomically. Transitions to cancelled/expired/rejected must carry a failure_reason.';
