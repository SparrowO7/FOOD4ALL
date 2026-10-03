'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { transitionDonation } from '@/lib/actions';
import type { DonationStatus } from '@/types/database';

export default function DonationActions({
  id, status, role, isOwner, isClaimingNgo, isAssignedVolunteer,
}: {
  id: string; status: DonationStatus; role: string | null;
  isOwner: boolean; isClaimingNgo: boolean; isAssignedVolunteer: boolean;
}) {
  const router = useRouter();
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  async function go(to: DonationStatus, extra?: { note?: string; volunteerId?: string }) {
    setBusy(to); setMsg(null);
    const res = await transitionDonation(id, to, extra);
    if ((res as { error?: string })?.error) setMsg((res as { error: string }).error);
    else router.refresh();
    setBusy(null);
  }

  const Btn = ({ to, label, cls, extra }: { to: DonationStatus; label: string; cls: string; extra?: { volunteerId?: string } }) => (
    <button onClick={() => go(to, extra)} disabled={!!busy}
      className={`rounded-full px-4 py-2 text-sm font-bold shadow-soft disabled:opacity-50 ${cls}`}>
      {busy === to ? '…' : label}
    </button>
  );

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        {status === 'draft' && isOwner && <Btn to="available" label="Publish → Available" cls="bg-brand-600 text-white hover:bg-brand-700" />}
        {status === 'draft' && isOwner && <Btn to="cancelled" label="Discard" cls="border bg-white hover:bg-slate-50 dark:border-white/10 dark:bg-white/5 dark:text-white" />}
        {status === 'available' && (role === 'ngo' || role === 'admin') && <Btn to="claimed" label="Claim this donation" cls="bg-blue-600 text-white hover:bg-blue-700" />}
        {status === 'available' && (isOwner || role === 'admin') && <Btn to="cancelled" label="Cancel" cls="border bg-white hover:bg-slate-50 dark:border-white/10 dark:bg-white/5 dark:text-white" />}
        {status === 'claimed' && role === 'volunteer' && <Btn to="pickup_scheduled" label="Accept pickup (self)" cls="bg-amber-600 text-white hover:bg-amber-700" />}
        {status === 'claimed' && (role === 'ngo' || role === 'admin') && isClaimingNgo && <AssignBox onAssign={(vid) => go('pickup_scheduled', { volunteerId: vid })} busy={!!busy} />}
        {status === 'claimed' && (isClaimingNgo || role === 'admin') && <Btn to="available" label="Release back to Available" cls="border bg-white hover:bg-slate-50 dark:border-white/10 dark:bg-white/5 dark:text-white" />}
        {status === 'pickup_scheduled' && isAssignedVolunteer && <Btn to="picked_up" label="Mark picked up" cls="bg-orange-600 text-white hover:bg-orange-700" />}
        {status === 'pickup_scheduled' && (isAssignedVolunteer || isClaimingNgo || role === 'admin') && <Btn to="cancelled" label="Cancel pickup" cls="border bg-white hover:bg-slate-50 dark:border-white/10 dark:bg-white/5 dark:text-white" />}
        {status === 'picked_up' && isAssignedVolunteer && <Btn to="delivered" label="Mark delivered (+ proof next step)" cls="bg-purple-600 text-white hover:bg-purple-700" />}
        {status === 'delivered' && (isClaimingNgo || role === 'admin') && <Btn to="completed" label="Confirm receipt → Completed" cls="bg-emerald-600 text-white hover:bg-emerald-700" />}
      </div>
      <CancelWithReason id={id} visible={['available','claimed','pickup_scheduled'].includes(status) && (isOwner || isClaimingNgo || isAssignedVolunteer || role === 'admin')} />
      {msg && <p className="rounded-2xl bg-red-50 p-3 text-sm font-semibold text-red-700 dark:bg-red-950/40 dark:text-red-200">{msg}</p>}
      <p className="text-xs text-slate-500 dark:text-slate-400">
        All writes via guarded <code>transition_donation()</code> RPC — direct status writes blocked by RLS + trigger.
      </p>
    </div>
  );
}

function AssignBox({ onAssign, busy }: { onAssign: (vid: string) => void; busy: boolean }) {
  const [vid, setVid] = useState('');
  return (
    <span className="inline-flex items-center gap-2 rounded-full border bg-white px-2 py-1 dark:border-white/10 dark:bg-white/5">
      <input value={vid} onChange={(e) => setVid(e.target.value)} placeholder="Volunteer UUID" className="w-56 rounded-full border bg-white px-3 py-1.5 text-xs dark:border-white/10 dark:bg-slate-800 dark:text-white" />
      <button disabled={busy || !vid} onClick={() => onAssign(vid)} className="rounded-full bg-amber-600 px-3 py-1.5 text-xs font-bold text-white disabled:opacity-50">Assign</button>
    </span>
  );
}

function CancelWithReason({ id, visible }: { id: string; visible: boolean }) {
  const [note, setNote] = useState(''); const [show, setShow] = useState(false); const [msg, setMsg] = useState<string | null>(null);
  const router = useRouter(); if (!visible) return null;
  return (
    <div className="rounded-2xl border bg-white p-3 dark:border-white/10 dark:bg-white/5">
      {!show ? <button onClick={() => setShow(true)} className="text-sm font-bold text-slate-700 hover:underline dark:text-slate-300">Cancel with reason…</button> : (
        <div className="flex gap-2">
          <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Reason" className="flex-1 rounded-full border bg-white px-3 py-2 text-sm dark:border-white/10 dark:bg-slate-800 dark:text-white" />
          <button onClick={async () => { const res = await transitionDonation(id, 'cancelled', { note }); if ((res as { error?: string })?.error) setMsg((res as { error: string }).error); else router.refresh(); }} className="rounded-full bg-red-600 px-4 py-2 text-sm font-bold text-white">Confirm cancel</button>
          <button onClick={() => setShow(false)} className="rounded-full border bg-white px-3 py-2 text-sm dark:border-white/10 dark:text-white">Close</button>
        </div>
      )}
      {msg && <p className="mt-2 text-sm font-semibold text-red-600 dark:text-red-300">{msg}</p>}
    </div>
  );
}
