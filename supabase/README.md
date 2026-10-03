# Database — apply order

Run these in the Supabase SQL Editor, in this order. Every file is idempotent
(safe to re-run), so if you are unsure whether something applied, run it again.

| # | File | What it does |
|---|------|--------------|
| 1 | `migrations/0001_schema.sql` | Enums, six tables, indexes, the `on_auth_user_created` trigger |
| 2 | `migrations/0002_rls.sql` | `app_role()` / `is_admin()` / `can_see_exact()`, RLS on every table, masked `donations_public` view |
| 3 | `migrations/0003_state_machine.sql` | `is_valid_transition()`, the BEFORE UPDATE safety net, and the single guarded `transition_donation()` RPC |
| 4 | `migrations/0004_fixes.sql` | Role sub-rows created at signup; `public_impact()` so signed-out counters are real |
| 5 | `migrations/0005_expiry.sql` | `expire_stale_donations()` + pg_cron schedule (needs the one-click step below) |
| 6 | `migrations/0006_insert_guard.sql` | Donations may only be inserted as `draft` — closes an impact-inflation hole |
| 7 | `migrations/0007_privilege_guards.sql` | Closes three privilege-escalation holes (self-registered admin, role self-promotion, NGO self-verification) |
| 8 | `seed/demo_seed.sql` | Optional: four pre-confirmed demo accounts + two browsable donations |

## Two manual steps in the dashboard

1. **Enable pg_cron** — Database → Extensions → search `pg_cron` → Enable.
   Then re-run the last `do $$ ... $$` block of `0005_expiry.sql` to register the
   10-minute expiry sweep. Without it everything still works; expiry just has to
   be triggered by an admin (`select public.admin_expire_stale_donations();`).

2. **Turn off "Confirm email"** — Authentication → Sign In / Providers → Email →
   uncheck *Confirm email* → **Save**. Verify it actually took effect:

   ```bash
   curl -s "$NEXT_PUBLIC_SUPABASE_URL/auth/v1/settings" -H "apikey: $NEXT_PUBLIC_SUPABASE_ANON_KEY"
   ```

   You want `"mailer_autoconfirm": true`. This is not just a convenience: the
   free tier's built-in mailer allows roughly **two emails per hour**, so with
   confirmation on, a live demo stops working as soon as the third person signs
   up. The demo accounts in `seed/demo_seed.sql` are confirmed at creation, so
   they log in either way.

## Verifying it all works

```bash
node scripts/e2e-test.mjs
```

Drives a real donation through `draft → available → claimed → pickup_scheduled →
picked_up → delivered → completed` as three separate logged-in users, then
asserts that illegal transitions, wrong-role actions, impact fabrication and
privilege escalation are all rejected.

## Demo logins

Password for all four: `Food4All!demo123`

| Email | Role |
|---|---|
| `demo.donor@food4all.dev` | donor |
| `demo.ngo@food4all.dev` | ngo |
| `demo.volunteer@food4all.dev` | volunteer |
| `demo.admin@food4all.dev` | admin |

## Granting an admin

`admin` cannot be requested at signup on purpose (see `0007`). Grant it in SQL:

```sql
update public.profiles set role = 'admin'
 where id = (select id from auth.users where email = 'you@example.com');
```
