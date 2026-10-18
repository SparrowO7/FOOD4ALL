-- Apply after 0014. Keep this migration atomic. Regression suite: npm run test:db.
begin;
-- Raw rows and the invoker register are private; discovery uses an explicitly
-- filtered owner-executed, security-barrier view with masked location columns.
drop policy if exists donations_select on public.donations;
create policy donations_select on public.donations for select to authenticated
using (coalesce(public.can_see_exact(donations), false));
create or replace view public.donations_public
with (security_invoker = false, security_barrier = true) as
select
  d.id, d.donor_id, d.title, d.description, d.food_type, d.is_cooked, d.allergens,
  d.quantity_desc, d.servings_estimate, d.prepared_at, d.best_before, d.storage_condition,
  d.photo_url, d.status, d.pickup_window_start, d.pickup_window_end,
  d.claimed_by_ngo, d.assigned_volunteer, d.created_at, d.updated_at,
  case when public.can_see_exact(d) then d.pickup_address  else null end            as pickup_address,
  case when public.can_see_exact(d) then d.pickup_landmark else null end            as pickup_landmark,
  case when public.can_see_exact(d) then d.pickup_lat      else round(d.pickup_lat, 2) end as pickup_lat,
  case when public.can_see_exact(d) then d.pickup_lng      else round(d.pickup_lng, 2) end as pickup_lng,
  coalesce(public.can_see_exact(d), false) as address_revealed,
  d.batch_no, d.food_temp_c, d.is_perishable, d.not_previously_served
from public.donations d
where auth.uid() is not null and (
  public.can_see_exact(d) or d.status='available'
  or (d.status='claimed' and public.app_role(auth.uid())='volunteer')
);

revoke all on public.donations_public from anon;
grant select on public.donations_public to authenticated;

drop policy if exists volunteers_select on public.volunteers;
create policy volunteers_select on public.volunteers for select to authenticated
using (id=auth.uid() or public.is_admin());
-- Profiles are created by the auth trigger, never by a client-supplied INSERT.
drop policy if exists profiles_insert_self on public.profiles;

-- Table-level UPDATE grants override column grants, so remove them first.
-- Lifecycle, assignment and outcome attribution may only be written by RPCs.
revoke update on public.donations from anon, authenticated;
grant update (title, description, food_type, is_cooked, allergens, quantity_desc,
servings_estimate, prepared_at, best_before, storage_condition, photo_url,
pickup_address, pickup_landmark, pickup_lat, pickup_lng, pickup_window_start,
pickup_window_end, batch_no, food_temp_c, is_perishable, not_previously_served)
on public.donations to authenticated;
revoke insert on public.profiles from anon, authenticated;
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
  if v_role is null then raise exception 'Profile required'; end if;
  if p_to is null then raise exception 'Target status required'; end if;
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
    if (d.donor_id = v_uid or v_role = 'admin') is not true then
      raise exception 'Only the donor can publish this donation';
    end if;
    if not d.not_previously_served then raise exception 'Confirm food was never served before publishing'; end if;
    if d.best_before <= now() then
      raise exception 'best_before must be in the future to publish';
    end if;

  elsif p_to = 'available' and v_from = 'claimed' then            -- NGO releases
    if (d.claimed_by_ngo = v_uid or v_role = 'admin') is not true then
      raise exception 'Only the claiming NGO can release this donation';
    end if;
    d.claimed_by_ngo := null;
    d.assigned_volunteer := null;

  elsif p_to = 'claimed' then
    if (v_role in ('ngo', 'admin')) is not true then
      raise exception 'Only an NGO can claim a donation';
    end if;
    if d.best_before <= now() then
      raise exception 'Donation is past its freshness window';
    end if;
    if not exists (select 1 from public.ngos where id=v_uid and verification_status='verified') then
      raise exception 'An administrator must verify your NGO before its first claim';
    end if;
    d.claimed_by_ngo := v_uid;

  elsif p_to = 'pickup_scheduled' then
    if d.best_before <= now() or d.pickup_window_end <= now() then
      raise exception 'Pickup window has expired';
    end if;
    if v_role = 'ngo' and d.claimed_by_ngo is distinct from v_uid then
      raise exception 'Only the claiming NGO can assign a volunteer';
    end if;
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

    if not exists (select 1 from public.volunteers v join public.profiles p on p.id=v.id
                   where v.id=d.assigned_volunteer and p.role='volunteer' and v.is_available) then
      raise exception 'Choose an available volunteer';
    end if;

  elsif p_to = 'picked_up' then
    if (d.assigned_volunteer = v_uid or v_role = 'admin') is not true then
      raise exception 'Only the assigned volunteer can mark pickup';
    end if;

  elsif p_to = 'delivered' then
    if (d.assigned_volunteer = v_uid or v_role = 'admin') is not true then
      raise exception 'Only the assigned volunteer can mark delivery';
    end if;

  elsif p_to = 'completed' then
    if not exists (select 1 from public.deliveries where donation_id=p_id and servings_delivered is not null) then
      raise exception 'Record the delivered servings before confirming receipt';
    end if;
    if (d.claimed_by_ngo = v_uid or v_role = 'admin') is not true then
      raise exception 'Only the claiming NGO can confirm receipt';
    end if;

  elsif p_to = 'rejected' then
    -- The receiving side refuses the food: the NGO that claimed it, or the
    -- volunteer carrying it. NOT the donor — a donor who no longer wants the
    -- donation collected is cancelling, not rejecting, and conflating the two
    -- would corrupt the failure statistics.
    if (d.claimed_by_ngo = v_uid or d.assigned_volunteer = v_uid
            or v_role = 'admin') is not true then
      raise exception 'Only the claiming NGO or the assigned volunteer can reject food';
    end if;

  elsif p_to = 'cancelled' then
    if (d.donor_id = v_uid or d.claimed_by_ngo = v_uid
            or d.assigned_volunteer = v_uid or v_role = 'admin') is not true then
      raise exception 'Not allowed to cancel this donation';
    end if;

  elsif p_to = 'expired' then
    if v_role is distinct from 'admin' then
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

create or replace function public.annotate_outcome(
  p_id     uuid,
  p_reason failure_reason,
  p_note   text default null
)
returns public.donations
language plpgsql
security definer set search_path = public, pg_temp
as $$
declare
  d      public.donations;
  v_uid  uuid      := auth.uid();
  v_role user_role := public.app_role(auth.uid());
begin
  if v_uid is null then
    raise exception 'Not authenticated' using errcode = '28000';
  end if;
  if p_reason is null then
    raise exception 'A reason is required' using errcode = 'check_violation';
  end if;
  if p_reason = 'other' and coalesce(btrim(p_note), '') = '' then
    raise exception 'reason "other" requires a note explaining it'
      using errcode = 'check_violation';
  end if;

  select * into d from public.donations where id = p_id for update;
  if not found then
    raise exception 'Donation % not found', p_id using errcode = 'no_data_found';
  end if;

  -- Only a finished donation has an outcome to explain. Annotating a live one
  -- would let a reason drift out of step with the status it describes.
  if d.status not in ('expired', 'cancelled', 'rejected') then
    raise exception 'Only a failed donation can be annotated (status is %)', d.status
      using errcode = 'check_violation';
  end if;

  -- Write-once. An outcome that can be edited is not evidence of anything, and
  -- the whole reason this table exists is that the record has to hold up later.
  if d.outcome_reason is not null then
    raise exception 'This donation already has an outcome reason (%); it cannot be changed',
      d.outcome_reason using errcode = 'check_violation';
  end if;

  -- The donor, the NGO that claimed it, or an admin. A donation that expired
  -- unclaimed has no NGO, which is exactly why the donor is included.
  if (d.donor_id = v_uid or d.claimed_by_ngo = v_uid or v_role = 'admin') is not true then
    raise exception 'Not allowed to annotate this donation';
  end if;

  update public.donations
     set outcome_reason = p_reason,
         outcome_note   = p_note,
         outcome_set_by = v_uid,
         outcome_set_at = now()
   where id = p_id
   returning * into d;

  return d;
end;
$$;

revoke all on function public.transition_donation(uuid, donation_status, text, uuid, failure_reason) from public, anon;
grant execute on function public.transition_donation(uuid, donation_status, text, uuid, failure_reason) to authenticated;
revoke all on function public.annotate_outcome(uuid, failure_reason, text) from public, anon;
grant execute on function public.annotate_outcome(uuid, failure_reason, text) to authenticated;
-- Never expose free-text operator notes through an anonymous QR scan.
create or replace function public.public_trace_events(p_id uuid)
returns table (from_status donation_status, to_status donation_status, actor_role user_role,
 note text, reason failure_reason, created_at timestamptz)
language sql stable security definer set search_path=public,pg_temp as $$
select e.from_status,e.to_status,e.actor_role,
 case when public.can_see_exact(d) then e.note else null end,e.reason,e.created_at
from public.donation_events e join public.donations d on d.id=e.donation_id
where d.id=p_id and d.status<>'draft' order by e.created_at;
$$;

-- PUBLIC's default function privilege must also be revoked.
revoke all on function public.expire_stale_donations() from public, anon, authenticated;
revoke all on function public.admin_expire_stale_donations() from public, anon;
grant execute on function public.admin_expire_stale_donations() to authenticated;
create or replace function public.admin_expire_stale_donations() returns integer
language plpgsql security definer set search_path=public,pg_temp as $$
begin
 if public.is_admin() is not true then raise exception 'Admin only' using errcode='42501'; end if;
 return public.expire_stale_donations();
end; $$;
alter function public.app_role(uuid) set search_path=public,pg_temp;
alter function public.is_admin() set search_path=public,pg_temp;
alter function public.handle_new_user() set search_path=public,pg_temp;
alter function public.prevent_role_escalation() set search_path=public,pg_temp;
alter function public.prevent_self_verification() set search_path=public,pg_temp;
alter function public.expire_stale_donations() set search_path=public,pg_temp;
alter function public.public_impact() set search_path=public,pg_temp;

-- No prefilled attribution, ownership changes, or self-issued trust badges.
drop policy if exists donations_insert_donor on public.donations;
create policy donations_insert_donor on public.donations for insert to authenticated with check (
 donor_id=auth.uid() and public.app_role(auth.uid())='donor' and status='draft'
 and claimed_by_ngo is null and assigned_volunteer is null
 and outcome_reason is null and outcome_note is null and outcome_set_by is null and outcome_set_at is null
);
create or replace function public.prevent_role_escalation() returns trigger
language plpgsql security definer set search_path=public,pg_temp as $$
begin
 if (new.role is distinct from old.role or new.is_verified is distinct from old.is_verified)
 and auth.uid() is not null and public.is_admin() is not true then
  raise exception 'Only an admin can change roles or verification' using errcode='42501';
 end if;
 return new;
end; $$;
drop policy if exists ngos_insert_self on public.ngos;
create policy ngos_insert_self on public.ngos for insert to authenticated with check (
 id=auth.uid() and public.app_role(auth.uid())='ngo' and verification_status='pending'
 and verified_by is null and verified_at is null
);
drop policy if exists deliveries_insert_volunteer on public.deliveries;
create policy deliveries_insert_volunteer on public.deliveries for insert to authenticated with check (
 volunteer_id=auth.uid() and exists (select 1 from public.donations d
 where d.id=donation_id and d.assigned_volunteer=auth.uid()
 and d.claimed_by_ngo=ngo_id and d.status='delivered')
);
-- Explicit participant scope also permits required donor profile joins for NGOs.
create or replace view public.surplus_food_register
with (security_invoker = false, security_barrier = true) as
select
  d.id                                                          as donation_id,
  -- (1) Name and address of the food donor organisation
  coalesce(nullif(btrim(p.donor_org_name), ''), nullif(btrim(p.full_name), ''), 'Unnamed donor')
                                                                as donor_name,
  d.pickup_address                                              as donor_address,
  p.fssai_licence_no                                            as donor_fssai_licence,
  -- (2) Name and address of the surplus food distribution organisation
  n.org_name                                                    as sfdo_name,
  n.address                                                     as sfdo_address,
  n.fssai_licence_no                                            as sfdo_fssai_licence,
  -- (3) Donation date
  d.created_at                                                  as donation_date,
  -- (4) Name of the food product (item)
  d.title                                                       as food_item,
  -- (5) Batch number of the food product
  d.batch_no                                                    as batch_no,
  -- (6) Date of manufacturing — preparation time for cooked food, which
  --     0009's cooked_requires_prepared_at makes non-null whenever is_cooked.
  d.prepared_at                                                 as date_of_manufacture,
  -- (7) Best before or expiry date
  d.best_before                                                 as best_before,
  -- (8) Quantity donated by the food donor
  d.quantity_desc                                               as quantity_donated,
  d.servings_estimate                                           as servings_offered,
  -- (9) Temperature of the food. NULL means not measured, and that is reported
  --     as such rather than filled in with a plausible number.
  d.food_temp_c                                                 as food_temperature_c,
  -- (10) Quantity distributed by the distribution organisation
  dl.servings_delivered                                         as servings_distributed,
  -- (11) Area where the food is distributed. An area, never a named recipient.
  dl.distribution_area                                          as distribution_area,
  -- (12) Date of distribution
  dl.delivered_at                                               as distribution_date,
  -- Context that is not part of Schedule-II but is needed to read the register:
  -- a row with no distribution date needs the outcome to explain why.
  d.status                                                      as status,
  d.food_type                                                   as veg_nonveg,
  d.is_perishable                                               as is_perishable,
  d.not_previously_served                                       as donor_attested_unserved
from public.donations d
join public.profiles p  on p.id = d.donor_id
left join public.ngos n on n.id = d.claimed_by_ngo
left join public.deliveries dl on dl.donation_id = d.id
-- Drafts were never offered to anyone, so they are not part of the record of
-- surplus food that moved.
where d.status <> 'draft' and auth.uid() is not null and coalesce(public.can_see_exact(d),false);


revoke all on public.surplus_food_register from anon;
grant select on public.surplus_food_register to authenticated;
comment on view public.surplus_food_register is 'Participant-only register. Owner-executed to join donor profiles; explicit can_see_exact filter scopes every row.';
commit;
