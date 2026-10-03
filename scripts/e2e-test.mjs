/**
 * Food4All — end-to-end lifecycle test.
 *
 * Drives a real donation through the full state machine against the live
 * Supabase project, as three separate logged-in users (donor, NGO, volunteer)
 * using the anon/publishable key — exactly the path a browser takes. It also
 * asserts that ILLEGAL and WRONG-ROLE transitions are rejected, which is the
 * whole point of the guarded transition_donation() RPC.
 *
 * Logs in as the demo accounts from supabase/seed/demo_seed.sql. Run that seed
 * first. (Falls back to creating throwaway accounts via signUp(), which only
 * works if "Confirm email" is OFF in Supabase Auth.)
 *
 * Run:  node scripts/e2e-test.mjs
 */
import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'node:fs';

// ---- env ------------------------------------------------------------------
const env = Object.fromEntries(
  readFileSync(new URL('../.env.local', import.meta.url), 'utf8')
    .split('\n')
    .filter((l) => l.trim() && !l.startsWith('#') && l.includes('='))
    .map((l) => [l.slice(0, l.indexOf('=')).trim(), l.slice(l.indexOf('=') + 1).trim()]),
);
const URL_ = env.NEXT_PUBLIC_SUPABASE_URL;
const KEY = env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
if (!URL_ || !KEY) {
  console.error('Missing Supabase env vars in .env.local');
  process.exit(1);
}

// ---- tiny test harness ----------------------------------------------------
let pass = 0;
let fail = 0;
const ok = (label, extra = '') => {
  pass++;
  console.log(`  PASS  ${label}${extra ? ` — ${extra}` : ''}`);
};
const bad = (label, detail) => {
  fail++;
  console.log(`  FAIL  ${label}${detail ? ` — ${detail}` : ''}`);
};
const skip = (label, why) => console.log(`  SKIP  ${label}${why ? ` — ${why}` : ''}`);
const step = (n, t) => console.log(`\n[${n}] ${t}`);

const client = () => createClient(URL_, KEY);

const DEMO = {
  donor: 'demo.donor@food4all.dev',
  ngo: 'demo.ngo@food4all.dev',
  volunteer: 'demo.volunteer@food4all.dev',
  admin: 'demo.admin@food4all.dev',
};
const DEMO_PASSWORD = 'Food4All!demo123';

/**
 * Sign in as the seeded demo account for a role. If the seed has not been run,
 * fall back to creating a throwaway account (needs "Confirm email" OFF).
 */
async function actor(role, name) {
  const supabase = client();
  const { data, error } = await supabase.auth.signInWithPassword({
    email: DEMO[role],
    password: DEMO_PASSWORD,
  });
  if (!error && data.session) return { supabase, user: data.user, how: 'seeded login' };

  const fresh = client();
  const email = `f4a-${role}-${Date.now()}-${Math.floor(Math.random() * 1e4)}@food4all.dev`;
  const { data: su, error: suErr } = await fresh.auth.signUp({
    email,
    password: DEMO_PASSWORD,
    options: { data: { role, full_name: name, phone: '9000000000' } },
  });
  if (suErr) {
    throw new Error(
      `cannot get a ${role} session — seeded login failed (${error?.message}) ` +
        `and signUp failed (${suErr.message}). Run supabase/seed/demo_seed.sql.`,
    );
  }
  if (!su.session) {
    throw new Error(
      `signUp(${role}) returned no session: "Confirm email" is ON. ` +
        `Run supabase/seed/demo_seed.sql to get pre-confirmed accounts instead.`,
    );
  }
  return { supabase: fresh, user: su.user, how: 'fresh signUp' };
}

async function statusOf(supabase, id) {
  const { data } = await supabase.from('donations').select('status').eq('id', id).single();
  return data?.status ?? null;
}

// ---- the run --------------------------------------------------------------
console.log('Food4All — end-to-end lifecycle test');
console.log('='.repeat(60));

try {
  // 1. accounts + role sub-rows (migration 0004 trigger)
  step(1, 'Get a session for each role (donor / NGO / volunteer)');
  const donor = await actor('donor', 'Test Donor Kitchen');
  ok('donor session', donor.how);
  const ngo = await actor('ngo', 'Test Shelter Trust');
  ok('ngo session', ngo.how);
  const vol = await actor('volunteer', 'Test Volunteer');
  ok('volunteer session', vol.how);

  step(2, 'Trigger created the role sub-rows (fix A from migration 0004)');
  const { data: ngoRow, error: ngoErr } = await ngo.supabase
    .from('ngos').select('id, org_name').eq('id', ngo.user.id).maybeSingle();
  ngoRow ? ok('ngos row exists', ngoRow.org_name ?? '(no name)')
         : bad('ngos row missing', ngoErr?.message ?? 'not found — trigger did not fire');
  const { data: volRow, error: volErr } = await vol.supabase
    .from('volunteers').select('id, is_available').eq('id', vol.user.id).maybeSingle();
  volRow ? ok('volunteers row exists', `available=${volRow.is_available}`)
         : bad('volunteers row missing', volErr?.message ?? 'not found — trigger did not fire');

  // 2. donor creates a donation
  step(3, 'Donor creates a donation (DRAFT)');
  const now = Date.now();
  const iso = (ms) => new Date(now + ms).toISOString();
  const payload = {
    donor_id: donor.user.id,
    title: 'E2E test — 40 veg thalis',
    description: 'Automated lifecycle test donation.',
    food_type: 'veg',
    is_cooked: true,
    quantity_desc: '40 thalis in 2 trays',
    servings_estimate: 40,
    prepared_at: iso(-30 * 60 * 1000),
    best_before: iso(4 * 60 * 60 * 1000),
    storage_condition: 'hot_held',
    pickup_address: 'Test Campus Mess, Block C',
    pickup_landmark: 'Near main gate',
    pickup_lat: 26.8467,
    pickup_lng: 80.9462,
    pickup_window_start: iso(15 * 60 * 1000),
    pickup_window_end: iso(3 * 60 * 60 * 1000),
    status: 'draft',
  };
  const { data: created, error: createErr } = await donor.supabase
    .from('donations').insert(payload).select('id, status').single();
  if (createErr) throw new Error(`create donation: ${createErr.message}`);
  const id = created.id;
  ok('donation created', `status=${created.status}`);

  // 3. THE KEY TEST: illegal transition must be rejected
  step(4, 'Guard rejects an ILLEGAL transition (draft -> delivered)');
  const { error: illegalErr } = await donor.supabase.rpc('transition_donation', {
    p_id: id, p_to: 'delivered', p_note: 'should be rejected', p_volunteer: null,
  });
  if (illegalErr) ok('rejected as designed', illegalErr.message.split('\n')[0]);
  else bad('ILLEGAL TRANSITION WAS ALLOWED', 'the state machine is not protecting the lifecycle');
  const afterIllegal = await statusOf(donor.supabase, id);
  afterIllegal === 'draft' ? ok('status unchanged', `still ${afterIllegal}`)
                           : bad('status changed by illegal call', String(afterIllegal));

  // 4. also: a non-owner must not be able to publish
  step(5, 'Guard rejects a WRONG-ROLE action (NGO tries to publish donor\'s draft)');
  const { error: wrongRole } = await ngo.supabase.rpc('transition_donation', {
    p_id: id, p_to: 'available', p_note: null, p_volunteer: null,
  });
  wrongRole ? ok('rejected as designed', wrongRole.message.split('\n')[0])
            : bad('NGO published another user\'s draft', 'ownership check missing');

  // 5. happy path
  step(6, 'Happy path: DRAFT -> AVAILABLE -> CLAIMED -> PICKUP_SCHEDULED -> PICKED_UP -> DELIVERED -> COMPLETED');
  const hop = async (actor, to, label, extra = {}) => {
    const { error } = await actor.supabase.rpc('transition_donation', {
      p_id: id, p_to: to, p_note: label, p_volunteer: null, ...extra,
    });
    if (error) { bad(`${label} (-> ${to})`, error.message.split('\n')[0]); return false; }
    const s = await statusOf(actor.supabase, id);
    s === to ? ok(`${label} -> ${to}`) : bad(`${label} -> ${to}`, `status is ${s}`);
    return s === to;
  };

  await hop(donor, 'available', 'donor publishes');
  await hop(ngo, 'claimed', 'ngo claims');
  await hop(vol, 'pickup_scheduled', 'volunteer self-accepts');
  await hop(vol, 'picked_up', 'volunteer marks picked up');

  // delivery proof row, then the delivered transition
  const { error: delErr } = await vol.supabase.from('deliveries').insert({
    donation_id: id,
    volunteer_id: vol.user.id,
    ngo_id: ngo.user.id,
    servings_delivered: 38,
    recipient_note: 'E2E test delivery',
  });
  delErr ? bad('deliveries row insert', delErr.message.split('\n')[0])
         : ok('deliveries row inserted', '38 servings');

  await hop(vol, 'delivered', 'volunteer marks delivered');
  await hop(ngo, 'completed', 'ngo confirms receipt');

  // 6. audit trail
  step(7, 'Audit trail recorded every transition');
  const { data: events } = await donor.supabase
    .from('donation_events')
    .select('from_status, to_status, actor_role')
    .eq('donation_id', id)
    .order('created_at', { ascending: true });
  if (events?.length) {
    ok(`${events.length} events logged`);
    console.log('        ' + events.map((e) => `${e.from_status}->${e.to_status}(${e.actor_role})`).join('  '));
  } else {
    bad('no events logged', 'donation_events is empty');
  }

  // 7. impact counters moved (public, signed-out view)
  step(8, 'Public impact counters reflect the completed donation (fix B)');
  const anon = client();
  const { data: impact, error: impErr } = await anon.rpc('public_impact').single();
  if (impErr) bad('public_impact()', impErr.message);
  else {
    console.log('        ', JSON.stringify(impact));
    impact.donations_completed > 0 ? ok('donations_completed > 0', String(impact.donations_completed))
                                  : bad('donations_completed still 0', 'aggregate not visible publicly');
    impact.meals_served > 0 ? ok('meals_served > 0', String(impact.meals_served))
                            : bad('meals_served still 0', 'deliveries not counted');
  }

  // 8. privacy: a signed-out visitor must not see the pickup address
  step(9, 'Privacy: signed-out visitor cannot read the exact pickup address');
  const { data: pub } = await anon
    .from('donations_public').select('id, pickup_address, address_revealed').eq('id', id).maybeSingle();
  if (!pub) ok('completed donation not listed publicly', 'RLS hides non-available rows');
  else if (pub.pickup_address === null) ok('address masked', `address_revealed=${pub.address_revealed}`);
  else bad('ADDRESS LEAKED to anonymous caller', String(pub.pickup_address));

  // ---- privilege guards (migrations 0006 / 0007) ---------------------------
  step(10, 'Donor cannot fabricate a COMPLETED donation (migration 0006)');
  const { error: fabErr } = await donor.supabase
    .from('donations').insert({ ...payload, status: 'completed' });
  fabErr
    ? ok('rejected as designed', fabErr.message.split('\n')[0])
    : bad('DONOR INSERTED A COMPLETED DONATION', 'public impact counters can be inflated with no handoff');

  step(11, 'User cannot promote themselves to admin (migration 0007)');
  const { error: escErr } = await donor.supabase
    .from('profiles').update({ role: 'admin' }).eq('id', donor.user.id);
  if (escErr) {
    ok('rejected as designed', escErr.message.split('\n')[0]);
  } else {
    const { data: me } = await donor.supabase
      .from('profiles').select('role').eq('id', donor.user.id).single();
    if (me?.role === 'admin') {
      bad('PRIVILEGE ESCALATION', 'a donor made themselves admin — unmasked access to every donor address');
      await donor.supabase.from('profiles').update({ role: 'donor' }).eq('id', donor.user.id);
      console.log('        (reverted the test account back to donor)');
    } else {
      ok('role unchanged', `still ${me?.role}`);
    }
  }

  step(12, 'NGO cannot change its own verification status (migration 0007)');
  const { error: verErr } = await ngo.supabase
    .from('ngos').update({ verification_status: 'pending' }).eq('id', ngo.user.id);
  if (verErr) {
    ok('rejected as designed', verErr.message.split('\n')[0]);
  } else {
    const { data: n } = await ngo.supabase
      .from('ngos').select('verification_status').eq('id', ngo.user.id).single();
    if (n?.verification_status === 'pending') {
      bad('SELF-VERIFICATION', 'an NGO granted itself the platform trust badge');
      await ngo.supabase.from('ngos').update({ verification_status: 'verified' }).eq('id', ngo.user.id);
      console.log('        (restored verified so the demo data stays consistent)');
    } else {
      ok('verification unchanged', String(n?.verification_status));
    }
  }

  step(13, 'Signup cannot request the admin role (migration 0007)');
  {
    const probe = client();
    const { data: pd, error: pe } = await probe.auth.signUp({
      email: `f4a-esc-${Date.now()}@food4all.dev`,
      password: DEMO_PASSWORD,
      options: { data: { role: 'admin', full_name: 'Escalation probe' } },
    });
    if (pe || !pd?.session) {
      skip('signup role clamp', pe ? pe.message : '"Confirm email" is ON, so no session to inspect');
    } else {
      const { data: pr } = await probe
        .from('profiles').select('role').eq('id', pd.user.id).single();
      pr?.role === 'donor'
        ? ok('admin request clamped to donor')
        : bad('SIGNED UP AS ADMIN', `role=${pr?.role} — anyone can become admin from the signup form`);
    }
  }

  // ---- auto-expiry sweeper (migration 0005) --------------------------------
  step(14, 'Auto-expiry sweeper moves a stale donation to EXPIRED (migration 0005)');
  const adminSess = await client().auth.signInWithPassword({
    email: DEMO.admin, password: DEMO_PASSWORD,
  });
  if (adminSess.error || !adminSess.data.session) {
    skip('expiry sweep', `no admin session (${adminSess.error?.message ?? 'no session'}) — run the demo seed`);
  } else {
    const admin = createClient(URL_, KEY);
    await admin.auth.setSession(adminSess.data.session);

    const { data: stale, error: staleErr } = await donor.supabase
      .from('donations')
      .insert({ ...payload, title: 'E2E test — stale donation for expiry sweep', status: 'draft' })
      .select('id').single();
    if (staleErr) {
      bad('create donation for expiry test', staleErr.message.split('\n')[0]);
    } else {
      const { error: pubErr } = await donor.supabase.rpc('transition_donation', {
        p_id: stale.id, p_to: 'available', p_note: 'publish for expiry test', p_volunteer: null,
      });
      if (pubErr) bad('publish for expiry test', pubErr.message.split('\n')[0]);

      // Backdate the freshness window (admin is allowed to edit donations).
      const { error: backErr } = await admin
        .from('donations')
        .update({ best_before: new Date(Date.now() - 60_000).toISOString() })
        .eq('id', stale.id);
      if (backErr) {
        bad('backdate best_before as admin', backErr.message.split('\n')[0]);
      } else {
        const { data: swept, error: sweepErr } = await admin.rpc('admin_expire_stale_donations');
        if (sweepErr) {
          bad('admin_expire_stale_donations()', sweepErr.message.split('\n')[0]);
        } else {
          ok('sweeper ran', `${swept} donation(s) expired`);
          const s = await statusOf(admin, stale.id);
          s === 'expired' ? ok('stale donation is now expired')
                          : bad('stale donation not expired', `status is ${s}`);
          const { data: ev } = await admin
            .from('donation_events').select('to_status, actor_id, note')
            .eq('donation_id', stale.id).eq('to_status', 'expired').maybeSingle();
          if (!ev) bad('no audit row for the expiry', 'the sweep must be auditable too');
          else if (ev.actor_id === null) ok('audit row attributes it to the system', 'actor_id is null');
          else bad('expiry attributed to a person', `actor_id=${ev.actor_id}`);
        }
      }
    }
  }
} catch (e) {
  fail++;
  console.log(`\n  ERROR  ${e.message}`);
}

console.log('\n' + '='.repeat(60));
console.log(`Result: ${pass} passed, ${fail} failed`);
process.exit(fail > 0 ? 1 : 0);
