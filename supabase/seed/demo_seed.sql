-- ============================================================================
-- Food4All — demo seed (NOT a migration: run only when you want demo data)
--
-- Creates four pre-CONFIRMED accounts directly in auth.users. Two reasons this
-- is done in SQL rather than through the signup form:
--
--   1. Supabase's built-in email service allows only ~2 emails/hour on the free
--      tier. With "Confirm email" ON, a live demo breaks as soon as the third
--      person signs up. These accounts are confirmed at creation, so they log in
--      no matter how that setting is configured.
--   2. It gives you stable, shareable credentials for the viva.
--
-- Inserting into auth.users fires the on_auth_user_created trigger, so the
-- profiles / ngos / volunteers rows are created by the same code path a real
-- signup uses — this seed does not bypass the application's own logic.
--
-- Idempotent: safe to run more than once.
--
-- Login for all four:  password  Food4All!demo123
--   demo.donor@food4all.dev      (donor)
--   demo.ngo@food4all.dev        (ngo)
--   demo.volunteer@food4all.dev  (volunteer)
--   demo.admin@food4all.dev      (admin)
-- ============================================================================

do $$
declare
  r record;
begin
  for r in
    select * from (values
      ('11111111-1111-4111-8111-111111111111'::uuid, 'demo.donor@food4all.dev',     'donor',     'Sunrise Banquet Hall'),
      ('22222222-2222-4222-8222-222222222222'::uuid, 'demo.ngo@food4all.dev',       'ngo',       'Aashray Shelter Trust'),
      ('33333333-3333-4333-8333-333333333333'::uuid, 'demo.volunteer@food4all.dev', 'volunteer', 'Rohit Verma'),
      ('44444444-4444-4444-8444-444444444444'::uuid, 'demo.admin@food4all.dev',     'admin',     'Platform Admin')
    ) as t(id, email, role, name)
  loop
    -- auth.users: email_confirmed_at is set, so no confirmation mail is needed.
    -- The empty token columns are deliberate: GoTrue scans them into Go strings
    -- and fails to log the user in if any of them is NULL.
    insert into auth.users (
      instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
      raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
      confirmation_token, recovery_token, email_change, email_change_token_new
    ) values (
      '00000000-0000-0000-0000-000000000000', r.id, 'authenticated', 'authenticated',
      r.email,
      extensions.crypt('Food4All!demo123', extensions.gen_salt('bf')),
      now(),
      '{"provider":"email","providers":["email"]}'::jsonb,
      jsonb_build_object('role', r.role, 'full_name', r.name, 'phone', '9000000000'),
      now(), now(),
      '', '', '', ''
    )
    on conflict (id) do nothing;

    -- GoTrue expects a matching identity row for the email provider.
    insert into auth.identities (
      provider_id, user_id, identity_data, provider, last_sign_in_at, created_at, updated_at
    )
    select r.id::text, r.id,
           jsonb_build_object('sub', r.id::text, 'email', r.email, 'email_verified', true),
           'email', now(), now(), now()
    where not exists (
      select 1 from auth.identities i where i.user_id = r.id and i.provider = 'email'
    );
  end loop;
end $$;

-- ---------- promote the demo admin -------------------------------------------
-- The signup trigger deliberately refuses to grant 'admin' from client-supplied
-- metadata (migration 0007 — otherwise anyone could sign up as an admin), so the
-- role is granted here instead. auth.uid() is null in the SQL editor, which is
-- the supported trusted context for this.
update public.profiles
   set role = 'admin'
 where id = '44444444-4444-4444-8444-444444444444'
   and role <> 'admin';

-- ---------- flesh out the role detail rows -----------------------------------
-- (the trigger created them; this adds the realistic detail a demo needs)

update public.ngos set
  org_name            = 'Aashray Shelter Trust',
  registration_no     = 'UP/2019/0084312',
  contact_person      = 'Meera Joshi',
  contact_phone       = '9000000002',
  address             = 'Aashray Shelter, Gomti Nagar, Lucknow',
  lat                 = 26.850000,
  lng                 = 80.990000,
  capacity_notes      = 'Serves ~120 residents. Can receive up to 150 meals at a time.',
  verification_status = 'verified',
  verified_at         = now()
where id = '22222222-2222-4222-8222-222222222222';

update public.volunteers set
  vehicle_type        = 'bike',
  service_radius_km   = 8,
  current_lat         = 26.848000,
  current_lng         = 80.955000,
  location_updated_at = now(),
  is_available        = true
where id = '33333333-3333-4333-8333-333333333333';

-- ---------- a couple of browsable donations ----------------------------------
-- One AVAILABLE (so /donations is not empty) and one EXPIRED (the honest
-- "missed" counter the impact page deliberately shows).

insert into public.donations (
  id, donor_id, title, description, food_type, is_cooked, quantity_desc,
  servings_estimate, prepared_at, best_before, storage_condition,
  pickup_address, pickup_landmark, pickup_lat, pickup_lng,
  pickup_window_start, pickup_window_end, status
) values (
  'aaaaaaaa-0000-4000-8000-000000000001',
  '11111111-1111-4111-8111-111111111111',
  'Wedding surplus — 120 veg thalis',
  'Dal, paneer sabzi, jeera rice, 8 rotis per thali. Untouched buffet trays, hot-held since service ended.',
  'veg', true, '120 thalis in 6 insulated trays', 120,
  now() - interval '45 minutes', now() + interval '5 hours', 'hot_held',
  'Sunrise Banquet Hall, Vibhuti Khand, Gomti Nagar, Lucknow',
  'Opposite Ekana Stadium gate 3',
  26.846700, 80.946200,
  now() + interval '20 minutes', now() + interval '4 hours',
  'available'
) on conflict (id) do nothing;

insert into public.donations (
  id, donor_id, title, description, food_type, is_cooked, quantity_desc,
  servings_estimate, prepared_at, best_before, storage_condition,
  pickup_address, pickup_lat, pickup_lng,
  pickup_window_start, pickup_window_end, status
) values (
  'aaaaaaaa-0000-4000-8000-000000000002',
  '11111111-1111-4111-8111-111111111111',
  'Canteen leftovers — 30 veg meals',
  'Nobody claimed this one in time. Kept on the board on purpose: a rescue platform that hides its misses cannot be audited.',
  'veg', true, '30 meals', 30,
  now() - interval '2 days' - interval '3 hours', now() - interval '2 days', 'room',
  'Hostel Mess Block C, Lucknow', 26.844000, 80.940000,
  now() - interval '2 days' - interval '2 hours', now() - interval '2 days' - interval '30 minutes',
  'expired'
) on conflict (id) do nothing;

-- ---------- what you should see ---------------------------------------------
select 'accounts' as check, count(*)::text as value from public.profiles
where id in (
  '11111111-1111-4111-8111-111111111111','22222222-2222-4222-8222-222222222222',
  '33333333-3333-4333-8333-333333333333','44444444-4444-4444-8444-444444444444')
union all
select 'ngos row (needed to claim)',    count(*)::text from public.ngos      where id = '22222222-2222-4222-8222-222222222222'
union all
select 'volunteers row (needed to assign)', count(*)::text from public.volunteers where id = '33333333-3333-4333-8333-333333333333'
union all
select 'demo donations',                count(*)::text from public.donations where donor_id = '11111111-1111-4111-8111-111111111111';
