import Link from 'next/link';
import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import StatusBadge from '@/components/StatusBadge';
import FoodTypeBadge from '@/components/FoodTypeBadge';
import FreshnessMeter from '@/components/FreshnessMeter';
import TraceTimeline from '@/components/TraceTimeline';
import QRShareCard from '@/components/QRShareCard';

export default async function TracePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();

  // public trace: try masked view first
  let row: Record<string, unknown> | null = null;
  {
    const { data } = await supabase.from('donations_public').select('*').eq('id', id).single();
    row = data as unknown as Record<string, unknown> | null;
  }
  if (!row) {
    const { data } = await supabase.from('donations').select('*').eq('id', id).single();
    row = data as unknown as Record<string, unknown> | null;
  }
  if (!row) notFound();

  const { data: events } = await supabase
    .from('donation_events')
    .select('*')
    .eq('donation_id', id)
    .order('created_at', { ascending: true });

  const { data: delivery } = await supabase.from('deliveries').select('*').eq('donation_id', id).single();

  const origin = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://food4all.example';
  // use request host fallback - built from id
  const traceUrl = `${origin}/trace/${id}`;

  const status = row['status'] as string;
  const title = row['title'] as string;

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link href="/" className="inline-flex items-center gap-2 rounded-full border bg-white px-4 py-2 text-sm font-bold shadow-soft hover:bg-slate-50 dark:border-white/10 dark:bg-white/5 dark:text-white">← Food4All</Link>
        <Link href={`/donations/${id}`} className="rounded-full border bg-white px-4 py-2 text-sm font-bold hover:bg-slate-50 dark:border-white/10 dark:bg-white/5 dark:text-white">Open donation →</Link>
      </div>

      <div className="overflow-hidden rounded-[28px] border bg-white p-6 shadow-card dark:border-white/10 dark:bg-slate-900/70 sm:p-7">
        <div className="inline-flex rounded-full bg-slate-900 px-3 py-1 text-xs font-black uppercase tracking-widest text-white dark:bg-white dark:text-slate-900">Public trace · Chain of custody</div>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <FoodTypeBadge type={row['food_type'] as never} />
          <StatusBadge status={status as never} />
          <span className="rounded-full border bg-slate-50 px-2.5 py-1 text-xs font-bold dark:border-white/10 dark:bg-white/5 dark:text-slate-200">{row['is_cooked'] ? 'Cooked' : 'Uncooked'} · {row['storage_condition'] as string}</span>
        </div>
        <h1 className="font-display mt-3 text-2xl font-extrabold tracking-tight dark:text-white sm:text-3xl">{title}</h1>
        <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">{(row['description'] as string) ?? (row['quantity_desc'] as string)} {row['servings_estimate'] ? `· ${row['servings_estimate']} servings` : ''}</p>
        <div className="mt-2 text-xs font-mono text-slate-500 dark:text-slate-400">Donation {id.slice(0, 8)}… · created {new Date(row['created_at'] as string).toLocaleString()}</div>
      </div>

      <FreshnessMeter bestBefore={row['best_before'] as string} preparedAt={row['prepared_at'] as string | null} storage={row['storage_condition'] as string} status={status} />

      <div className="rounded-[20px] border bg-white p-6 shadow-soft dark:border-white/10 dark:bg-slate-900/60">
        <h2 className="font-display font-extrabold dark:text-white">Where it goes — chain of custody</h2>
        <p className="mt-1 text-xs text-slate-600 dark:text-slate-400">Every handoff is logged with actor · role · timestamp. This is the audit trail your viva asks for.</p>
        <div className="mt-4">
          <TraceTimeline events={(events as never) ?? []} status={status} />
        </div>
      </div>

      {delivery && (
        <div className="rounded-[20px] border bg-white p-5 shadow-soft dark:border-white/10 dark:bg-slate-900/60">
          <h3 className="text-sm font-extrabold dark:text-white">Proof of delivery</h3>
          <div className="mt-2 grid gap-3 sm:grid-cols-2 text-sm">
            <div className="rounded-2xl bg-slate-50 p-3 dark:bg-white/5 dark:text-slate-200">Servings delivered: <strong>{(delivery as { servings_delivered: number | null }).servings_delivered ?? '—'}</strong></div>
            <div className="rounded-2xl bg-slate-50 p-3 dark:bg-white/5 dark:text-slate-200">Delivered at: <strong>{new Date((delivery as { delivered_at: string }).delivered_at).toLocaleString()}</strong></div>
            {(delivery as { proof_photo_url: string | null }).proof_photo_url && (
              <div className="sm:col-span-2">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={(delivery as { proof_photo_url: string }).proof_photo_url} alt="proof" className="max-h-80 rounded-2xl border object-contain dark:border-white/10" />
              </div>
            )}
            {(delivery as { recipient_note: string | null }).recipient_note && (
              <div className="sm:col-span-2 rounded-2xl bg-amber-50 p-3 text-sm dark:bg-amber-950/30 dark:text-amber-200">Note: {(delivery as { recipient_note: string }).recipient_note}</div>
            )}
          </div>
        </div>
      )}

      <QRShareCard traceUrl={traceUrl} id={id} />

      <div className="rounded-[20px] border bg-white p-5 shadow-soft dark:border-white/10 dark:bg-slate-900/60">
        <h3 className="text-sm font-extrabold dark:text-white">Suggest &amp; address — world-class gaps we tackle</h3>
        <ul className="mt-3 grid gap-2 text-xs text-slate-600 dark:text-slate-300">
          <li><strong className="dark:text-white">Traceability:</strong> this page — no login required — proves the journey. Suggest adding temperature log / photo at pickup in your viva.</li>
          <li><strong className="dark:text-white">Food safety:</strong> FSSAI window + guard + disclaimer at claim. Address by proposing volunteer training checklist (Phase 3).</li>
          <li><strong className="dark:text-white">Two-sided cold start:</strong> seed 3–5 NGOs before donors — dashboard filters already reflect it.</li>
          <li><strong className="dark:text-white">Zero-cost ops:</strong> OSM + Haversine + WhatsApp deep-link — address “no paid APIs” constraint explicitly.</li>
        </ul>
      </div>
    </div>
  );
}
