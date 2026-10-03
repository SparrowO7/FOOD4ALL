# Food4All

A nonprofit, volunteer-driven food-rescue platform for India. A restaurant with
surplus food publishes it; a verified NGO claims it; a volunteer picks it up and
delivers it. Every handoff is recorded, and every state change is enforced by
the database rather than by trust.

Built as a final-year project on entirely free infrastructure — **₹0/month** at
demo scale, with no paid map, geocoding, or notification APIs.

---

## The idea worth stealing from this repo

> **Normally, business logic lives in backend code. Here it lives inside the database.**

A donation moves through a strict lifecycle:

```
draft → available → claimed → pickup_scheduled → picked_up → delivered → completed
                                                            ↘ cancelled / expired
```

That lifecycle is not enforced by an API layer that could be bypassed. It is
enforced in Postgres, twice:

1. **One guarded `SECURITY DEFINER` RPC** — `transition_donation()` is the only
   write path for `status`. It checks the caller's role against the requested
   transition, takes a `for update` row lock (so two NGOs cannot claim the same
   donation in the same millisecond), re-checks food freshness, applies side
   effects, and writes an audit row — all in one transaction.
2. **A `BEFORE UPDATE` trigger safety net** — even if someone reaches the table
   directly, an illegal `status` change is rejected.

The RPC is a door; the trigger is a wall. You need both, because a door can be
walked around.

Row-Level Security then decides *rows*, not transitions: a signed-out visitor
sees only `available` donations, with the street address nulled and coordinates
rounded to two decimal places (~1.1 km of deliberate fuzz). The exact address
appears only once an NGO has claimed it or a volunteer has been assigned.

---

## Stack, and why each piece was chosen

| Layer | Chosen | Why this one |
|---|---|---|
| Framework | Next.js 15 (App Router) + React 19 | Server Components keep secrets server-side by default; one deployable |
| Database | Supabase Postgres | Enums, CHECK constraints, RLS, and functions — the four things that let logic live in the DB |
| Auth | Supabase Auth (GoTrue) | Issues a JWT whose claims RLS policies read directly, so authz needs no extra service |
| Styling | Tailwind CSS 3.4 | Zero runtime cost — it compiles to plain CSS |
| Maps | **Leaflet + OpenStreetMap tiles** | MIT-licensed, no key, no per-load billing |
| Geocoding | **Nominatim**, via a server-side proxy | Free; proxied so we can send a policy-compliant `User-Agent`, enforce the 1 req/sec limit once, and cache |
| Distance | **Haversine in SQL/TS** | No geo extension needed for "nearest pickup" sorting at this scale |
| Scheduling | **pg_cron** | Expiry sweep runs inside the database, degrading gracefully if the extension is absent |
| Hosting | Vercel + Supabase free tiers | ₹0 |

Full reasoning for every choice — including what a paid alternative would buy,
and what each free choice actually costs — is in
[`Food4All_Build_Notes.md`](Food4All_Build_Notes.md).

---

## Security work

Seven reachable holes were found and closed, each with a migration and a test
that proves the fix:

| # | Hole | Fix |
|---|---|---|
| 1 | Anyone could self-register as **admin** via `signUp({ data: { role: 'admin' } })` | Role clamped to an allowlist in `handle_new_user()` (`0007`) |
| 2 | Any user could then `update profiles set role = 'admin'` | `BEFORE UPDATE` trigger (`0007`) |
| 3 | An NGO could mark **itself** verified | `BEFORE UPDATE` trigger (`0007`) |
| 4 | A donor could insert a donation already `completed`, fabricating impact | INSERT policy pinning `status = 'draft'` (`0006`) |
| 5 | Signed-out impact counters read zero | `public_impact()` — a definer function returning aggregates only (`0004`) |
| 6 | Missing role sub-rows broke the first claim | Sub-row created at signup (`0004`) |
| 7 | A missing coordinate saved as `0`, a real point in the Atlantic | `parseCoord()` rejects absence explicitly, and range-checks |

**The limitation worth understanding:** holes 2 and 3 cannot be fixed with an
RLS policy. An UPDATE policy's `USING` clause sees the OLD row and `WITH CHECK`
sees the NEW one — never both at once. "You may edit your row, but not *this
column*" is exactly an OLD-vs-NEW comparison, so it needs a trigger.

---

## Running it

```bash
npm install
cp .env.local.example .env.local   # fill in your Supabase URL + anon key
npm run dev
```

Database setup, including the apply order for the eight SQL files and the two
manual dashboard steps, is in [`supabase/README.md`](supabase/README.md).

### Tests

```bash
node scripts/e2e-test.mjs
```

Drives a real donation through the full lifecycle as three separate logged-in
users, then asserts that illegal transitions, wrong-role actions, impact
fabrication and privilege escalation are all rejected.

```
Result: 27 passed, 0 failed
```

The test signs in with the **anon** key, never the service-role key — the
service key bypasses RLS, which would make every security assertion in the
suite vacuously true.

---

## Known gaps

Listed honestly rather than hidden; see the Build Notes for impact and effort
estimates on each.

- Photo upload is URL-only (no Supabase Storage bucket yet)
- No notifications — an NGO has to open the app to see a new donation
- `volunteers.total_pickups` is self-writable; cosmetic, since impact figures
  are derived from `donations` and `deliveries`, not from that column
- Geocoding rate-limit state is per-instance memory, so it is not strictly
  enforced across concurrent serverless instances
- Nearest-pickup sorting uses Haversine over a B-tree index, which is not a
  spatial index; PostGIS + GiST is the correct answer beyond a few thousand rows

---

## Licence

MIT.

Map data © [OpenStreetMap](https://www.openstreetmap.org/copyright) contributors.
