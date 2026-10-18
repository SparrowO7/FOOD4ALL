-- ============================================================================
-- Food4All — 0009_compliance.sql
--
-- Closes the compliance gaps found by reading the primary legal text rather
-- than a summary of it:
--
--   Food Safety and Standards (Recovery and Distribution of Surplus Food)
--   Regulations, 2019 — F. No. REG/11/27/Surplus Food/FSSAI-2017,
--   notified 26 July 2019; FBO compliance mandatory from 1 July 2020.
--
-- Schedule-II of that regulation lists twelve record fields that a food donor
-- and a surplus food distribution organisation "shall maintain". Nine already
-- existed in 0001_schema.sql. This migration adds the missing three, the two
-- attestations the regulation's own definitions require, the licence fields
-- reg 5(1) depends on, and the volunteer hygiene attestation from Schedule-I
-- 2(11).
--
-- It also fixes a real defect: 0001_schema.sql:86 declares prepared_at
-- "MANDATORY when is_cooked" in a COMMENT, and nothing enforced it. A cooked
-- donation could be published with no preparation time, which fails
-- Schedule-II(6) and makes a reg 6(3)-compliant label impossible to print.
--
-- Re-runnable: every statement is guarded.
-- ============================================================================

-- ---------- donations: the three missing Schedule-II fields ------------------

alter table public.donations
  add column if not exists batch_no   text,
  add column if not exists food_temp_c numeric(4,1);

comment on column public.donations.batch_no is
  'Schedule-II(5): batch number of the food product. Free text — a restaurant''s "batch" may be a service name ("evening thali"), not a factory code.';

-- Deliberately NULLABLE. Schedule-II(9) requires the temperature of the food,
-- but if the donor has no thermometer a mandatory column produces invented
-- numbers, and invented numbers in a table meant to be legal evidence are worse
-- than an honest blank. The pilot reports field COVERAGE instead of claiming
-- compliance it does not have.
comment on column public.donations.food_temp_c is
  'Schedule-II(9): measured food temperature in Celsius. Nullable on purpose — see migration header. Report coverage, never fabricate.';

-- ---------- donations: segregation and the "surplus food" attestation -------

-- Schedule-I 1(1): surplus food "shall be safe and segregated in to perishable
-- and non-perishable". storage_condition (room/refrigerated/hot_held) describes
-- how the food is being HELD, which is a different question.
alter table public.donations
  add column if not exists is_perishable boolean not null default true;

comment on column public.donations.is_perishable is
  'Schedule-I 1(1): perishable vs non-perishable segregation. Defaults true because cooked food is the common case and the safer default.';

-- reg 2(1)(d) defines "surplus food" as leftover unused portions of safe food
-- "that have not been served to the customers". Food already served is NOT
-- surplus food and falls outside the regulation entirely.
--
-- Defaults FALSE on purpose: this is a legal assertion about the food, and only
-- the donor can make it. A default of true would have the system assert a fact
-- nobody actually attested to.
alter table public.donations
  add column if not exists not_previously_served boolean not null default false;

comment on column public.donations.not_previously_served is
  'reg 2(1)(d) attestation: donor confirms this food was never served to customers, which is what makes it "surplus food" in law. Must be an explicit tick — never defaulted to true.';

-- ---------- deliveries: Schedule-II(11) -------------------------------------

alter table public.deliveries
  add column if not exists distribution_area text;

comment on column public.deliveries.distribution_area is
  'Schedule-II(11): area where the food was distributed. An AREA, not a person — beneficiary identity is deliberately not collected.';

-- ---------- licences: reg 5(1) ----------------------------------------------

-- reg 5(1): an SFDO is regulated under the Licensing and Registration of Food
-- Business Regulations, 2011, and food "shall be obtained from reliable sources
-- having valid registration or license". So both ends of the handover need a
-- recorded licence position.
--
-- Both nullable with a free-text note rather than NOT NULL: whether a given
-- donor or NGO actually requires an FSSAI licence depends on its scale and
-- legal form. Forcing a value pushes people into entering a fake one.

alter table public.profiles
  add column if not exists fssai_licence_no text;

comment on column public.profiles.fssai_licence_no is
  'reg 5(1): donor-side FSSAI registration or licence number. Nullable — applicability depends on the donor''s scale and legal form.';

alter table public.ngos
  add column if not exists fssai_licence_no  text,
  add column if not exists has_reheating     boolean,
  add column if not exists transport_notes   text,
  add column if not exists licence_not_required_note text,
  add column if not exists authorised_acceptor text;

comment on column public.ngos.fssai_licence_no is
  'reg 5(1): SFDO registration or licence number.';
comment on column public.ngos.licence_not_required_note is
  'Written reason recorded when the NGO holds no FSSAI licence, so "blank" is never ambiguous between "not asked" and "not required".';
comment on column public.ngos.has_reheating is
  'reg 5(2): SFDO "shall have proper facilities for transport, storage and reheating".';
comment on column public.ngos.transport_notes is
  'reg 5(2) + Schedule-I 2(2): what the food is transported in (insulated containers, ice packs, vehicle condition).';
comment on column public.ngos.authorised_acceptor is
  'Who may accept donations on the NGO''s behalf. Not captured before 0009; needed so the audit trail names a responsible person.';

-- ---------- volunteers: Schedule-I 2(11) ------------------------------------

-- "All employees or volunteers that work with distribution organisations and
-- come in direct contact with food shall have training in health and personal
-- hygiene."
alter table public.volunteers
  add column if not exists hygiene_training_at timestamptz;

comment on column public.volunteers.hygiene_training_at is
  'Schedule-I 2(11): when this volunteer''s health and personal hygiene training was confirmed. NULL means not yet confirmed — blocks assignment in live mode.';

-- ---------- the unenforced field: prepared_at ------------------------------
--
-- Added NOT VALID so this migration never fails on a database that already
-- holds test rows with is_cooked = true and prepared_at = null. New inserts and
-- updates are checked immediately; existing rows are checked only when you run
-- the VALIDATE at the bottom.

do $$
declare
  v_bad integer;
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'cooked_requires_prepared_at'
      and conrelid = 'public.donations'::regclass
  ) then
    alter table public.donations
      add constraint cooked_requires_prepared_at
      check (not is_cooked or prepared_at is not null) not valid;
    raise notice 'Added cooked_requires_prepared_at (NOT VALID).';
  end if;

  select count(*) into v_bad
  from public.donations
  where is_cooked and prepared_at is null;

  if v_bad = 0 then
    alter table public.donations validate constraint cooked_requires_prepared_at;
    raise notice 'Constraint validated: no existing rows violate it.';
  else
    raise notice '% existing row(s) have is_cooked = true and prepared_at = null. Backfill or delete them, then run: alter table public.donations validate constraint cooked_requires_prepared_at;', v_bad;
  end if;
end $$;

-- Find the offenders with:
--   select id, title, created_at from public.donations
--   where is_cooked and prepared_at is null order by created_at;
