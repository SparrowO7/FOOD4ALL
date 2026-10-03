import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import ImpactCards from '@/components/ImpactCards';
import GapsTackled from '@/components/GapsTackled';
import type { ImpactSummary } from '@/types/database';

export default async function HomePage() {
  let impact: ImpactSummary | null = null;
  try {
    const supabase = await createClient();
    // public_impact() is SECURITY DEFINER and returns aggregates only, so these
    // counters are real even for a signed-out visitor (the impact_summary view
    // is RLS-scoped and would always read zero here).
    const { data } = await supabase.rpc('public_impact').single();
    if (data) impact = data as ImpactSummary;
  } catch {}

  return (
    <div className="space-y-12">
      {/* HERO */}
      <section className="relative overflow-hidden rounded-[28px] border bg-white shadow-card dark:border-white/10 dark:bg-slate-900/70 dark:shadow-none">
        <div className="absolute inset-0 bg-mesh opacity-60 dark:opacity-[0.18]" />
        <div className="absolute -right-24 -top-24 h-80 w-80 rounded-full bg-brand-200/40 blur-3xl dark:bg-brand-500/20" />
        <div className="absolute -left-24 -bottom-24 h-80 w-80 rounded-full bg-accent-200/40 blur-3xl dark:bg-accent-500/15" />
        <div className="relative grid gap-8 p-7 sm:p-10 md:grid-cols-[1.15fr_.85fr]">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border bg-white px-3 py-1 text-xs font-bold tracking-wide text-slate-700 shadow-soft dark:border-white/10 dark:bg-white/10 dark:text-slate-200">
              <span className="h-2 w-2 animate-pulse rounded-full bg-emerald-500" /> Nonprofit · Volunteer-driven · Campus pilot
            </div>
            <h1 className="font-display mt-4 text-4xl font-extrabold leading-[0.95] tracking-tight text-slate-900 dark:text-white sm:text-5xl">
              Surplus food
              <span className="block bg-gradient-to-r from-brand-600 to-emerald-700 bg-clip-text text-transparent dark:from-brand-400 dark:to-emerald-400">finds a home</span>
              <span className="block text-3xl font-bold tracking-tight text-slate-700 dark:text-slate-300 sm:text-4xl">in hours, not days.</span>
            </h1>
            <p className="mt-4 max-w-xl text-[15px] leading-relaxed text-slate-600 dark:text-slate-300">
              Food4All connects <strong className="text-slate-900 dark:text-white">donors</strong> (restaurants, weddings, campuses) with nearby{' '}
              <strong className="text-slate-900 dark:text-white">NGOs</strong> and <strong className="text-slate-900 dark:text-white">volunteers</strong> who rescue food before it expires.
              Every handoff is tracked by a verified state machine.
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <Link href="/donations/new" className="rounded-full bg-brand-600 px-6 py-3 text-sm font-extrabold text-white shadow-soft hover:bg-brand-700">
                Donate Food — 60s
              </Link>
              <Link href="/donations" className="rounded-full border bg-white px-6 py-3 text-sm font-bold shadow-soft hover:bg-slate-50 dark:border-white/15 dark:bg-white/10 dark:text-white dark:hover:bg-white/15">
                Browse Donations
              </Link>
              <Link href="/auth/signup" className="rounded-full bg-slate-900 px-6 py-3 text-sm font-bold text-white shadow-soft hover:bg-black dark:bg-white dark:text-slate-900 dark:hover:bg-slate-100">
                Join as NGO / Volunteer
              </Link>
            </div>
            <div className="mt-4 flex flex-wrap gap-2 text-xs font-semibold text-slate-600 dark:text-slate-300">
              <span className="rounded-full border bg-white px-3 py-1 dark:border-white/10 dark:bg-white/5">4 roles: Donor · NGO · Volunteer · Admin</span>
              <span className="rounded-full border bg-white px-3 py-1 dark:border-white/10 dark:bg-white/5">Privacy: address revealed only after claim/assign</span>
            </div>
          </div>

          <div className="relative">
            <div className="rounded-3xl border bg-slate-900 p-5 text-white shadow-float dark:border-white/10 dark:bg-slate-900">
              <div className="text-xs font-bold uppercase tracking-widest text-slate-300">How it works</div>
              <ol className="mt-4 space-y-3 text-sm">
                {[
                  { k: '01', t: 'Donor publishes', d: 'Photo + freshness window required' },
                  { k: '02', t: 'NGO claims', d: 'Address revealed · Realtime ping' },
                  { k: '03', t: 'Volunteer delivers', d: 'OSM / Google deep-link · Proof on delivery' },
                  { k: '04', t: 'NGO confirms', d: 'Completed → impact counted' },
                ].map((s) => (
                  <li key={s.k} className="flex gap-3 rounded-2xl bg-white/10 p-3">
                    <span className="grid h-8 w-8 place-items-center rounded-xl bg-white text-xs font-black text-slate-900">{s.k}</span>
                    <div>
                      <div className="font-bold">{s.t}</div>
                      <div className="text-xs text-slate-300">{s.d}</div>
                    </div>
                  </li>
                ))}
              </ol>
              <div className="mt-4 rounded-2xl bg-white/10 p-3 text-xs leading-relaxed text-slate-200">
                FSSAI-aligned: <strong>veg/non-veg</strong> mandatory, <code>prepared_at → best_before</code> enforced, auto-expired by cron.
              </div>
            </div>
            <div className="absolute -bottom-4 -left-4 hidden rounded-2xl border bg-white px-4 py-3 shadow-card dark:border-white/10 dark:bg-slate-800 sm:flex items-center gap-3">
              <div className="grid h-10 w-10 place-items-center rounded-xl bg-accent-500 text-white font-black">✓</div>
              <div>
                <div className="text-sm font-extrabold dark:text-white">No paid map APIs</div>
                <div className="text-xs text-slate-600 dark:text-slate-400">Leaflet/OSM + Haversine — free forever.</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* IMPACT */}
      {impact ? (
        <section>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-extrabold uppercase tracking-widest text-slate-700 dark:text-slate-300">Live impact — verifiable, never invented</h2>
            <Link href="/impact" className="text-sm font-bold text-brand-700 hover:underline dark:text-brand-400">View breakdown →</Link>
          </div>
          <ImpactCards data={impact} />
        </section>
      ) : (
        <section className="rounded-3xl border bg-white p-6 shadow-soft dark:border-white/10 dark:bg-slate-900/60">
          <h2 className="font-extrabold dark:text-white">Impact starts with your first completed delivery</h2>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">Complete one donation end-to-end and the counters begin counting — meals, volunteers, partner NGOs, and even expired/missed for honesty.</p>
        </section>
      )}

      {/* FEATURE GRID */}
      <section className="grid gap-4 md:grid-cols-3">
        {[
          { title: 'For Donors', desc: 'Restaurants, hotels, banquets & individuals. Publish in 60 seconds with photo & pickup window.', cta: 'Create a donation', href: '/donations/new', grad: 'from-emerald-600 to-teal-600' },
          { title: 'For NGOs', desc: 'Browse available donations near you, claim, and dispatch a volunteer — address unmasked on claim.', cta: 'Browse donations', href: '/donations', grad: 'from-blue-600 to-indigo-600' },
          { title: 'For Volunteers', desc: 'Accept nearby pickups, navigate via external maps (no paid API), and log proof on delivery.', cta: 'View dashboard', href: '/dashboard', grad: 'from-amber-600 to-orange-600' },
        ].map((c) => (
          <div key={c.title} className="group relative overflow-hidden rounded-3xl border bg-white p-6 shadow-soft transition hover:shadow-card dark:border-white/10 dark:bg-slate-900/60">
            <div className={`absolute -right-10 -top-10 h-32 w-32 rounded-full bg-gradient-to-br ${c.grad} opacity-10 blur-2xl group-hover:opacity-20`} />
            <div className={`inline-flex rounded-xl bg-gradient-to-br ${c.grad} px-3 py-1 text-xs font-black uppercase tracking-wide text-white`}>{c.title}</div>
            <p className="mt-3 text-sm leading-relaxed text-slate-600 dark:text-slate-300">{c.desc}</p>
            <Link href={c.href} className="mt-5 inline-flex items-center gap-1.5 rounded-full border bg-white px-4 py-2 text-sm font-bold shadow-soft hover:bg-slate-50 dark:border-white/10 dark:bg-white/5 dark:text-white dark:hover:bg-white/10">
              {c.cta} <span>→</span>
            </Link>
          </div>
        ))}
      </section>

      <GapsTackled />

      {/* TRACE DEMO */}
      <section className="rounded-[28px] border bg-white p-6 shadow-card dark:border-white/10 dark:bg-slate-900/60 sm:p-7">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h3 className="font-display text-lg font-extrabold dark:text-white">Trace the food — where it goes, one link</h3>
          <Link href="/donations" className="rounded-full bg-slate-900 px-4 py-2 text-sm font-bold text-white hover:bg-black dark:bg-white dark:text-slate-900">Try a live trace →</Link>
        </div>
        <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">World-class platforms hide the journey. We make it public and QR-verifiable — chain of custody from donation to served.</p>
        <div className="mt-4 grid gap-3 sm:grid-cols-4 text-xs">
          {[
            { k: 'Donor', v: 'Publishes with FSSAI fields' },
            { k: 'NGO', v: 'Claims · trace updates' },
            { k: 'Volunteer', v: 'Pickup → delivered + proof' },
            { k: 'Public', v: 'QR /trace/:id — no login' },
          ].map((s) => (
            <div key={s.k} className="rounded-2xl border bg-slate-50 p-3 dark:border-white/10 dark:bg-white/5">
              <div className="text-xs font-black uppercase tracking-wide dark:text-white">{s.k}</div>
              <div className="text-slate-600 dark:text-slate-400">{s.v}</div>
            </div>
          ))}
        </div>
        <p className="mt-3 text-xs text-slate-500 dark:text-slate-400">Suggest: add temperature-at-pickup + volunteer badge in Phase 3. Address today: hard freshness guard + full audit trail + masked address RLS.</p>
      </section>

      {/* TRUST / TECH */}
      <section className="grid gap-4 md:grid-cols-[1.2fr_.8fr]">
        <div className="rounded-3xl border bg-white p-6 shadow-soft dark:border-white/10 dark:bg-slate-900/60">
          <h3 className="font-display text-lg font-extrabold dark:text-white">Tech you can defend in your viva</h3>
          <ul className="mt-3 grid gap-2 text-sm text-slate-700 dark:text-slate-300">
            <li className="flex gap-2"><span className="mt-1 h-1.5 w-1.5 rounded-full bg-brand-600" /> Single guarded <code>transition_donation()</code> RPC + DB trigger — UI never writes <code>status</code> directly (RLS blocks it).</li>
            <li className="flex gap-2"><span className="mt-1 h-1.5 w-1.5 rounded-full bg-brand-600" /> Row-Level Security per role; masked <code>donations_public</code> view for privacy.</li>
            <li className="flex gap-2"><span className="mt-1 h-1.5 w-1.5 rounded-full bg-brand-600" /> Haversine nearest-volunteer query + Leaflet/OSM + Nominatim — zero paid map billing.</li>
            <li className="flex gap-2"><span className="mt-1 h-1.5 w-1.5 rounded-full bg-brand-600" /> Full audit trail in <code>donation_events</code>; impact counters derived from real rows.</li>
          </ul>
        </div>
        <div className="rounded-3xl bg-slate-900 p-6 text-white shadow-card dark:border dark:border-white/10">
          <div className="text-sm font-extrabold uppercase tracking-widest text-slate-300">Campus pilot playbook</div>
          <p className="mt-3 text-sm leading-relaxed text-slate-200">Seed <strong>3–5 NGOs</strong> + a core volunteer group <em>before</em> onboarding donors. Then unlock <strong>event / wedding surplus</strong> in one city.</p>
          <div className="mt-4 flex flex-wrap gap-2">
            <Link href="/donations" className="rounded-full bg-white px-4 py-2 text-sm font-bold text-slate-900 hover:bg-slate-100">Explore available</Link>
            <Link href="/auth/signup" className="rounded-full border border-white/20 bg-white/10 px-4 py-2 text-sm font-bold hover:bg-white/20">Create account</Link>
          </div>
        </div>
      </section>

      {/* FINAL CTA */}
      <section className="relative overflow-hidden rounded-[28px] bg-gradient-to-br from-brand-700 via-emerald-700 to-teal-700 p-8 text-white shadow-card dark:from-brand-800 dark:via-emerald-800 dark:to-teal-800">
        <div className="absolute -right-20 -top-20 h-72 w-72 rounded-full bg-white/10 blur-3xl" />
        <div className="relative flex flex-wrap items-center justify-between gap-6">
          <div>
            <h3 className="font-display text-2xl font-extrabold">Ready to rescue food today?</h3>
            <p className="mt-1 text-sm text-emerald-100">Publish a donation, or claim one near you. The state machine handles the rest.</p>
          </div>
          <div className="flex gap-3">
            <Link href="/donations/new" className="rounded-full bg-white px-6 py-3 text-sm font-extrabold text-emerald-800 hover:bg-emerald-50">Donate now</Link>
            <Link href="/dashboard" className="rounded-full border border-white/30 bg-white/10 px-6 py-3 text-sm font-bold hover:bg-white/20">Open dashboard</Link>
          </div>
        </div>
      </section>
    </div>
  );
}
