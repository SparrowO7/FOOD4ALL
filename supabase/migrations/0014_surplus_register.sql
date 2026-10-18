-- ============================================================================
-- Food4All — 0014_surplus_register.sql
--
-- The record regulation 7 requires, as a single readable relation.
--
--   "7. Maintenance of record of surplus food.- The food donor and surplus food
--    distribution organisation shall maintain the record of surplus food as
--    specified in Schedule-II."
--      — FSS (Recovery and Distribution of Surplus Food) Regulations, 2019
--
-- Schedule-II lists twelve fields. They are scattered across donations,
-- profiles, ngos and deliveries, which is correct for the application but
-- useless when someone asks to see the register. This view assembles them in
-- Schedule-II order, one row per donation, named so the mapping is obvious.
--
-- security_invoker, deliberately: reg 7 places the duty on BOTH the donor and
-- the distribution organisation, so each should be able to produce its own
-- register. The caller's RLS on donations decides which rows they see — a donor
-- sees theirs, the claiming NGO sees theirs, an admin sees all. No separate
-- permission model to keep in step.
-- ============================================================================

create or replace view public.surplus_food_register
with (security_invoker = true) as
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
where d.status <> 'draft';

comment on view public.surplus_food_register is
  'The Schedule-II record of surplus food (reg 7 of the FSS (Recovery and Distribution of Surplus Food) Regulations, 2019), assembled in Schedule-II order. security_invoker: each party sees the donations it is party to, which matches reg 7 placing the duty on both donor and distribution organisation.';

grant select on public.surplus_food_register to authenticated;

-- Fields the register cannot fill, and why — run this before an inspection so
-- there are no surprises:
--   select count(*) filter (where batch_no is null)          as no_batch,
--          count(*) filter (where food_temperature_c is null) as no_temperature,
--          count(*) filter (where distribution_area is null
--                             and status = 'completed')       as no_area,
--          count(*)                                          as total
--   from public.surplus_food_register;
