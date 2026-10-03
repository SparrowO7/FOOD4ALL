import type { ImpactSummary } from '@/types/database';

export default function ImpactCards({ data }: { data: ImpactSummary }) {
  const items = [
    { label: 'Meals served', value: data.meals_served, sub: 'delivered servings', grad: 'from-emerald-600 to-teal-600' },
    { label: 'Donations completed', value: data.donations_completed, sub: 'completed lifecycles', grad: 'from-brand-600 to-emerald-600' },
    { label: 'Active volunteers', value: data.active_volunteers, sub: 'assigned pickups', grad: 'from-blue-600 to-indigo-600' },
    { label: 'Partner NGOs', value: data.partner_ngos, sub: 'claiming orgs', grad: 'from-violet-600 to-purple-600' },
    { label: 'Expired / missed', value: data.missed_expired, sub: 'honesty metric', grad: 'from-slate-600 to-slate-800', muted: true },
  ];
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
      {items.map((it) => (
        <div key={it.label} className={`relative overflow-hidden rounded-3xl border bg-white p-4 shadow-soft dark:border-white/10 dark:bg-slate-900/60 ${it.muted ? 'opacity-80' : ''}`}>
          <div className={`absolute -right-6 -top-6 h-20 w-20 rounded-full bg-gradient-to-br ${it.grad} opacity-10 blur-2xl`} />
          <div className={`inline-flex rounded-full bg-gradient-to-br ${it.grad} px-2.5 py-1 text-[10px] font-black uppercase tracking-widest text-white`}>{it.label}</div>
          <div className="mt-3 text-3xl font-black tracking-tight text-slate-900 dark:text-white">{it.value}</div>
          <div className="text-xs font-semibold text-slate-500 dark:text-slate-400">{it.sub}</div>
        </div>
      ))}
    </div>
  );
}
