import Link from 'next/link';

const GAPS = [
  { vs: 'Too Good To Go / OLIO — marketplace, not hunger relief', fix: 'Free redistribution to hungry — not discounted bags for shoppers. Hunger-first.', icon: '🍱', grad: 'from-emerald-600 to-teal-600' },
  { vs: 'Robin Hood Army — WhatsApp, no backbone', fix: 'The platform they never built: 9-state machine + dispatch + live trace + impact DB.', icon: '📡', grad: 'from-slate-800 to-slate-900' },
  { vs: 'Food Rescue Hero — best blueprint, not in India', fix: 'Hero pattern, localized: veg/non-veg, FSSAI window, OSM/Haversine zero-cost stack.', icon: '🛻', grad: 'from-blue-600 to-indigo-600' },
  { vs: 'Feeding India / No Food Waste — scale, but no open trace', fix: 'Public, QR-verifiable trace — “where it went” is one link, no login.', icon: '🔍', grad: 'from-violet-600 to-purple-600' },
  { vs: 'FareShare / FoodCloud — heavy retail & infra', fix: 'Asset-light: event/wedding wedge + point-to-point, no warehouse/truck campus.', icon: '🏫', grad: 'from-amber-600 to-orange-600' },
  { vs: 'All — trust & safety is hand-wavy', fix: 'FSSAI fields + hard expiry guard + masked address RLS + full audit trail.', icon: '🛡️', grad: 'from-rose-600 to-orange-600' },
];

export default function GapsTackled() {
  return (
    <section className="rounded-[28px] border bg-white p-6 shadow-card dark:border-white/10 dark:bg-slate-900/60 sm:p-7">
      <div className="inline-flex items-center gap-2 rounded-full border bg-slate-900 px-3 py-1 text-xs font-black uppercase tracking-widest text-white dark:border-white/15 dark:bg-white dark:text-slate-900">
        <span className="h-2 w-2 rounded-full bg-emerald-400" /> Where world-class falls short — we fix it
      </div>
      <h2 className="font-display mt-3 text-2xl font-extrabold tracking-tight dark:text-white">Researched gaps → product answers</h2>
      <p className="mt-1 max-w-2xl text-sm text-slate-600 dark:text-slate-400">
        From 11 platforms across 9 dimensions (Phase 1). The qualitative weaknesses are the reliable core — numbers left unverified on purpose.
      </p>
      <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {GAPS.map((g) => (
          <div key={g.vs} className="group relative overflow-hidden rounded-[20px] border bg-white p-4 shadow-soft transition hover:shadow-card dark:border-white/10 dark:bg-slate-900/40">
            <div className={`absolute -right-8 -top-8 h-24 w-24 rounded-full bg-gradient-to-br ${g.grad} opacity-10 blur-2xl`} />
            <div className="text-xs font-bold text-slate-500 dark:text-slate-400 line-clamp-2">vs {g.vs}</div>
            <div className="mt-2 flex gap-2">
              <span className={`grid h-7 w-7 place-items-center rounded-full bg-gradient-to-br ${g.grad} text-xs text-white`}>{g.icon}</span>
              <p className="text-sm font-bold leading-snug dark:text-white">{g.fix}</p>
            </div>
          </div>
        ))}
      </div>
      <div className="mt-5 flex flex-wrap gap-2 text-xs">
        <span className="rounded-full border bg-amber-50 px-3 py-1 font-bold text-amber-800 dark:border-amber-900/30 dark:bg-amber-950/30 dark:text-amber-200">Appendix A rule: don&apos;t quote a number until verified at the named source.</span>
        <Link href="/donations" className="rounded-full border bg-white px-3 py-1 font-bold hover:bg-slate-50 dark:border-white/10 dark:bg-white/5 dark:text-white">See live trace →</Link>
      </div>
    </section>
  );
}
