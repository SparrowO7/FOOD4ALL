-- ============================================================================
-- Food4All — 0004_fixes.sql
--
-- Fix A: role sub-rows (ngos / volunteers) are now created server-side by the
--        signup trigger. Previously the client inserted them right after
--        signUp(), but with email confirmation ON there is no session yet, so
--        auth.uid() is null and RLS silently rejected the insert — leaving NGOs
--        unable to claim and volunteers unable to be assigned.
--
-- Fix B: public impact counters. impact_summary is security_invoker, so an
--        anonymous visitor only sees status='available' rows through RLS and
--        the landing page counters were structurally always zero. This adds a
--        SECURITY DEFINER function that returns AGGREGATES ONLY (no row
--        detail, no addresses, no names) so public numbers are real and safe.
-- ============================================================================

-- ---------- Fix A: create the role sub-row at signup -------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  v_role user_role := coalesce((new.raw_user_meta_data ->> 'role')::user_role, 'donor');
  v_name text      := coalesce(new.raw_user_meta_data ->> 'full_name', '');
begin
  insert into public.profiles (id, role, full_name, phone)
  values (new.id, v_role, v_name, new.raw_user_meta_data ->> 'phone');

  -- Give NGOs and volunteers their detail row immediately, so the very first
  -- claim / assignment cannot fail on a missing foreign-key target.
  if v_role = 'ngo' then
    insert into public.ngos (id, org_name, contact_person)
    values (new.id, nullif(v_name, ''), nullif(v_name, ''))
    on conflict (id) do nothing;
  elsif v_role = 'volunteer' then
    insert into public.volunteers (id)
    values (new.id)
    on conflict (id) do nothing;
  end if;

  return new;
end;
$$;

-- org_name was NOT NULL, but we may not have a name at signup time.
alter table public.ngos alter column org_name drop not null;

-- Backfill anyone who signed up before this migration.
insert into public.ngos (id, org_name, contact_person)
select p.id, nullif(p.full_name, ''), nullif(p.full_name, '')
from public.profiles p
where p.role = 'ngo'
  and not exists (select 1 from public.ngos n where n.id = p.id);

insert into public.volunteers (id)
select p.id
from public.profiles p
where p.role = 'volunteer'
  and not exists (select 1 from public.volunteers v where v.id = p.id);

-- ---------- Fix B: real public impact numbers --------------------------------
-- SECURITY DEFINER bypasses RLS deliberately, but returns only counts/sums.
-- No donor identity, address, or per-row data can leak through this.
create or replace function public.public_impact()
returns table (
  donations_completed bigint,
  meals_served        bigint,
  active_volunteers   bigint,
  partner_ngos        bigint,
  missed_expired      bigint
)
language sql
stable
security definer
set search_path = public
as $$
  select
    count(*) filter (where d.status = 'completed')                                     as donations_completed,
    coalesce(sum(dl.servings_delivered), 0)::bigint                                    as meals_served,
    count(distinct d.assigned_volunteer) filter (where d.assigned_volunteer is not null) as active_volunteers,
    count(distinct d.claimed_by_ngo)     filter (where d.claimed_by_ngo is not null)     as partner_ngos,
    count(*) filter (where d.status = 'expired')                                       as missed_expired
  from public.donations d
  left join public.deliveries dl on dl.donation_id = d.id;
$$;

grant execute on function public.public_impact() to anon, authenticated;

comment on function public.public_impact() is
  'Aggregate-only impact counters for the public landing page. SECURITY DEFINER by design: it must see all rows to count them, but exposes no row-level data.';
