'use client';
import { useCallback, useState } from 'react';
import dynamic from 'next/dynamic';
import { createDonation, updateDonation } from '@/lib/actions';
import type { Donation } from '@/types/database';

// Leaflet plus its stylesheet is ~45 KB that only this one field needs, and it
// touches `window` on init. Loading it lazily and client-only keeps it out of
// the page's first payload and out of the server render entirely.
const MapPicker = dynamic(() => import('@/components/MapPicker'), {
  ssr: false,
  loading: () => (
    <div className="h-72 w-full animate-pulse rounded-2xl border bg-slate-100 dark:border-white/10 dark:bg-slate-800" />
  ),
});

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="text-sm font-bold dark:text-slate-200">{label} {required && <span className="text-red-600">*</span>}</span>
      <div className="mt-1.5">{children}</div>
    </label>
  );
}

export default function DonationForm({ initial, donationId }: { initial?: Partial<Donation>; donationId?: string }) {
  const [msg, setMsg] = useState<string | null>(null);
  const [ok, setOk] = useState(false);

  // Address and coordinates are controlled here rather than inside MapPicker,
  // because they are two views of one fact: picking a place on the map should
  // fill the address box, and both must stay in sync for the hidden inputs the
  // server action reads. Lifting the state is what keeps them from drifting.
  const [address, setAddress] = useState(initial?.pickup_address ?? '');
  const [lat, setLat] = useState<number | null>(
    typeof initial?.pickup_lat === 'number' ? initial.pickup_lat : null,
  );
  const [lng, setLng] = useState<number | null>(
    typeof initial?.pickup_lng === 'number' ? initial.pickup_lng : null,
  );
  const [manual, setManual] = useState(false);

  const onPick = useCallback(
    ({ lat: la, lng: ln, label }: { lat: number; lng: number; label?: string }) => {
      setLat(la);
      setLng(ln);
      // Never overwrite an address the donor typed themselves — a geocoded
      // label is a suggestion, and theirs is likely to be more useful to the
      // volunteer ("gate 2, behind the canteen").
      if (label) setAddress((prev) => (prev.trim() ? prev : label));
    },
    [],
  );

  async function onSubmit(formData: FormData) {
    setMsg(null); setOk(false);
    // The coordinate inputs are hidden, so the browser's own `required`
    // validation cannot speak up for them. Say it plainly here instead of
    // letting the donor fill eighteen fields and get a server error.
    if (lat === null || lng === null) {
      setMsg('Set the pickup location on the map before saving.');
      return;
    }
    const res = donationId ? await updateDonation(donationId, formData) : await createDonation(formData);
    if ((res as { error?: string })?.error) setMsg((res as { error: string }).error);
    else if ((res as { ok?: boolean })?.ok) { setMsg('Saved.'); setOk(true); }
  }
  const inputCls = 'w-full rounded-2xl border bg-white px-3.5 py-2.5 text-sm shadow-soft placeholder:text-slate-400 focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-100 dark:border-white/10 dark:bg-slate-800 dark:text-white dark:placeholder:text-slate-500';
  return (
    <form action={onSubmit} className="space-y-5 rounded-[24px] border bg-white p-6 shadow-card dark:border-white/10 dark:bg-slate-900/70 sm:p-7">
      <div className="rounded-2xl bg-brand-50 p-4 text-sm text-brand-900 dark:bg-brand-950/40 dark:text-brand-200">
        <span className="font-extrabold">Donor tip:</span> Publish requires a future <code>best_before</code> and a valid pickup window. Veg/non-veg is mandatory.
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Title" required><input name="title" defaultValue={initial?.title ?? ''} required className={inputCls} placeholder="e.g. Veg biryani — 40 servings" /></Field>
        <Field label="Food type" required>
          <select name="food_type" defaultValue={initial?.food_type ?? 'veg'} className={inputCls}>
            <option value="veg">Veg</option><option value="nonveg">Non-Veg</option><option value="vegan">Vegan</option><option value="jain">Jain</option>
          </select>
        </Field>
      </div>
      <Field label="Description"><textarea name="description" defaultValue={initial?.description ?? ''} rows={3} className={inputCls} placeholder="Anything the NGO/volunteer should know" /></Field>
      <div className="grid gap-4 sm:grid-cols-3">
        <Field label="Quantity" required><input name="quantity_desc" defaultValue={initial?.quantity_desc ?? ''} required className={inputCls} placeholder="e.g. 2 large trays" /></Field>
        <Field label="Servings estimate"><input name="servings_estimate" type="number" min={0} defaultValue={initial?.servings_estimate ?? ''} className={inputCls} /></Field>
        <Field label="Storage">
          <select name="storage_condition" defaultValue={initial?.storage_condition ?? 'room'} className={inputCls}>
            <option value="room">Room</option><option value="refrigerated">Refrigerated</option><option value="hot_held">Hot held</option>
          </select>
        </Field>
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        <label className="flex items-center gap-2 rounded-2xl border bg-slate-50 px-3 py-2.5 text-sm font-bold dark:border-white/10 dark:bg-white/5 dark:text-white">
          <input type="checkbox" name="is_cooked" defaultChecked={initial?.is_cooked ?? true} className="h-4 w-4" /> Cooked food
        </label>
        <Field label="Allergens / notes"><input name="allergens" defaultValue={initial?.allergens ?? ''} className={inputCls} placeholder="e.g. contains nuts" /></Field>
        <Field label="Prepared at"><input name="prepared_at" type="datetime-local" defaultValue={initial?.prepared_at ? new Date(initial.prepared_at).toISOString().slice(0,16) : ''} className={inputCls} /></Field>
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        <Field label="Best before" required><input name="best_before" type="datetime-local" defaultValue={initial?.best_before ? new Date(initial.best_before).toISOString().slice(0,16) : ''} required className={inputCls} /></Field>
        <Field label="Window start" required><input name="pickup_window_start" type="datetime-local" defaultValue={initial?.pickup_window_start ? new Date(initial.pickup_window_start).toISOString().slice(0,16) : ''} required className={inputCls} /></Field>
        <Field label="Window end" required><input name="pickup_window_end" type="datetime-local" defaultValue={initial?.pickup_window_end ? new Date(initial.pickup_window_end).toISOString().slice(0,16) : ''} required className={inputCls} /></Field>
      </div>
      <div className="space-y-4 rounded-2xl border border-dashed p-4 dark:border-white/15 sm:p-5">
        <div>
          <h3 className="text-sm font-extrabold dark:text-slate-100">
            Pickup location <span className="text-red-600">*</span>
          </h3>
          <p className="mt-0.5 text-xs text-slate-600 dark:text-slate-400">
            Search, use your location, or click the map. The volunteer navigates to this pin — a
            vague address costs a trip.
          </p>
        </div>

        <MapPicker lat={lat} lng={lng} onChange={onPick} />

        {/* The server action reads these. They are only rendered once a point
            exists, so a form submitted without a pin omits them entirely and
            is rejected server-side rather than silently saving 0,0 — which is
            a spot in the Atlantic Ocean, not a missing value. */}
        {lat !== null && lng !== null && (
          <>
            <input type="hidden" name="pickup_lat" value={lat} />
            <input type="hidden" name="pickup_lng" value={lng} />
          </>
        )}

        <Field label="Pickup address" required>
          <input
            name="pickup_address"
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            required
            className={inputCls}
            placeholder="Street, area, city"
          />
        </Field>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Landmark (helps the volunteer find the door)">
            <input name="pickup_landmark" defaultValue={initial?.pickup_landmark ?? ''} className={inputCls} placeholder="e.g. gate 2, behind the canteen" />
          </Field>
          <div className="flex items-end">
            <button
              type="button"
              onClick={() => setManual((m) => !m)}
              className="text-xs font-bold text-brand-700 underline decoration-dotted underline-offset-4 hover:text-brand-800 dark:text-brand-300"
            >
              {manual ? 'Hide manual coordinates' : 'Enter coordinates manually'}
            </button>
          </div>
        </div>

        {/* Escape hatch. Kept because the map needs tiles to load and a donor
            on a weak connection, or one who already has exact coordinates from
            a delivery app, should not be blocked on it. */}
        {manual && (
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Latitude">
              <input
                type="number" step="0.000001" min={-90} max={90}
                value={lat ?? ''}
                onChange={(e) => setLat(e.target.value === '' ? null : Number(e.target.value))}
                className={inputCls} placeholder="28.6139"
              />
            </Field>
            <Field label="Longitude">
              <input
                type="number" step="0.000001" min={-180} max={180}
                value={lng ?? ''}
                onChange={(e) => setLng(e.target.value === '' ? null : Number(e.target.value))}
                className={inputCls} placeholder="77.2090"
              />
            </Field>
          </div>
        )}

        <p className="text-xs text-slate-500 dark:text-slate-500">
          Map data &copy; OpenStreetMap contributors. Exact address stays hidden from the public
          until an NGO claims this donation.
        </p>
      </div>
      {msg && <p className={`rounded-2xl p-3 text-sm font-semibold ${ok ? 'bg-emerald-50 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200' : 'bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-200'}`}>{msg}</p>}
      <button type="submit" className="w-full rounded-full bg-brand-600 px-6 py-3 font-extrabold text-white shadow-soft hover:bg-brand-700 sm:w-auto">
        {donationId ? 'Save changes' : 'Create draft'}
      </button>
    </form>
  );
}
