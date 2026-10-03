-- ============================================================================
-- Food4All — 0001_schema.sql
-- Enums, tables, indexes, and the auth->profile bootstrap trigger.
-- Run these migrations in order in the Supabase SQL editor.
-- ============================================================================

create extension if not exists pgcrypto;   -- for gen_random_uuid()

-- ---------- Enums (single source of truth) ----------------------------------
create type user_role           as enum ('donor', 'ngo', 'volunteer', 'admin');
create type donor_kind          as enum ('individual', 'restaurant', 'hotel', 'banquet', 'other');
create type food_type           as enum ('veg', 'nonveg', 'vegan', 'jain');
create type storage_condition   as enum ('room', 'refrigerated', 'hot_held');
create type verification_status as enum ('pending', 'verified', 'rejected');
create type donation_status     as enum (
  'draft', 'available', 'claimed', 'pickup_scheduled',
  'picked_up', 'delivered', 'completed', 'cancelled', 'expired'
);

-- ---------- updated_at helper ------------------------------------------------
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ---------- profiles (1:1 with auth.users) ----------------------------------
create table public.profiles (
  id             uuid primary key references auth.users(id) on delete cascade,
  role           user_role   not null default 'donor',
  full_name      text        not null default '',
  phone          text,
  city           text,
  donor_kind     donor_kind,
  donor_org_name text,
  is_verified    boolean     not null default false,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);
create trigger trg_profiles_updated before update on public.profiles
  for each row execute function public.set_updated_at();

-- ---------- ngos (extra detail for role = ngo) ------------------------------
create table public.ngos (
  id                  uuid primary key references public.profiles(id) on delete cascade,
  org_name            text not null,
  registration_no     text,
  contact_person      text,
  contact_phone       text,
  address             text,
  lat                 numeric(9,6),
  lng                 numeric(9,6),
  capacity_notes      text,
  verification_status verification_status not null default 'pending',
  verified_by         uuid references public.profiles(id),
  verified_at         timestamptz,
  created_at          timestamptz not null default now()
);

-- ---------- volunteers (extra detail for role = volunteer) ------------------
create table public.volunteers (
  id                  uuid primary key references public.profiles(id) on delete cascade,
  vehicle_type        text not null default 'none',   -- none | cycle | bike | car
  service_radius_km   int  not null default 5,
  current_lat         numeric(9,6),
  current_lng         numeric(9,6),
  location_updated_at timestamptz,
  is_available        boolean not null default true,
  total_pickups       int not null default 0,
  created_at          timestamptz not null default now()
);

-- ---------- donations (the central entity) ----------------------------------
create table public.donations (
  id                  uuid primary key default gen_random_uuid(),
  donor_id            uuid not null references public.profiles(id) on delete cascade,
  title               text not null,
  description         text,
  food_type           food_type not null,                 -- MANDATORY (FSSAI + cultural)
  is_cooked           boolean not null default true,
  allergens           text,
  quantity_desc       text not null,
  servings_estimate   int check (servings_estimate >= 0),
  prepared_at         timestamptz,                         -- MANDATORY when is_cooked
  best_before         timestamptz not null,                -- MANDATORY, drives EXPIRED
  storage_condition   storage_condition not null default 'room',
  photo_url           text,
  pickup_address      text not null,
  pickup_landmark     text,
  pickup_lat          numeric(9,6) not null,
  pickup_lng          numeric(9,6) not null,
  pickup_window_start timestamptz not null,
  pickup_window_end   timestamptz not null,
  status              donation_status not null default 'draft',
  claimed_by_ngo      uuid references public.ngos(id),
  assigned_volunteer  uuid references public.volunteers(id),
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  constraint prepared_before_bestbefore check (prepared_at is null or prepared_at <= best_before),
  constraint valid_pickup_window       check (pickup_window_start < pickup_window_end)
);
create trigger trg_donations_updated before update on public.donations
  for each row execute function public.set_updated_at();

create index idx_donations_status      on public.donations (status);
create index idx_donations_geo         on public.donations (pickup_lat, pickup_lng);
create index idx_donations_ngo         on public.donations (claimed_by_ngo);
create index idx_donations_volunteer   on public.donations (assigned_volunteer);
create index idx_donations_donor       on public.donations (donor_id);

-- ---------- donation_events (audit trail of every transition) ---------------
create table public.donation_events (
  id          uuid primary key default gen_random_uuid(),
  donation_id uuid not null references public.donations(id) on delete cascade,
  from_status donation_status,
  to_status   donation_status not null,
  actor_id    uuid references public.profiles(id),
  actor_role  user_role,
  note        text,
  created_at  timestamptz not null default now()
);
create index idx_events_donation on public.donation_events (donation_id);

-- ---------- deliveries (proof of completion) --------------------------------
create table public.deliveries (
  id                 uuid primary key default gen_random_uuid(),
  donation_id        uuid not null unique references public.donations(id) on delete cascade,
  volunteer_id       uuid references public.volunteers(id),
  ngo_id             uuid references public.ngos(id),
  servings_delivered int check (servings_delivered >= 0),
  proof_photo_url    text,
  recipient_note     text,
  delivered_at       timestamptz not null default now()
);

-- ---------- auth -> profile bootstrap ---------------------------------------
-- When a user signs up, create their profile from the sign-up metadata.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, role, full_name, phone)
  values (
    new.id,
    coalesce((new.raw_user_meta_data ->> 'role')::user_role, 'donor'),
    coalesce(new.raw_user_meta_data ->> 'full_name', ''),
    new.raw_user_meta_data ->> 'phone'
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
