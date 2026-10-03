-- ============================================================================
-- Food4All — 0005_expiry.sql
--
-- Closes the last hole in the state machine: nothing was moving stale donations
-- to EXPIRED. Until now the only path to 'expired' was an admin calling
-- transition_donation() by hand, so a donation past its best_before stayed
-- 'available' forever — the board would advertise food that is no longer safe,
-- and the "missed" counter on the impact page would always read zero.
--
-- Deliberate scope: only 'available' and 'claimed' rows are swept.
--   * pickup_scheduled / picked_up are NOT expired — a volunteer is already en
--     route; that case is a human decision (cancel or complete), not a cron job.
--   * 'draft' is not expired either — an unpublished draft was never offered to
--     anyone, so there is nothing to miss. The donor can edit and publish it.
-- Both swept edges are already legal in is_valid_transition(), so the BEFORE
-- UPDATE trigger validates this sweep like any other transition.
-- ============================================================================

-- ---------- the sweeper ------------------------------------------------------
-- SECURITY DEFINER because it runs with no logged-in user (cron has no
-- auth.uid()). Not granted to anon/authenticated: the only callers are pg_cron
-- and the admin wrapper below.
create or replace function public.expire_stale_donations()
returns integer
language plpgsql
security definer set search_path = public
as $$
declare
  v_count integer := 0;
begin
  with stale as (
    select id, status
    from public.donations
    where best_before <= now()
      and status in ('available', 'claimed')
    for update skip locked          -- never block a live claim/assign
  ),
  bumped as (
    update public.donations d
       set status = 'expired', updated_at = now()
      from stale s
     where d.id = s.id
    returning d.id, s.status as prev_status
  )
  -- actor_id / actor_role stay NULL on purpose: the system expired this, not a
  -- person, and the audit trail should say so.
  insert into public.donation_events (donation_id, from_status, to_status, note)
  select b.id, b.prev_status, 'expired',
         'Auto-expired: best_before passed with no completed handoff.'
  from bumped b;

  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

comment on function public.expire_stale_donations() is
  'Moves available/claimed donations past best_before to expired and writes a system audit row. Called by pg_cron; not callable by app users.';

revoke all on function public.expire_stale_donations() from anon, authenticated;

-- ---------- admin-triggerable version (for demos and manual sweeps) ----------
create or replace function public.admin_expire_stale_donations()
returns integer
language plpgsql
security definer set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'Admin only' using errcode = '42501';
  end if;
  return public.expire_stale_donations();
end;
$$;

grant execute on function public.admin_expire_stale_donations() to authenticated;

comment on function public.admin_expire_stale_donations() is
  'Admin-only wrapper around expire_stale_donations(), so the sweep can be demonstrated on demand without waiting for cron.';

-- ---------- schedule it ------------------------------------------------------
-- pg_cron must be enabled once by hand: Supabase Dashboard -> Database ->
-- Extensions -> search "pg_cron" -> Enable. (One click; creating it from SQL
-- needs privileges the SQL editor does not reliably have.)
--
-- This block is written so the migration SUCCEEDS either way: if pg_cron is not
-- enabled yet it just prints a notice, and you can re-run this one block after
-- enabling it. Everything above still works — expire_stale_donations() is then
-- simply triggered by an admin instead of a timer.
do $$
begin
  if not exists (select 1 from pg_extension where extname = 'pg_cron') then
    raise notice 'pg_cron is not enabled. Enable it under Database -> Extensions, then re-run this DO block. Until then, sweep with: select public.admin_expire_stale_donations();';
    return;
  end if;

  -- Replace any previous schedule so this migration is re-runnable.
  perform cron.unschedule('food4all-expire-stale')
  where exists (select 1 from cron.job where jobname = 'food4all-expire-stale');

  perform cron.schedule(
    'food4all-expire-stale',
    '*/10 * * * *',                 -- every 10 minutes
    $cron$select public.expire_stale_donations();$cron$
  );
  raise notice 'Scheduled food4all-expire-stale every 10 minutes.';
end $$;

-- Check the schedule with:  select jobname, schedule, active from cron.job;
-- Check recent runs with:   select * from cron.job_run_details order by start_time desc limit 10;
