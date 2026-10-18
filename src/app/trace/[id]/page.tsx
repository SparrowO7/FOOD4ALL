import DonationActions from '@/components/DonationActions';
import NgoDistribution from '@/components/NgoDistribution';
import { siteOrigin } from '@/lib/site-origin';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import StatusBadge from '@/components/StatusBadge';
import FoodTypeBadge from '@/components/FoodTypeBadge';
import FreshnessMeter from '@/components/FreshnessMeter';
import TraceTimeline from '@/components/TraceTimeline';
import QRShareCard from '@/components/QRShareCard';
import FoodSafetyLabel from '@/components/FoodSafetyLabel';
import { FAILURE_REASON_LABELS, type FailureReason } from '@/types/database';

type TraceRow = {
  id: string;
  title: string;
  description: string | null;
  food_type: 'veg' | 'nonveg' | 'vegan' | 'jain';
  is_cooked: boolean;
  allergens: string | null;
  quantity_desc: string;
  servings_estimate: number | null;
  prepared_at: string | null;
  best_before: string;
  storage_condition: string;
  batch_no: string | null;
  food_temp_c: number | null;
  is_perishable: boolean;
  status: string;
  created_at: string;
  donor_org_name: string;
  pickup_lat: number;
  pickup_lng: number;
  pickup_address: string | null;
  address_revealed: boolean;
  outcome_reason: FailureReason | null;
};

export default async function TracePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();

  // public_trace() rather than a table read. The board view is closed to
  // anonymous callers (0012_pilot_surface.sql) so that nobody can enumerate
  // donations and watch a venue's pattern form; this RPC takes an id, which is
  // an unguessable uuid, so possession of the printed label is the capability.
  // It is also the only route that works after handoff — the RLS policy on
  // donations only ever exposed `available` rows to a logged-out caller.
  const { data } = await supabase.rpc('public_trace', { p_id: id }).single();
  const row = data as TraceRow | null;
  if (!row) notFound();

  const { data: eventRows } = await supabase.rpc('public_trace_events', { p_id: id });

  const { data: delivery } = await supabase
    .from('deliveries').select('*').eq('donation_id', id).single();

  const origin = await siteOrigin();
  const traceUrl = `${origin}/trace/${id}`;

  const {data:{user}}=await supabase.auth.getUser();
  const {data:party}=user?await supabase.from('donations').select('claimed_by_ngo,assigned_volunteer').eq('id',id).maybeSingle():{data:null};
  const {data:viewer}=user?await supabase.from('profiles').select('role').eq('id',user.id).maybeSingle():{data:null};
  const directNgo=user?.id===party?.claimed_by_ngo&&!party?.assigned_volunteer;
  const failed = ['cancelled', 'expired', 'rejected'].includes(row.status);

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3 print:hidden">
        <Link href="/" className="inline-flex items-center gap-2 rounded-full border bg-white px-4 py-2 text-sm font-bold shadow-soft hover:bg-slate-50 dark:border-white/10 dark:bg-white/5 dark:text-white">← Food4All India</Link>
        <Link href={`/donations/${id}`} className="rounded-full border bg-white px-4 py-2 text-sm font-bold hover:bg-slate-50 dark:border-white/10 dark:bg-white/5 dark:text-white">Open donation →</Link>
      </div>

      <section className="rounded-2xl border bg-white p-5 dark:bg-slate-900 print:hidden"><h2 className="text-lg font-bold">NGO collection & distribution</h2>{!user?<p className="mt-3 text-sm"><Link className="font-semibold underline" href={'/auth/login?next='+encodeURIComponent('/trace/'+id)}>Sign in as the receiving NGO</Link> to record collection or distribution.</p>:viewer?.role==='ngo'&&row.status==='available'?<DonationActions id={id} status={row.status} role="ngo" isOwner={false} isClaimingNgo={false} isAssignedVolunteer={false}/>:directNgo?<NgoDistribution id={id} status={row.status}/>:<p className="mt-3 text-sm">Only the NGO that claimed this batch can record distribution.</p>}{row.status==='completed'&&<p className="mt-3 font-semibold text-green-700 dark:text-green-300">Distribution has already been recorded. Scanning again does not add another count.</p>}{delivery&&<p className="mt-3 text-sm">Reported servings: {delivery.servings_delivered??'—'} · People reached: {delivery.people_reached??'Not recorded'} · Area: {delivery.distribution_area??'Not recorded'}</p>}</section>
      <div className="overflow-hidden rounded-[28px] border bg-white p-6 shadow-card dark:border-white/10 dark:bg-slate-900/70 sm:p-7 print:hidden">
        <div className="inline-flex rounded-full bg-slate-900 px-3 py-1 text-xs font-black uppercase tracking-widest text-white dark:bg-white dark:text-slate-900">Public trace · Chain of custody</div>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <FoodTypeBadge type={row.food_type as never} />
          <StatusBadge status={row.status as never} />
          <span className="rounded-full border bg-slate-50 px-2.5 py-1 text-xs font-bold dark:border-white/10 dark:bg-white/5 dark:text-slate-200">{row.is_cooked ? 'Cooked' : 'Uncooked'} · {row.storage_condition}</span>
          <span className="rounded-full border bg-slate-50 px-2.5 py-1 text-xs font-bold dark:border-white/10 dark:bg-white/5 dark:text-slate-200">{row.is_perishable ? 'Perishable' : 'Non-perishable'}</span>
        </div>
        <h1 className="font-display mt-3 text-2xl font-extrabold tracking-tight dark:text-white sm:text-3xl">{row.title}</h1>
        <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">{row.description ?? row.quantity_desc}{row.servings_estimate ? ` · ${row.servings_estimate} servings` : ''}</p>
        <div className="mt-2 font-mono text-xs text-slate-500 dark:text-slate-400">Donation {id.slice(0, 8)}… · created {new Date(row.created_at).toLocaleString()}</div>
      </div>

      {/* An ending is part of the record. A donation that was refused on safety
          grounds must not read the same as one that completed. */}
      {failed && (
        <div className="rounded-[20px] border-2 border-rose-300 bg-rose-50 p-5 dark:border-rose-900 dark:bg-rose-950/30 print:hidden">
          <h3 className="text-sm font-extrabold text-rose-900 dark:text-rose-200">
            This food was not delivered — {row.status}
          </h3>
          <p className="mt-1 text-sm font-semibold text-rose-800 dark:text-rose-300">
            {row.outcome_reason
              ? FAILURE_REASON_LABELS[row.outcome_reason]
              : 'Reason not yet recorded.'}
          </p>
        </div>
      )}

      {/* The statutory label. reg 6(3) of the Surplus Food Regulations 2019
          requires donated prepared food to carry five things, and all five are
          here — so this card, printed and attached to the container, is not a
          nice-to-have, it is the label the rules ask for. */}
      <FoodSafetyLabel
        id={row.id}
        title={row.title}
        source={row.donor_org_name}
        foodType={row.food_type}
        isCooked={row.is_cooked}
        preparedAt={row.prepared_at}
        bestBefore={row.best_before}
        quantityDesc={row.quantity_desc}
        servings={row.servings_estimate}
        batchNo={row.batch_no}
        foodTempC={row.food_temp_c}
        isPerishable={row.is_perishable}
        storage={row.storage_condition}
        allergens={row.allergens}
        traceUrl={traceUrl}
      />

      <div className="print:hidden">
        <FreshnessMeter bestBefore={row.best_before} preparedAt={row.prepared_at} storage={row.storage_condition} status={row.status} />
      </div>

      <div className="rounded-[20px] border bg-white p-6 shadow-soft dark:border-white/10 dark:bg-slate-900/60 print:hidden">
        <h2 className="font-display font-extrabold dark:text-white">Where it goes — chain of custody</h2>
        <p className="mt-1 text-xs text-slate-600 dark:text-slate-400">Every handoff is logged with role and timestamp. Individual user accounts are deliberately not named on this public page.</p>
        <div className="mt-4">
          <TraceTimeline events={(eventRows as never) ?? []} status={row.status} />
        </div>
      </div>

      {delivery && (
        <div className="rounded-[20px] border bg-white p-5 shadow-soft dark:border-white/10 dark:bg-slate-900/60 print:hidden">
          <h3 className="text-sm font-extrabold dark:text-white">Proof of delivery</h3>
          <div className="mt-2 grid gap-3 text-sm sm:grid-cols-2">
            <div className="rounded-2xl bg-slate-50 p-3 dark:bg-white/5 dark:text-slate-200">Servings delivered: <strong>{(delivery as { servings_delivered: number | null }).servings_delivered ?? '—'}</strong></div>
            <div className="rounded-2xl bg-slate-50 p-3 dark:bg-white/5 dark:text-slate-200">Delivered at: <strong>{new Date((delivery as { delivered_at: string }).delivered_at).toLocaleString()}</strong></div>
            {(delivery as { distribution_area: string | null }).distribution_area && (
              <div className="rounded-2xl bg-slate-50 p-3 dark:bg-white/5 dark:text-slate-200">Distributed in: <strong>{(delivery as { distribution_area: string }).distribution_area}</strong></div>
            )}
            {(delivery as { proof_photo_url: string | null }).proof_photo_url && (
              <div className="sm:col-span-2">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={(delivery as { proof_photo_url: string }).proof_photo_url} alt="proof" className="max-h-80 rounded-2xl border object-contain dark:border-white/10" />
              </div>
            )}
            {(delivery as { recipient_note: string | null }).recipient_note && (
              <div className="rounded-2xl bg-amber-50 p-3 text-sm sm:col-span-2 dark:bg-amber-950/30 dark:text-amber-200">Note: {(delivery as { recipient_note: string }).recipient_note}</div>
            )}
          </div>
        </div>
      )}

      <div className="print:hidden">
        <QRShareCard traceUrl={traceUrl} id={id} />
      </div>
    </div>
  );
}
