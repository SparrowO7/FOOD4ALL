-- ============================================================================
-- Food4All — 0013_public_trace.sql
--
-- Capability-based public access to ONE donation, replacing anonymous access to
-- the whole board.
--
-- Two problems are fixed together:
--
--   1. 0012 revoked the anon grant on donations_public to stop a logged-out
--      observer accumulating a venue's donation pattern. That also broke the
--      /trace/<id> page and with it the QR passport — which, printed and
--      attached to the container, IS the reg 6(3) label. Losing it to a privacy
--      fix would be a bad trade.
--
--   2. A pre-existing gap, independent of 0012: donations_select (0002_rls.sql:66)
--      only exposes `status = 'available'` to an unauthenticated caller. So a QR
--      code scanned AFTER handoff — when the status is delivered or completed,
--      which is exactly when a recipient or an inspector would scan it — already
--      returned nothing. The passport never worked at the moment it mattered.
--
-- The distinction that resolves both: ENUMERATION is the threat, not LOOKUP.
-- Listing the board lets you watch a venue over time. Reading one donation whose
-- id you already hold does not — the id is a gen_random_uuid() with no
-- discoverable ordering, so it behaves as a capability. Possession of the
-- printed label is the authorisation.
--
-- So: the board stays closed to anon (0012), and a single donation is readable
-- by id through these two functions.
-- ============================================================================

-- ---------- the passport / statutory label ----------------------------------
--
-- Returns the five fields reg 6(3) requires on donated prepared food — name of
-- the food, source, date of preparation, last date of consumption, and
-- vegetarian/non-vegetarian — plus the surplus-food record fields and the
-- current status.
--
-- SECURITY DEFINER so it can read past RLS, which is the whole point: an
-- unauthenticated scan must work. Every column returned is deliberate; the
-- exact pickup location is NOT among them unless can_see_exact() says the
-- caller is a party to the donation.

create or replace function public.public_trace(p_id uuid)
returns table (
  id                  uuid,
  title               text,
  description         text,
  food_type           food_type,
  is_cooked           boolean,
  allergens           text,
  quantity_desc       text,
  servings_estimate   int,
  prepared_at         timestamptz,
  best_before         timestamptz,
  storage_condition   storage_condition,
  batch_no            text,
  food_temp_c         numeric(4,1),
  is_perishable       boolean,
  status              donation_status,
  created_at          timestamptz,
  donor_org_name      text,
  pickup_lat          numeric(9,6),
  pickup_lng          numeric(9,6),
  pickup_address      text,
  address_revealed    boolean,
  outcome_reason      failure_reason
)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select
    d.id, d.title, d.description, d.food_type, d.is_cooked, d.allergens,
    d.quantity_desc, d.servings_estimate, d.prepared_at, d.best_before,
    d.storage_condition, d.batch_no, d.food_temp_c, d.is_perishable,
    d.status, d.created_at,
    -- reg 6(3): "source of the food" must appear on the label. Falling back to
    -- the person's name covers individual donors, who have no org name.
    coalesce(nullif(btrim(p.donor_org_name), ''), nullif(btrim(p.full_name), ''), 'Unnamed donor'),
    -- Same masking rule as donations_public. An anonymous scanner holding the
    -- printed label gets the area, never the street address.
    case when public.can_see_exact(d) then d.pickup_lat else round(d.pickup_lat, 2) end,
    case when public.can_see_exact(d) then d.pickup_lng else round(d.pickup_lng, 2) end,
    case when public.can_see_exact(d) then d.pickup_address else null end,
    public.can_see_exact(d),
    coalesce(
      (select ev.reason from public.donation_events ev
        where ev.donation_id = d.id and ev.to_status = d.status
        order by ev.created_at desc limit 1),
      d.outcome_reason
    )
  from public.donations d
  join public.profiles p on p.id = d.donor_id
  where d.id = p_id
    -- A draft was never published. A leaked draft id must not become a window
    -- into an unpublished donation.
    and d.status <> 'draft';
$$;

comment on function public.public_trace(uuid) is
  'One donation by id, for the public trace page and the QR passport. Returns the five reg 6(3) label fields plus the surplus-food record. Location is masked unless can_see_exact(). Drafts are never returned. Readable by anon: the unguessable id is the capability.';

-- ---------- the chain of custody --------------------------------------------

create or replace function public.public_trace_events(p_id uuid)
returns table (
  from_status donation_status,
  to_status   donation_status,
  actor_role  user_role,
  note        text,
  reason      failure_reason,
  created_at  timestamptz
)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select ev.from_status, ev.to_status, ev.actor_role, ev.note, ev.reason, ev.created_at
  from public.donation_events ev
  join public.donations d on d.id = ev.donation_id
  where ev.donation_id = p_id
    and d.status <> 'draft'
  order by ev.created_at;
$$;

-- actor_id is deliberately NOT returned. The timeline needs to show that a
-- volunteer collected the food at 21:05; it does not need to name which user
-- account that was to a stranger scanning a label.
comment on function public.public_trace_events(uuid) is
  'Chain of custody for one donation: role, timestamp, and reason per transition. actor_id is withheld — a public label should prove the handoff happened without identifying the individuals.';

-- ---------- grants ----------------------------------------------------------
--
-- PostgreSQL grants EXECUTE on new functions to PUBLIC by default, which would
-- make these callable by roles we have not considered. Revoke, then grant
-- explicitly to the two roles that should have them.

revoke all on function public.public_trace(uuid)        from public;
revoke all on function public.public_trace_events(uuid) from public;

grant execute on function public.public_trace(uuid)        to anon, authenticated;
grant execute on function public.public_trace_events(uuid) to anon, authenticated;

-- Verify the capability boundary with the anon key:
--   select * from public_trace('<a real donation id>');   -- one row
--   select * from public_trace('<a draft id>');           -- zero rows
--   select * from donations_public;                       -- denied (0012)
