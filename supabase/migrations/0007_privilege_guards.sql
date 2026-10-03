-- ============================================================================
-- Food4All — 0007_privilege_guards.sql
--
-- Three privilege-escalation holes found while writing the end-to-end test.
-- All three were reachable from a plain browser with the publishable key, so
-- they matter more than any of the bugs fixed so far.
--
-- HOLE 1 — anyone could self-register as ADMIN.
--   handle_new_user() read the role straight out of raw_user_meta_data:
--       coalesce((new.raw_user_meta_data ->> 'role')::user_role, 'donor')
--   and that metadata is whatever the client passed to signUp(). So:
--       supabase.auth.signUp({ email, password,
--                              options: { data: { role: 'admin' } } })
--   produced a real admin. is_admin() unlocks every ownership check inside
--   transition_donation(), the unmasked donations_select policy (i.e. the exact
--   pickup address of every donor), all profiles, and the expiry sweep.
--   That is a donor-privacy breach available to an anonymous signup form.
--
-- HOLE 2 — any user could promote themselves afterwards.
--   profiles_update_self_or_admin is `for update using (id = auth.uid() ...)`
--   with no column restriction, so:
--       update profiles set role = 'admin' where id = auth.uid();
--   succeeded. (An UPDATE policy's USING clause is evaluated against the new
--   row too when WITH CHECK is omitted — but `id = auth.uid()` still holds
--   after changing the role, so the policy was never going to catch this.)
--
-- HOLE 3 — an NGO could verify itself.
--   ngos_update_own_or_admin let an NGO set its own verification_status to
--   'verified' (plus verified_by / verified_at). Since ngos_select shows every
--   verified NGO to all signed-in users, self-verification turns the platform's
--   entire trust signal into something an applicant grants themselves.
--
-- WHY TRIGGERS AND NOT POLICIES for 2 and 3: an RLS policy cannot compare the
-- old row to the new one (USING sees OLD, WITH CHECK sees NEW — never both), and
-- "you may update your row but not this one column" is exactly an OLD-vs-NEW
-- comparison. A BEFORE UPDATE trigger is the right tool.
--
-- Both triggers deliberately allow the change when auth.uid() is null. That is
-- the service role, pg_cron, or the SQL editor — trusted contexts that already
-- bypass RLS — and it is how you legitimately promote an admin:
--
--     update public.profiles set role = 'admin'
--      where id = (select id from auth.users where email = 'you@example.com');
-- ============================================================================

-- ---------- HOLE 1: clamp the role a signup may request ----------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  -- Client-supplied and therefore untrusted.
  v_requested text     := new.raw_user_meta_data ->> 'role';
  -- Only these three are self-serviceable. 'admin' is granted in SQL, never
  -- requested: an unrecognised or privileged request silently becomes 'donor'.
  v_role      user_role := case
                             when v_requested in ('donor', 'ngo', 'volunteer')
                               then v_requested::user_role
                             else 'donor'
                           end;
  v_name      text     := coalesce(new.raw_user_meta_data ->> 'full_name', '');
begin
  insert into public.profiles (id, role, full_name, phone)
  values (new.id, v_role, v_name, new.raw_user_meta_data ->> 'phone');

  -- Give NGOs and volunteers their detail row immediately, so the very first
  -- claim / assignment cannot fail on a missing foreign-key target. (0004)
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

-- ---------- HOLE 2: role changes are an admin action -------------------------
create or replace function public.prevent_role_escalation()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  if new.role is distinct from old.role
     and auth.uid() is not null          -- null = service role / cron / SQL editor
     and not public.is_admin() then
    raise exception 'Only an admin can change a user role'
      using errcode = '42501';
  end if;
  return new;
end;
$$;

drop trigger if exists profiles_no_role_escalation on public.profiles;
create trigger profiles_no_role_escalation
  before update on public.profiles
  for each row execute function public.prevent_role_escalation();

-- ---------- HOLE 3: verification is an admin action --------------------------
create or replace function public.prevent_self_verification()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  if (new.verification_status is distinct from old.verification_status
      or new.verified_by is distinct from old.verified_by
      or new.verified_at is distinct from old.verified_at)
     and auth.uid() is not null
     and not public.is_admin() then
    raise exception 'Only an admin can change NGO verification'
      using errcode = '42501';
  end if;
  return new;
end;
$$;

drop trigger if exists ngos_no_self_verification on public.ngos;
create trigger ngos_no_self_verification
  before update on public.ngos
  for each row execute function public.prevent_self_verification();

comment on function public.prevent_role_escalation() is
  'Blocks role changes by non-admins. Allows them when auth.uid() is null (service role / SQL editor), which is the supported way to grant the first admin.';
comment on function public.prevent_self_verification() is
  'Blocks an NGO from setting its own verification_status. Same trusted-context exception as prevent_role_escalation().';

-- Known and accepted for the MVP, listed here so it is not forgotten:
-- volunteers.total_pickups is self-writable and could be inflated. It is
-- cosmetic — public_impact() derives its numbers from donations and deliveries,
-- not from this column — so it is left for Phase 3 to move under a trigger.
