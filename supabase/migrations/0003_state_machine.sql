-- ============================================================================
-- Food4All — 0003_state_machine.sql
-- The donation lifecycle, enforced in the database.
--   * is_valid_transition()  — the allowed edges of the state machine
--   * enforce_..._transition  — a BEFORE UPDATE trigger (safety net: rejects
--                                illegal edges even if someone bypasses the app)
--   * transition_donation()   — the ONE guarded entry point the app calls (RPC).
--                                Checks role + guards, applies side-effects,
--                                and writes the audit trail atomically.
-- ============================================================================

-- ---------- allowed edges ----------------------------------------------------
create or replace function public.is_valid_transition(p_from donation_status, p_to donation_status)
returns boolean language sql immutable as $$
  select case p_from
    when 'draft'            then p_to in ('available', 'cancelled')
    when 'available'        then p_to in ('claimed', 'cancelled', 'expired')
    when 'claimed'          then p_to in ('pickup_scheduled', 'available', 'expired', 'cancelled')
    when 'pickup_scheduled' then p_to in ('picked_up', 'cancelled')
    when 'picked_up'        then p_to in ('delivered')
    when 'delivered'        then p_to in ('completed')
    else false
  end
$$;

-- ---------- safety-net trigger ----------------------------------------------
create or replace function public.enforce_donation_transition()
returns trigger language plpgsql as $$
begin
  if new.status is distinct from old.status
     and not public.is_valid_transition(old.status, new.status) then
    raise exception 'Illegal donation transition: % -> %', old.status, new.status
      using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

create trigger trg_donations_transition_guard
  before update on public.donations
  for each row execute function public.enforce_donation_transition();

-- ---------- the guarded entry point -----------------------------------------
create or replace function public.transition_donation(
  p_id        uuid,
  p_to        donation_status,
  p_note      text default null,
  p_volunteer uuid default null
)
returns public.donations
language plpgsql
security definer set search_path = public
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

  insert into public.donation_events(donation_id, from_status, to_status, actor_id, actor_role, note)
  values (p_id, v_from, p_to, v_uid, v_role, p_note);

  return d;
end;
$$;

grant execute on function public.transition_donation(uuid, donation_status, text, uuid) to authenticated;

-- ---------- impact metrics ---------------------------------------------------
-- Respects the caller's RLS: an admin (who can see all donations) gets global
-- numbers; other roles get their own slice.
create or replace view public.impact_summary
with (security_invoker = on) as
select
  count(*) filter (where d.status = 'completed')                                  as donations_completed,
  coalesce(sum(dl.servings_delivered), 0)                                         as meals_served,
  count(distinct d.assigned_volunteer) filter (where d.assigned_volunteer is not null) as active_volunteers,
  count(distinct d.claimed_by_ngo)     filter (where d.claimed_by_ngo is not null)     as partner_ngos,
  count(*) filter (where d.status = 'expired')                                    as missed_expired
from public.donations d
left join public.deliveries dl on dl.donation_id = d.id;

grant select on public.impact_summary to authenticated;
