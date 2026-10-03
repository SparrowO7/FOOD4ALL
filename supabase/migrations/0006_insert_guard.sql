-- ============================================================================
-- Food4All — 0006_insert_guard.sql
--
-- Closes a real integrity hole found while writing the end-to-end test.
--
-- The donor INSERT policy from 0002 was:
--
--     for insert with check (donor_id = auth.uid()
--                            and public.app_role(auth.uid()) = 'donor')
--
-- It constrains WHO may insert, but not WHAT STATE they may insert in. So a
-- donor could insert a row with status = 'completed' directly and:
--
--   * skip the entire state machine (no NGO ever claimed it, no volunteer ever
--     carried it) — the guarded transition_donation() RPC was simply never
--     called, so there was nothing for it to reject;
--   * inflate the public impact counters, since public_impact() counts rows
--     with status = 'completed';
--   * leave donation_events empty for that donation, so the audit trail would
--     show a completed rescue with no history behind it.
--
-- That directly contradicts the claim the product makes on its own landing
-- page ("Live impact — verifiable, never invented"), so it is worth fixing
-- properly rather than trusting the UI to always send 'draft'.
--
-- Fix: donations may only ENTER the machine at its start. Every state after
-- 'draft' is reachable only through transition_donation(), which is where the
-- role checks, the freshness guard and the audit trail live.
--
-- Note on scope: this is an RLS policy, so it binds anon and authenticated —
-- i.e. every path the app and the browser can take. The service role and the
-- SQL editor bypass RLS by design (that is how supabase/seed/demo_seed.sql can
-- create ready-made 'available' and 'expired' rows for a demo).
-- ============================================================================

drop policy if exists donations_insert_donor on public.donations;

create policy donations_insert_donor on public.donations
  for insert with check (
    donor_id = auth.uid()
    and public.app_role(auth.uid()) = 'donor'
    and status = 'draft'
    -- Belt and braces: a donation cannot be born already claimed or assigned.
    and claimed_by_ngo is null
    and assigned_volunteer is null
  );

comment on policy donations_insert_donor on public.donations is
  'Donors insert their own donations, and only as draft. Every later state is reachable only via transition_donation().';
