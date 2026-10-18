begin;
alter table public.donations add column if not exists vegetarian_confirmed boolean not null default false;
grant update (vegetarian_confirmed) on public.donations to authenticated;
create or replace function public.enforce_vegetarian_pilot() returns trigger
language plpgsql set search_path=public,pg_temp as $$
begin
 if tg_op='INSERT' then
  if new.food_type='nonveg' then raise exception 'Food4All currently accepts vegetarian food only';end if;
 else
  if new.food_type='nonveg' and (new.food_type is distinct from old.food_type or (new.status is distinct from old.status and new.status not in ('cancelled','expired','rejected'))) then
   raise exception 'Non-vegetarian food cannot enter or move forward in this pilot';
  end if;
 end if;
 if new.status='available' then
  if tg_op='INSERT' then
   if not new.vegetarian_confirmed then raise exception 'Confirm vegetarian ingredients and separate packing before publishing';end if;
  elsif old.status='draft' and not new.vegetarian_confirmed then
   raise exception 'Confirm vegetarian ingredients and separate packing before publishing';
  end if;
 end if;
 return new;
end;$$;
drop trigger if exists donations_vegetarian_pilot on public.donations;
create trigger donations_vegetarian_pilot before insert or update on public.donations for each row execute function public.enforce_vegetarian_pilot();
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
  d.batch_no, d.food_temp_c, d.is_perishable, d.not_previously_served, d.vegetarian_confirmed
from public.donations d
where d.food_type <> 'nonveg' and auth.uid() is not null and (
  public.can_see_exact(d) or d.status='available'
  or (d.status='claimed' and public.app_role(auth.uid())='volunteer')
);


comment on column public.donations.vegetarian_confirmed is 'Donor declaration of vegetarian ingredients and packing separately from non-vegetarian food. Not a platform inspection or guarantee. Existing records are not backfilled.';
commit;
