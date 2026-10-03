import Link from 'next/link';
import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import StatusBadge from '@/components/StatusBadge';
import FoodTypeBadge from '@/components/FoodTypeBadge';
import DonationActions from '@/components/DonationActions';
import FreshnessMeter from '@/components/FreshnessMeter';
import TraceTimeline from '@/components/TraceTimeline';
import QRShareCard from '@/components/QRShareCard';
import TrustSafetyCard from '@/components/TrustSafetyCard';
// Imported plainly, not via next/dynamic: `ssr: false` is not permitted from a
// Server Component. It costs nothing here — LocationMap is a client component
// whose heavy dependency (Leaflet) is itself dynamically imported inside a
// useEffect, so it is already kept out of the server render and off the
// critical path.
import LocationMap from '@/components/LocationMap';
import type { DonationStatus } from '@/types/database';

export default async function DonationDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

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

  const status = row['status'] as DonationStatus;
  const donorId = row['donor_id'] as string;
  const claimedBy = row['claimed_by_ngo'] as string | null;
  const assigned = row['assigned_volunteer'] as string | null;
  const isOwner = user?.id === donorId;
  const isClaimingNgo = user?.id === claimedBy;
  const isAssignedVolunteer = user?.id === assigned;
  let role: string | null = null;
  if (user) {
    const { data } = await supabase.from('profiles').select('role').eq('id', user.id).single();
    role = (data as { role: string } | null)?.role ?? null;
  }
  const { data: events } = await supabase.from('donation_events').select('*').eq('donation_id', id).order('created_at', { ascending: true });
  const { data: delivery } = await supabase.from('deliveries').select('*').eq('donation_id', id).single();
  const pickupLat = row['pickup_lat'] as number;
  const pickupLng = row['pickup_lng'] as number;
  const revealed = ((row as { address_revealed?: boolean }).address_revealed ?? (isOwner || isClaimingNgo || isAssignedVolunteer || role === 'admin')) as boolean;
  const address = revealed ? (row['pickup_address'] as string) : 'Hidden until claimed/assigned';
  const mapsUrl = `https://www.openstreetmap.org/?mlat=${pickupLat}&mlon=${pickupLng}#map=16/${pickupLat}/${pickupLng}`;
  const gmapsUrl = `https://www.google.com/maps/dir/?api=1&destination=${pickupLat},${pickupLng}`;
  const bestBefore = row['best_before'] as string;
  const origin = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://food4all.example';
  const traceUrl = `${origin}/trace/${id}`;

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Link href="/donations" className="inline-flex items-center gap-1.5 rounded-full border bg-white px-4 py-2 text-sm font-bold shadow-soft hover:bg-slate-50 dark:border-white/10 dark:bg-white/5 dark:text-white dark:hover:bg-white/10">← Back to donations</Link>
        <Link href={`/trace/${id}`} className="rounded-full bg-slate-900 px-4 py-2 text-sm font-bold text-white hover:bg-black dark:bg-white dark:text-slate-900">Trace this food →</Link>
      </div>

      <div className="overflow-hidden rounded-[28px] border bg-white shadow-card dark:border-white/10 dark:bg-slate-900/70">
        <div className="h-1.5 bg-gradient-to-r from-brand-600 via-emerald-600 to-teal-600" />
        <div className="p-6 sm:p-8">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <FoodTypeBadge type={row['food_type'] as never} />
                <StatusBadge status={status} />
                <span className="rounded-full border bg-slate-50 px-2.5 py-1 text-xs font-bold dark:border-white/10 dark:bg-white/5 dark:text-slate-200">{row['is_cooked'] ? 'Cooked' : 'Uncooked'} · {row['storage_condition'] as string}</span>
              </div>
              <h1 className="font-display mt-3 text-2xl font-extrabold tracking-tight dark:text-white sm:text-3xl">{row['title'] as string}</h1>
              {row['description'] ? <p className="mt-2 max-w-2xl text-slate-600 dark:text-slate-300">{String(row['description'])}</p> : null}
            </div>
            {isOwner && status === 'draft' && (
              <Link href={`/donations/${id}/edit`} className="rounded-full border bg-white px-5 py-2.5 text-sm font-bold shadow-soft hover:bg-slate-50 dark:border-white/10 dark:bg-white/5 dark:text-white dark:hover:bg-white/10">Edit draft</Link>
            )}
          </div>

          <div className="mt-6">
            <FreshnessMeter bestBefore={bestBefore} preparedAt={row['prepared_at'] as string | null} storage={row['storage_condition'] as string} status={status} />
          </div>

          <div className="mt-6 grid gap-3 rounded-[20px] bg-slate-50 p-4 dark:bg-white/[0.04] sm:grid-cols-2 text-sm">
            <div className="rounded-2xl bg-white p-4 shadow-soft dark:bg-slate-800/60"><div className="text-xs font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">Quantity</div><div className="mt-1 font-semibold dark:text-white">{String(row['quantity_desc'])} {row['servings_estimate'] ? `· ${String(row['servings_estimate'])} servings` : ''}</div></div>
            <div className="rounded-2xl bg-white p-4 shadow-soft dark:bg-slate-800/60"><div className="text-xs font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">Best before</div><div className="mt-1 font-semibold dark:text-white">{new Date(bestBefore).toLocaleString()} {new Date(bestBefore) < new Date() ? '⚠️ expired' : ''}</div></div>
            <div className="rounded-2xl bg-white p-4 shadow-soft dark:bg-slate-800/60"><div className="text-xs font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">Pickup window</div><div className="mt-1 font-semibold dark:text-white">{new Date(row['pickup_window_start'] as string).toLocaleString()} → {new Date(row['pickup_window_end'] as string).toLocaleString()}</div></div>
            <div className="rounded-2xl bg-white p-4 shadow-soft dark:bg-slate-800/60"><div className="text-xs font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">Food safety</div><div className="mt-1 font-semibold dark:text-white">{row['allergens'] ? `Allergens: ${String(row['allergens'])}` : 'No allergen note'} {row['prepared_at'] ? `· Prepared ${new Date(String(row['prepared_at'])).toLocaleString()}` : ''}</div></div>
            <div className="sm:col-span-2 rounded-2xl bg-white p-4 shadow-soft dark:bg-slate-800/60">
              <div className="text-xs font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">Pickup</div>
              <div className="mt-1 font-semibold dark:text-white">{address} {row['pickup_landmark'] ? `· ${String(row['pickup_landmark'])}` : ''} {!revealed && <span className="font-normal text-amber-700 dark:text-amber-300">(approx. {Number(pickupLat).toFixed(2)}, {Number(pickupLng).toFixed(2)})</span>}</div>
              {Number.isFinite(pickupLat) && Number.isFinite(pickupLng) && (
                <div className="mt-3">
                  <LocationMap lat={Number(pickupLat)} lng={Number(pickupLng)} revealed={revealed} />
                </div>
              )}
              <div className="mt-3 flex flex-wrap gap-2">
                <a href={mapsUrl} target="_blank" rel="noreferrer" className="rounded-full border bg-white px-4 py-2 text-xs font-bold shadow-soft hover:bg-slate-50 dark:border-white/10 dark:bg-white/5 dark:text-white dark:hover:bg-white/10">Open in OSM</a>
                <a href={gmapsUrl} target="_blank" rel="noreferrer" className="rounded-full bg-slate-900 px-4 py-2 text-xs font-bold text-white hover:bg-black dark:bg-white dark:text-slate-900">Directions</a>
                {!revealed && <span className="rounded-full bg-amber-50 px-3 py-1 text-xs font-bold text-amber-800 dark:bg-amber-950/50 dark:text-amber-200">🔒 Exact address revealed after claim/assign</span>}
              </div>
            </div>
          </div>

          <div className="mt-6 rounded-[20px] border bg-white p-4 shadow-soft dark:border-white/10 dark:bg-white/[0.04]">
            <h3 className="text-sm font-extrabold uppercase tracking-widest text-slate-700 dark:text-slate-300">Actions</h3>
            <div className="mt-3">
              <DonationActions id={id} status={status} role={role} isOwner={isOwner} isClaimingNgo={isClaimingNgo} isAssignedVolunteer={isAssignedVolunteer} />
            </div>
          </div>
        </div>
      </div>

      <div className="rounded-[20px] border bg-white p-6 shadow-soft dark:border-white/10 dark:bg-slate-900/60">
        <h3 className="font-display font-extrabold dark:text-white">Trace — where it goes</h3>
        <p className="mt-1 text-xs text-slate-600 dark:text-slate-400">World-class gap #1: public, QR-verifiable chain of custody. One link proves the journey — no login needed.</p>
        <div className="mt-4">
          <TraceTimeline events={(events as never) ?? []} status={status} />
        </div>
        {delivery && (
          <div className="mt-4 rounded-2xl bg-slate-50 p-4 dark:bg-white/5">
            <div className="text-xs font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">Proof of delivery</div>
            <div className="mt-2 flex flex-wrap gap-2 text-sm dark:text-slate-200">
              <span className="rounded-full border bg-white px-3 py-1 dark:border-white/10 dark:bg-slate-800">Servings: <strong>{(delivery as { servings_delivered: number | null }).servings_delivered ?? '—'}</strong></span>
              <span className="rounded-full border bg-white px-3 py-1 dark:border-white/10 dark:bg-slate-800">Delivered: <strong>{new Date((delivery as { delivered_at: string }).delivered_at).toLocaleString()}</strong></span>
            </div>
            {(delivery as { proof_photo_url: string | null }).proof_photo_url && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={(delivery as { proof_photo_url: string }).proof_photo_url} alt="proof" className="mt-3 max-h-72 rounded-2xl border object-contain dark:border-white/10" />
            )}
          </div>
        )}
      </div>

      <QRShareCard traceUrl={traceUrl} id={id} />

      <TrustSafetyCard />

      <div className="rounded-[20px] border bg-white p-5 shadow-soft dark:border-white/10 dark:bg-slate-900/60">
        <h3 className="text-sm font-extrabold dark:text-white">Suggest &amp; address — let&apos;s tackle world-class lacks</h3>
        <ul className="mt-3 grid gap-2 text-xs leading-relaxed text-slate-600 dark:text-slate-300">
          <li><strong className="dark:text-white">Suggest:</strong> add volunteer training checklist + temp log at pickup (Phase 3). <strong className="dark:text-white">Address:</strong> disclaimer + hard expiry guard already live.</li>
          <li><strong className="dark:text-white">Suggest:</strong> WhatsApp deep-link for volunteer groups (free). <strong className="dark:text-white">Address:</strong> no paid SMS — in-app + WA handoff.</li>
          <li><strong className="dark:text-white">Suggest:</strong> cold-chain later. <strong className="dark:text-white">Address:</strong> asset-light wedge: events/weddings first, point-to-point.</li>
        </ul>
      </div>
    </div>
  );
}
