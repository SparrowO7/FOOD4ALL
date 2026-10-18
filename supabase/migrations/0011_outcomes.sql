-- ============================================================================
-- Food4All — 0011_outcomes.sql
--
-- Answers "Rescue failed — why?" for the case 0010b cannot cover.
--
-- The problem: expire_stale_donations() (0005) moves stale rows to 'expired'
-- from a cron job with no auth.uid(). It writes an honest audit row saying the
-- system did it — and it genuinely does not know WHY nobody collected the food.
-- Requiring a reason there would force the sweeper to invent one, which is the
-- same failure as a mandatory temperature column with no thermometer.
--
-- So reasons arrive by two different routes, and the schema says which:
--
--   donation_events.reason   recorded AT the transition, by the person who
--                            ended it. Immutable, part of the audit trail.
--   donations.outcome_reason recorded AFTER the fact, when a human reviews an
--                            expired donation and says what went wrong.
--                            Write-once, attributed, timestamped.
--
-- A single column could not carry both without lying about provenance. The
-- donation_outcomes view coalesces them and reports which source answered.
-- ============================================================================

-- ---------- post-hoc annotation ---------------------------------------------

alter table public.donations
  add column if not exists outcome_reason failure_reason,
  add column if not exists outcome_note   text,
  add column if not exists outcome_set_by uuid references public.profiles(id),
  add column if not exists outcome_set_at timestamptz;

comment on column public.donations.outcome_reason is
  'Why this donation failed, recorded after the fact — used for rows the system expired, where no human was present to give a reason at the transition. Write-once via annotate_outcome().';

-- ---------- the write-once, attributed annotation RPC -----------------------

create or replace function public.annotate_outcome(
  p_id     uuid,
  p_reason failure_reason,
  p_note   text default null
)
returns public.donations
language plpgsql
security definer set search_path = public, pg_temp
as $$
declare
  d      public.donations;
  v_uid  uuid      := auth.uid();
  v_role user_role := public.app_role(auth.uid());
begin
  if v_uid is null then
    raise exception 'Not authenticated' using errcode = '28000';
  end if;
  if p_reason is null then
    raise exception 'A reason is required' using errcode = 'check_violation';
  end if;
  if p_reason = 'other' and coalesce(btrim(p_note), '') = '' then
    raise exception 'reason "other" requires a note explaining it'
      using errcode = 'check_violation';
  end if;

  select * into d from public.donations where id = p_id for update;
  if not found then
    raise exception 'Donation % not found', p_id using errcode = 'no_data_found';
  end if;

  -- Only a finished donation has an outcome to explain. Annotating a live one
  -- would let a reason drift out of step with the status it describes.
  if d.status not in ('expired', 'cancelled', 'rejected') then
    raise exception 'Only a failed donation can be annotated (status is %)', d.status
      using errcode = 'check_violation';
  end if;

  -- Write-once. An outcome that can be edited is not evidence of anything, and
  -- the whole reason this table exists is that the record has to hold up later.
  if d.outcome_reason is not null then
    raise exception 'This donation already has an outcome reason (%); it cannot be changed',
      d.outcome_reason using errcode = 'check_violation';
  end if;

  -- The donor, the NGO that claimed it, or an admin. A donation that expired
  -- unclaimed has no NGO, which is exactly why the donor is included.
  if not (d.donor_id = v_uid or d.claimed_by_ngo = v_uid or v_role = 'admin') then
    raise exception 'Not allowed to annotate this donation';
  end if;

  update public.donations
     set outcome_reason = p_reason,
         outcome_note   = p_note,
         outcome_set_by = v_uid,
         outcome_set_at = now()
   where id = p_id
   returning * into d;

  return d;
end;
$$;

grant execute on function public.annotate_outcome(uuid, failure_reason, text) to authenticated;

comment on function public.annotate_outcome(uuid, failure_reason, text) is
  'Records why a failed donation failed, after the fact. Write-once, attributed and timestamped. Only for expired/cancelled/rejected rows.';

-- ---------- one place to read the outcome from ------------------------------

create or replace view public.donation_outcomes
with (security_invoker = true) as
select
  d.id,
  d.status,
  d.created_at,
  coalesce(e.reason, d.outcome_reason)             as reason,
  coalesce(e.note,   d.outcome_note)               as reason_note,
  case
    when e.reason          is not null then 'transition'
    when d.outcome_reason  is not null then 'annotated'
    else null
  end                                              as reason_source,
  coalesce(e.created_at, d.outcome_set_at)         as outcome_at,
  e.actor_id                                       as ended_by
from public.donations d
left join lateral (
  select ev.reason, ev.note, ev.created_at, ev.actor_id
  from public.donation_events ev
  where ev.donation_id = d.id
    and ev.to_status   = d.status
  order by ev.created_at desc
  limit 1
) e on true;

comment on view public.donation_outcomes is
  'Terminal outcome per donation, with reason_source saying whether the reason was given at the transition or annotated afterwards. security_invoker: the caller''s RLS on donations applies.';

grant select on public.donation_outcomes to authenticated;

-- A donation that failed and has no reason yet is the pilot's to-do list:
--   select id, status, created_at from public.donation_outcomes
--   where status in ('expired','cancelled','rejected') and reason is null
--   order by created_at;
