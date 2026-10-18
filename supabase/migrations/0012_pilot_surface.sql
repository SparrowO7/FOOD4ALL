-- ============================================================================
-- Food4All — 0012_pilot_surface.sql
--
-- Removes anonymous read access to the public donation board for the duration
-- of the single-city pilot.
--
-- Rationale: the pilot is one NGO, three to five donors and three to five
-- volunteers, all of whom sign in. Nobody needs the board while logged out.
-- But that logged-out grant is the entire outside-adversary surface that the
-- location-masking work exists to defend — a stranger polling the board can
-- watch a venue's donation pattern form over time, and the rounded coordinate
-- is a stable pseudonym for the venue rather than a mask (measured: repeated
-- disclosure of one venue yields exactly one published point).
--
-- Revoking one grant removes that surface completely and costs the pilot
-- nothing. It also decouples the geomasking redesign from the pilot schedule:
-- that work can land later on its own merits instead of blocking Phase 1.
--
-- IMPORTANT, and easy to get wrong: this revokes the `anon` ROLE, not the anon
-- KEY. Supabase clients send the publishable key on every request; a signed-in
-- user's JWT makes PostgREST run as `authenticated`, not `anon`. So e2e tests
-- that sign in are unaffected. Only genuinely logged-out reads change, which is
-- exactly the intent. Any test asserting that a logged-out visitor can see the
-- board must be updated deliberately — do not "fix" it by restoring the grant.
--
-- To undo when the pilot ends:
--   grant select on public.donations_public to anon;
-- Do not undo it before the masking mechanism is replaced.
--
-- NOTE: run 0013_public_trace.sql straight after this one. Revoking this grant
-- on its own also closes /trace/<id> to logged-out visitors, which would kill
-- the QR passport — and that passport is the reg 6(3) label. 0013 restores
-- single-donation lookup by id (a capability, not an enumeration) so the label
-- keeps working while the board stays closed.
-- ============================================================================

revoke select on public.donations_public from anon;

comment on view public.donations_public is
  'Masked donation board. Pilot: authenticated callers only — the anon grant was revoked in 0012 because a logged-out observer can accumulate a venue''s donation pattern, and coordinate rounding is a stable pseudonym rather than a mask. Restore only after the masking mechanism is replaced.';

-- Verify:
--   select grantee, privilege_type from information_schema.role_table_grants
--   where table_name = 'donations_public';
-- Expect 'authenticated' (and the owner), not 'anon'.
