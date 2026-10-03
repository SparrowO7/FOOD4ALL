export default function TrustSafetyCard({ compact = false }: { compact?: boolean }) {
  return (
    <div className={`rounded-[20px] border bg-white shadow-soft dark:border-white/10 dark:bg-slate-900/60 ${compact ? 'p-4' : 'p-5'}`}>
      <div className="flex items-center gap-2">
        <span className="grid h-7 w-7 place-items-center rounded-full bg-emerald-600 text-xs font-black text-white">✓</span>
        <h3 className="text-sm font-extrabold dark:text-white">Trust &amp; safety — by design</h3>
      </div>
      <ul className="mt-3 space-y-2 text-xs leading-relaxed text-slate-600 dark:text-slate-300">
        <li><strong className="text-slate-900 dark:text-white">FSSAI-aligned fields:</strong> veg/non-veg, prepared_at, best_before, storage, allergens — mandatory. India-relevant first-class.</li>
        <li><strong className="text-slate-900 dark:text-white">Not a guarantor:</strong> India has no US-style Good Samaritan shield — Food4All is a <em>coordination platform</em>. Donors/NGOs use judgement; we enforce the window + show disclaimers at claim.</li>
        <li><strong className="text-slate-900 dark:text-white">Tamper-evident:</strong> every transition logged in <code>donation_events</code> with actor + timestamp; trigger blocks illegal state jumps even if app is bypassed.</li>
        <li><strong className="text-slate-900 dark:text-white">Privacy:</strong> exact address/phone masked in <code>donations_public</code> until assigned — RLS enforced, not just UI.</li>
      </ul>
      <p className="mt-3 rounded-xl bg-amber-50 p-2.5 text-xs font-semibold text-amber-800 dark:bg-amber-950/30 dark:text-amber-200">
        Disclaimer shown at claim: verify freshness on pickup; Food4All does not warrant safety — coordinate, don&apos;t guarantee.
      </p>
    </div>
  );
}
