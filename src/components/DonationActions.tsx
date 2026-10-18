'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { transitionDonation } from '@/lib/actions';
import {
  FAILURE_REASON_LABELS,
  type DonationStatus,
  type FailureReason,
} from '@/types/database';

// Which reasons make sense for which ending. Offering the full list everywhere
// invites nonsense entries — "donor cancelled" on a rejection at the door would
// corrupt the one statistic the pilot exists to produce.
const CANCEL_REASONS: FailureReason[] = [
  'donor_cancelled',
  'no_volunteer',
  'ngo_capacity_full',
  'pickup_too_far',
  'insufficient_time',
  'food_below_minimum',
  'donor_unreachable',
  'outside_operating_hours',
  'other',
];

const REJECT_REASONS: FailureReason[] = [
  'food_unsafe',
  'food_below_minimum',
  'insufficient_time',
  'ngo_unreachable',
  'other',
];

export default function DonationActions({
  id, status, role, isOwner, isClaimingNgo, isAssignedVolunteer, volunteers = [],
}: {
  volunteers?: {id:string;full_name:string;vehicle_type:string}[];
  id: string; status: DonationStatus; role: string | null;
  isOwner: boolean; isClaimingNgo: boolean; isAssignedVolunteer: boolean;
}) {
  const router = useRouter();
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [ending, setEnding] = useState<'cancelled' | 'rejected' | null>(null);

  async function go(to: DonationStatus, extra?: { note?: string; volunteerId?: string; reason?: FailureReason }) {
    setBusy(to); setMsg(null);
    try {
      const res = await transitionDonation(id, to, { ...extra, from: status });
      if (res?.error) setMsg(res.error);
      else { setEnding(null); router.refresh(); }
    } catch {
      setMsg('Could not confirm the change. Refresh to check the current status before trying again.');
    } finally { setBusy(null); }
  }

  const Btn = ({ to, label, cls, extra }: { to: DonationStatus; label: string; cls: string; extra?: { volunteerId?: string } }) => (
    <button onClick={() => go(to, extra)} disabled={!!busy}
      className={`rounded-full px-4 py-2 text-sm font-bold shadow-soft disabled:opacity-50 ${cls}`}>
      {busy === to ? '…' : label}
    </button>
  );

  // Opens the reason dialog instead of transitioning straight away, because the
  // database refuses these endings without a structured reason.
  const EndBtn = ({ to, label, cls }: { to: 'cancelled' | 'rejected'; label: string; cls: string }) => (
    <button onClick={() => { setEnding(to); setMsg(null); }} disabled={!!busy}
      className={`rounded-full px-4 py-2 text-sm font-bold shadow-soft disabled:opacity-50 ${cls}`}>
      {label}
    </button>
  );

  const admin = role === 'admin';
  const ghost = 'border bg-white hover:bg-slate-50 dark:border-white/10 dark:bg-white/5 dark:text-white';

  // Cancellation is reachable only while the food has not yet moved. Once it is
  // picked up, the honest endings are 'delivered' or 'rejected' — see
  // is_valid_transition() in 0010b_rejected_transitions.sql.
  const canCancel =
    (status === 'available' && (isOwner || admin)) ||
    (status === 'claimed' && (isOwner || isClaimingNgo || admin)) ||
    (status === 'pickup_scheduled' && (isOwner || isClaimingNgo || isAssignedVolunteer || admin));

  // The receiving side refuses the food. Schedule-I 2(4) of the Surplus Food
  // Regulations contemplates exactly this; before the 'rejected' state existed
  // the only options were admin surgery or marking it delivered, which is a lie.
  const canReject =
    ['pickup_scheduled', 'picked_up', 'delivered'].includes(status) &&
    (isClaimingNgo || isAssignedVolunteer || admin);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        {status === 'draft' && isOwner && <Btn to="available" label="Publish → Available" cls="bg-brand-600 text-white hover:bg-brand-700" />}
        {/* A draft was never published, so discarding it is not a failed rescue
            and needs no reason — matching the exemption in the RPC. */}
        {status === 'draft' && isOwner && <Btn to="cancelled" label="Discard draft" cls={ghost} />}
        {status === 'available' && (role === 'ngo' || admin) && <Btn to="claimed" label="Claim this donation" cls="bg-blue-600 text-white hover:bg-blue-700" />}
        {status === 'claimed' && role === 'volunteer' && <Btn to="pickup_scheduled" label="Accept pickup (self)" cls="bg-amber-600 text-white hover:bg-amber-700" />}
        {status === 'claimed' && (isClaimingNgo || admin) && <Btn to="available" label="Release back to Available" cls={ghost} />}
        {status === 'pickup_scheduled' && isAssignedVolunteer && <Btn to="picked_up" label="Mark picked up" cls="bg-orange-600 text-white hover:bg-orange-700" />}
        {status === 'picked_up' && isAssignedVolunteer && <Btn to="delivered" label="Mark delivered (+ proof next step)" cls="bg-purple-600 text-white hover:bg-purple-700" />}
        {status === 'delivered' && (isClaimingNgo || admin) && <Btn to="completed" label="Confirm receipt → Completed" cls="bg-emerald-600 text-white hover:bg-emerald-700" />}
        {canCancel && <EndBtn to="cancelled" label={status === 'pickup_scheduled' ? 'Cancel pickup' : 'Cancel'} cls={ghost} />}
        {canReject && <EndBtn to="rejected" label="Reject food" cls="bg-rose-600 text-white hover:bg-rose-700" />}
      </div>

      {ending && (
        <ReasonDialog
          kind={ending}
          busy={!!busy}
          onCancel={() => setEnding(null)}
          onConfirm={(reason, note) => go(ending, { reason, note })}
        />
      )}

      {msg && <p className="rounded-2xl bg-red-50 p-3 text-sm font-semibold text-red-700 dark:bg-red-950/40 dark:text-red-200">{msg}</p>}
      <p className="text-xs text-slate-500 dark:text-slate-400">
        Collection and distribution are recorded by the receiving organisation.
      </p>
    </div>
  );
}

/**
 * One dialog for both endings. The reason is a choice from a closed list, not a
 * sentence: the pilot has to be able to count how often each cause occurred, and
 * free text cannot be counted because everyone phrases it differently.
 */
function ReasonDialog({
  kind, busy, onCancel, onConfirm,
}: {
  kind: 'cancelled' | 'rejected';
  busy: boolean;
  onCancel: () => void;
  onConfirm: (reason: FailureReason, note?: string) => void;
}) {
  const reasons = kind === 'rejected' ? REJECT_REASONS : CANCEL_REASONS;
  const [reason, setReason] = useState<FailureReason | ''>('');
  const [note, setNote] = useState('');

  const noteRequired = reason === 'other';
  const ready = reason !== '' && (!noteRequired || note.trim().length > 0);

  return (
    <div className="space-y-3 rounded-2xl border bg-white p-4 dark:border-white/10 dark:bg-white/5">
      <div>
        <h4 className="text-sm font-extrabold dark:text-slate-100">
          {kind === 'rejected' ? 'Why is this food being refused?' : 'Why is this donation ending?'}
        </h4>
        <p className="mt-0.5 text-xs text-slate-600 dark:text-slate-400">
          {kind === 'rejected'
            ? 'Refused food must be recorded as refused, not as delivered. This becomes part of the donation record.'
            : 'This is recorded permanently and is what tells us where food rescue actually breaks.'}
        </p>
      </div>

      <div className="grid gap-2 sm:grid-cols-2">
        {reasons.map((r) => (
          <label key={r} className={`flex cursor-pointer items-center gap-2 rounded-xl border px-3 py-2 text-sm font-semibold dark:border-white/10 dark:text-white ${reason === r ? 'border-brand-600 bg-brand-50 dark:bg-brand-900/40' : 'bg-white dark:bg-white/5'}`}>
            <input type="radio" name="failure_reason" value={r} checked={reason === r} onChange={() => setReason(r)} className="h-4 w-4 shrink-0" />
            {FAILURE_REASON_LABELS[r]}
          </label>
        ))}
      </div>

      <input
        value={note}
        onChange={(e) => setNote(e.target.value)}
        placeholder={noteRequired ? 'Required: explain briefly' : 'Optional note'}
        className="w-full rounded-full border bg-white px-3 py-2 text-sm dark:border-white/10 dark:bg-slate-800 dark:text-white"
      />

      <div className="flex gap-2">
        <button
          disabled={!ready || busy}
          onClick={() => onConfirm(reason as FailureReason, note.trim() || undefined)}
          className={`rounded-full px-4 py-2 text-sm font-bold text-white disabled:opacity-50 ${kind === 'rejected' ? 'bg-rose-600 hover:bg-rose-700' : 'bg-red-600 hover:bg-red-700'}`}
        >
          {busy ? '…' : kind === 'rejected' ? 'Confirm refusal' : 'Confirm cancel'}
        </button>
        <button onClick={onCancel} className="rounded-full border bg-white px-3 py-2 text-sm dark:border-white/10 dark:text-white">
          Close
        </button>
      </div>
    </div>
  );
}
