'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { annotateOutcome } from '@/lib/actions';
import { FAILURE_REASONS, FAILURE_REASON_LABELS, type FailureReason } from '@/types/database';

/**
 * Records why a donation that already failed, failed.
 *
 * Needed because the expiry sweeper (0005_expiry.sql) runs from cron with no
 * logged-in user and genuinely cannot know why nobody collected the food. If the
 * reason were mandatory at that moment, the sweeper would have to invent one.
 * So the question is asked afterwards, of a human who knows the answer.
 *
 * Write-once in the database (0011_outcomes.sql): an outcome that can be edited
 * later is not evidence of anything, and the whole point of this record is that
 * it has to hold up months from now.
 *
 * Without this screen the headline pilot metric — the failure distribution —
 * stays empty no matter how many donations run, because expired rows would never
 * acquire a reason.
 */
export default function OutcomeAnnotation({ id, status }: { id: string; status: string }) {
  const router = useRouter();
  const [reason, setReason] = useState<FailureReason | ''>('');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const noteRequired = reason === 'other';
  const ready = reason !== '' && (!noteRequired || note.trim().length > 0);

  async function submit() {
    setBusy(true); setMsg(null);
    const res = await annotateOutcome(id, reason as FailureReason, note.trim() || undefined);
    if ((res as { error?: string })?.error) setMsg((res as { error: string }).error);
    else router.refresh();
    setBusy(false);
  }

  return (
    <div className="rounded-[20px] border-2 border-dashed border-amber-400 bg-amber-50 p-5 dark:border-amber-700 dark:bg-amber-950/25">
      <h3 className="text-sm font-extrabold text-amber-900 dark:text-amber-200">
        This donation ended as “{status}” — what went wrong?
      </h3>
      <p className="mt-1 text-xs font-semibold text-amber-800 dark:text-amber-300">
        Answer once. This is how we learn where food rescue actually breaks, and it cannot be
        changed afterwards.
      </p>

      <div className="mt-4 grid gap-2 sm:grid-cols-2">
        {FAILURE_REASONS.map((r) => (
          <label
            key={r}
            className={`flex cursor-pointer items-center gap-2 rounded-xl border px-3 py-2 text-sm font-semibold dark:border-white/10 dark:text-white ${
              reason === r ? 'border-amber-600 bg-white dark:bg-white/10' : 'bg-white/70 dark:bg-white/5'
            }`}
          >
            <input
              type="radio"
              name="outcome_reason"
              value={r}
              checked={reason === r}
              onChange={() => setReason(r)}
              className="h-4 w-4 shrink-0"
            />
            {FAILURE_REASON_LABELS[r]}
          </label>
        ))}
      </div>

      <input
        value={note}
        onChange={(e) => setNote(e.target.value)}
        placeholder={noteRequired ? 'Required: explain briefly' : 'Optional detail (e.g. "volunteer cancelled at 21:40")'}
        className="mt-3 w-full rounded-full border bg-white px-3 py-2 text-sm dark:border-white/10 dark:bg-slate-800 dark:text-white"
      />

      <button
        disabled={!ready || busy}
        onClick={submit}
        className="mt-3 rounded-full bg-amber-600 px-5 py-2.5 text-sm font-extrabold text-white hover:bg-amber-700 disabled:opacity-50"
      >
        {busy ? 'Saving…' : 'Record reason'}
      </button>

      {msg && <p className="mt-2 text-sm font-semibold text-red-700 dark:text-red-300">{msg}</p>}
    </div>
  );
}
