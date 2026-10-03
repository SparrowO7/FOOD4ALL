import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import StatusBadge from '@/components/StatusBadge';
import FoodTypeBadge from '@/components/FoodTypeBadge';
import type { Donation } from '@/types/database';

export default async function DonationsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; food_type?: string }>;
}) {
  const params = await searchParams;
  const supabase = await createClient();
  let q = supabase.from('donations_public').select('*').order('created_at', { ascending: false }).limit(50);
  if (params.status) q = q.eq('status', params.status);
  if (params.food_type) q = q.eq('food_type', params.food_type);
  const { data, error } = await q;

  const activeFilter = params.status ?? params.food_type ?? '';

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-extrabold tracking-tight dark:text-white">Donations</h1>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">Privacy-masked until claimed/assigned · State machine enforced</p>
        </div>
        <Link href="/donations/new" className="rounded-full bg-brand-600 px-6 py-3 text-sm font-extrabold text-white shadow-soft hover:bg-brand-700">
          + New donation
        </Link>
      </div>

      <div className="flex flex-wrap gap-2">
        {[
          { label: 'All', href: '/donations', active: !activeFilter },
          { label: 'Available', href: '/donations?status=available', active: params.status === 'available' },
          { label: 'Claimed', href: '/donations?status=claimed', active: params.status === 'claimed' },
          { label: 'Pickup scheduled', href: '/donations?status=pickup_scheduled', active: params.status === 'pickup_scheduled' },
          { label: 'Veg', href: '/donations?food_type=veg', active: params.food_type === 'veg' },
          { label: 'Non-Veg', href: '/donations?food_type=nonveg', active: params.food_type === 'nonveg' },
        ].map((f) => (
          <Link
            key={f.href}
            href={f.href}
            className={`rounded-full border px-4 py-2 text-sm font-bold shadow-soft ${f.active ? 'border-slate-900 bg-slate-900 text-white dark:border-white dark:bg-white dark:text-slate-900' : 'bg-white hover:bg-slate-50 dark:border-white/10 dark:bg-white/5 dark:text-slate-200 dark:hover:bg-white/10'}`}
          >
            {f.label}
          </Link>
        ))}
      </div>

      {error && <p className="rounded-2xl bg-red-50 p-4 text-sm text-red-700 dark:bg-red-950/40 dark:text-red-200">{error.message}</p>}
      {!data?.length && !error && (
        <div className="rounded-[20px] border border-dashed bg-white p-10 text-center shadow-soft dark:border-white/15 dark:bg-slate-900/60">
          <div className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-slate-900 text-white dark:bg-white dark:text-slate-900">🍱</div>
          <p className="mt-3 font-bold dark:text-white">No donations yet</p>
          <p className="mx-auto mt-1 max-w-md text-sm text-slate-600 dark:text-slate-400">Create one to get started — donors publish, NGOs claim, volunteers deliver. Demo tip: publish with a future <code>best_before</code>.</p>
          <Link href="/donations/new" className="mt-4 inline-flex rounded-full bg-brand-600 px-5 py-2.5 text-sm font-extrabold text-white hover:bg-brand-700">Create donation</Link>
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {(data as Donation[] | null)?.map((d) => (
          <Link key={d.id} href={`/donations/${d.id}`} className="group relative overflow-hidden rounded-[20px] border bg-white p-5 shadow-soft transition hover:shadow-card dark:border-white/10 dark:bg-slate-900/60">
            <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-brand-600 to-emerald-600 opacity-80" />
            <div className="flex items-center justify-between gap-2">
              <FoodTypeBadge type={d.food_type as never} />
              <StatusBadge status={d.status as never} />
            </div>
            <h3 className="mt-3 line-clamp-1 font-display font-extrabold leading-tight group-hover:text-brand-700 dark:text-white dark:group-hover:text-brand-300">{d.title}</h3>
            <p className="line-clamp-2 text-sm leading-relaxed text-slate-600 dark:text-slate-400">{d.description ?? d.quantity_desc}</p>
            <div className="mt-3 flex flex-wrap gap-2 text-xs font-semibold">
              {d.servings_estimate ? <span className="rounded-full border bg-slate-50 px-2.5 py-1 dark:border-white/10 dark:bg-white/5 dark:text-slate-300">{d.servings_estimate} servings</span> : null}
              <span className="rounded-full border bg-white px-2.5 py-1 dark:border-white/10 dark:bg-white/5 dark:text-slate-300">{new Date(d.best_before).toLocaleString()}</span>
            </div>
            <div className="mt-3 flex items-center gap-1.5 text-xs font-medium text-slate-500 dark:text-slate-400">
              <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
              {(d as unknown as { address_revealed?: boolean }).address_revealed ? <span className="line-clamp-1">{d.pickup_address}</span> : 'Approx. location only (claim to reveal)'}
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
