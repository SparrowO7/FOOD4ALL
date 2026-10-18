-- ============================================================================
-- Food4All — 0010a_rejected_enum.sql
--
-- Adds ONE enum value and nothing else. Run this file on its own, before
-- 0010b_rejected_transitions.sql.
--
-- Why two files:
--   PostgreSQL permits ALTER TYPE ... ADD VALUE inside a transaction block on
--   modern versions, but the new value CANNOT BE REFERENCED until that
--   transaction commits. Putting the ADD VALUE and the functions that mention
--   'rejected' in one script fails with:
--       ERROR: unsafe use of new value "rejected" of enum type donation_status
--   Splitting the migration is the fix, not a style preference.
--
-- Why the state exists at all:
--   Schedule-I 2(4) of the Surplus Food Regulations 2019 expressly contemplates
--   food found unfit — "Food that is not fit for human consumption shall be put
--   in a container clearly marked as 'Food for Disposal'". Before this change
--   'picked_up' had exactly one outgoing edge, to 'delivered'
--   (0003_state_machine.sql:20). An NGO refusing food at the door therefore had
--   no honest path: admin surgery on the row, or marking it 'delivered', which
--   writes a falsehood into the table we intend to rely on as evidence.
-- ============================================================================

alter type donation_status add value if not exists 'rejected';

-- Confirm before running 0010b:
--   select unnest(enum_range(null::donation_status));
