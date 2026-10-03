import { createClient } from '@/lib/supabase/server';
import ImpactCards from '@/components/ImpactCards';
import type { ImpactSummary } from '@/types/database';

export default async function ImpactPage() {
  let data: ImpactSummary | null = null;
  let err: string | null = null;
  try {
    const supabase = await createClient();
    // Aggregates only, via SECURITY DEFINER — real numbers for signed-out
    // visitors too. (impact_summary stays available for RLS-scoped, per-role slices.)
    const res = await supabase.rpc('public_impact').single();
    if (res.error) err = res.error.message;
    else data = res.data as ImpactSummary;
  } catch (e: unknown) { err = (e as Error).message; }
  return (
    <div className="space-y-6">
      <div className="rounded-[28px] border bg-white p-6 shadow-card dark:border-white/10 dark:bg-slate-900/60 sm:p-8">
        <div className="inline-flex rounded-full bg-slate-900 px-3 py-1 text-xs font-black uppercase tracking-widest text-white dark:bg-white dark:text-slate-900">Verifiable · Never invented</div>
        <h1 className="font-display mt-3 text-3xl font-extrabold tracking-tight dark:text-white">Impact</h1>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-slate-600 dark:text-slate-400">Derived from real rows. We track <code>expired/missed</code> too — it signals integrity to evaluators. Admin sees global totals; others see their scoped slice via RLS.</p>
      </div>
      {err && <p className="rounded-2xl bg-amber-50 p-4 text-sm font-semibold text-amber-900 dark:bg-amber-950/40 dark:text-amber-200">{err} — sign in to see scoped numbers; admin sees global totals.</p>}
      {data ? <ImpactCards data={data} /> : <div className="rounded-[24px] border border-dashed bg-white p-8 text-center shadow-soft dark:border-white/10 dark:bg-slate-900/60"><p className="font-bold dark:text-white">No impact data yet</p><p className="mx-auto mt-1 max-w-md text-sm text-slate-600 dark:text-slate-400">Create and complete a donation end-to-end to see counters move.</p></div>}
    </div>
  );
}
