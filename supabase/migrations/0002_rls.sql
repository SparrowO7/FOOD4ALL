-- ============================================================================
-- Food4All — 0002_rls.sql
-- Row-Level Security. All status changes go through transition_donation()
-- (see 0003); direct client writes are deliberately narrow.
-- ============================================================================

-- ---------- helpers (SECURITY DEFINER avoids RLS recursion) -----------------
create or replace function public.app_role(uid uuid)
returns user_role
language sql stable security definer set search_path = public
as $$ select role from public.profiles where id = uid $$;

create or replace function public.is_admin()
returns boolean
language sql stable security definer set search_path = public
as $$ select exists (select 1 from public.profiles where id = auth.uid() and role = 'admin') $$;

-- Can the current user see the exact pickup location of this donation?
create or replace function public.can_see_exact(d public.donations)
returns boolean
language sql stable
as $$
  select
    d.donor_id = auth.uid()
    or d.claimed_by_ngo = auth.uid()
    or d.assigned_volunteer = auth.uid()
    or public.is_admin()
$$;

-- ---------- enable RLS -------------------------------------------------------
alter table public.profiles        enable row level security;
alter table public.ngos            enable row level security;
alter table public.volunteers      enable row level security;
alter table public.donations       enable row level security;
alter table public.donation_events enable row level security;
alter table public.deliveries      enable row level security;

-- ---------- profiles ---------------------------------------------------------
create policy profiles_select_self_or_admin on public.profiles
  for select using (id = auth.uid() or public.is_admin());
create policy profiles_insert_self on public.profiles
  for insert with check (id = auth.uid());
create policy profiles_update_self_or_admin on public.profiles
  for update using (id = auth.uid() or public.is_admin());

-- ---------- ngos -------------------------------------------------------------
-- Anyone signed in can see VERIFIED ngos (to pick a receiver); own + admin always.
create policy ngos_select on public.ngos
  for select using (verification_status = 'verified' or id = auth.uid() or public.is_admin());
create policy ngos_insert_self on public.ngos
  for insert with check (id = auth.uid() and public.app_role(auth.uid()) = 'ngo');
create policy ngos_update_own_or_admin on public.ngos
  for update using (id = auth.uid() or public.is_admin());

-- ---------- volunteers -------------------------------------------------------
-- Available volunteers are visible (so NGOs can dispatch); own + admin always.
create policy volunteers_select on public.volunteers
  for select using (is_available or id = auth.uid() or public.is_admin());
create policy volunteers_insert_self on public.volunteers
  for insert with check (id = auth.uid() and public.app_role(auth.uid()) = 'volunteer');
create policy volunteers_update_own_or_admin on public.volunteers
  for update using (id = auth.uid() or public.is_admin());

-- ---------- donations --------------------------------------------------------
-- Visible: own donation, any AVAILABLE donation, ones you claimed/are assigned, admin.
create policy donations_select on public.donations
  for select using (
    donor_id = auth.uid()
    or status = 'available'
    or claimed_by_ngo = auth.uid()
    or assigned_volunteer = auth.uid()
    or public.is_admin()
  );
-- Donors create their own donations.
create policy donations_insert_donor on public.donations
  for insert with check (donor_id = auth.uid() and public.app_role(auth.uid()) = 'donor');
-- Donors may edit ONLY their own draft. Every status transition happens via the
-- SECURITY DEFINER function in 0003 (which bypasses this policy safely).
create policy donations_update_owner_draft on public.donations
  for update using (
    (donor_id = auth.uid() and status = 'draft') or public.is_admin()
  );
create policy donations_delete_owner_draft on public.donations
  for delete using (
    (donor_id = auth.uid() and status = 'draft') or public.is_admin()
  );

-- ---------- donation_events (read-only for users; written by the guard) ------
create policy events_select on public.donation_events
  for select using (
    public.is_admin()
    or exists (
      select 1 from public.donations d
      where d.id = donation_id
        and (d.donor_id = auth.uid() or d.claimed_by_ngo = auth.uid() or d.assigned_volunteer = auth.uid())
    )
  );

-- ---------- deliveries -------------------------------------------------------
create policy deliveries_select on public.deliveries
  for select using (
    public.is_admin()
    or volunteer_id = auth.uid()
    or ngo_id = auth.uid()
    or exists (select 1 from public.donations d where d.id = donation_id and d.donor_id = auth.uid())
  );
-- The assigned volunteer records the delivery proof.
create policy deliveries_insert_volunteer on public.deliveries
  for insert with check (
    volunteer_id = auth.uid()
    and exists (select 1 from public.donations d where d.id = donation_id and d.assigned_volunteer = auth.uid())
  );

-- ---------- masked public view of donations ---------------------------------
-- security_invoker = respects the caller's RLS; the CASE masks precise location
-- until the caller is authorized (donor / claiming NGO / assigned volunteer / admin).
create or replace view public.donations_public
with (security_invoker = on) as
select
  d.id, d.donor_id, d.title, d.description, d.food_type, d.is_cooked, d.allergens,
  d.quantity_desc, d.servings_estimate, d.prepared_at, d.best_before, d.storage_condition,
  d.photo_url, d.status, d.pickup_window_start, d.pickup_window_end,
  d.claimed_by_ngo, d.assigned_volunteer, d.created_at, d.updated_at,
  case when public.can_see_exact(d) then d.pickup_address  else null end            as pickup_address,
  case when public.can_see_exact(d) then d.pickup_landmark else null end            as pickup_landmark,
  case when public.can_see_exact(d) then d.pickup_lat      else round(d.pickup_lat, 2) end as pickup_lat,
  case when public.can_see_exact(d) then d.pickup_lng      else round(d.pickup_lng, 2) end as pickup_lng,
  public.can_see_exact(d) as address_revealed
from public.donations d;

grant select on public.donations_public to authenticated, anon;
