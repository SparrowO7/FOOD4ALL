'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { recordDelivery } from '@/lib/actions';
import PhotoField from '@/components/PhotoField';

export default function DeliveryForm({ donationId }: { donationId: string }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();
  async function submit(form: FormData) {
    setBusy(true); setError(null);
    try {
      const result = await recordDelivery(donationId, form);
      if (result.error) setError(result.error);
      else router.refresh();
    } catch { setError('Could not confirm the save. Refresh to check before retrying.'); }
    finally { setBusy(false); }
  }
  const cls = 'mt-1 w-full rounded-xl border p-3 text-slate-900 dark:bg-slate-800 dark:text-white';
  return <form action={submit} className="mt-4 space-y-3 rounded-2xl border p-4">
    <h3 className="font-bold">Record the handover</h3>
    <p className="text-sm">Enter what was actually delivered. The NGO confirms receipt after this record is saved.</p>
    <label className="block text-sm">Servings delivered
      <input className={cls} name="servings" type="number" min="0" step="1" required />
    </label>
    <label className="block text-sm">Distribution area (optional)
      <input className={cls} name="area" maxLength={300} placeholder="Area or food centre; no recipient names" />
    </label>
    <label className="block text-sm">Handover note (optional)
      <textarea className={cls} name="note" maxLength={2000} rows={2} />
    </label>
    {/* Evidence of the handover. Once saved it cannot be replaced — the proof
        bucket has no update or delete policy (0017_storage.sql), because a
        photo that could change after the NGO looked at it would make the NGO's
        confirmation meaningless. */}
    <PhotoField
      name="proof"
      label="Handover photo (optional)"
      hint="Photo of the food with the receiving organisation. Stored privately and cannot be replaced after saving."
    />
    {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
    <button disabled={busy} className="rounded-xl bg-brand-600 px-4 py-2 font-bold text-white disabled:opacity-50">
      {busy ? 'Saving…' : 'Save delivery record'}
    </button>
  </form>;
}
