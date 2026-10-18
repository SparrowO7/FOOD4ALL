'use client';
import { useCallback, useEffect, useState } from 'react';
import dynamic from 'next/dynamic';
import { createDonation, updateDonation } from '@/lib/actions';
import PhotoField from '@/components/PhotoField';
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

  // Cooked food must carry a preparation time: Schedule-II(6) of the Surplus
  // Food Regulations 2019 requires it on the record, and reg 6(3) requires it
  // on the label. The database enforces this (cooked_requires_prepared_at in
  // 0009_compliance.sql); tracking it here only moves the error from a raised
  // exception to the field itself.
  const [isCooked, setIsCooked] = useState(initial?.is_cooked ?? true);

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
    formData.set('vegetarian_confirmed', String(formData.has('vegetarian_confirmed')));
    formData.set('is_cooked', String(isCooked));
    formData.set('not_previously_served', String(formData.has('not_previously_served')));
    // datetime-local is in the browser's timezone, not the server's timezone.
    for (const field of ['prepared_at', 'best_before', 'pickup_window_start', 'pickup_window_end']) {
      const value = String(formData.get(field) ?? '');
      if (value) {
        const parsed = new Date(value);
        if (!Number.isFinite(parsed.getTime())) { setMsg('Choose a valid date and time.'); return; }
        formData.set(field, parsed.toISOString());
      }
    }
    const res = donationId ? await updateDonation(donationId, formData) : await createDonation(formData);
    if ((res as { error?: string })?.error) setMsg((res as { error: string }).error);
    else if ((res as { ok?: boolean })?.ok) { setMsg('Saved.'); setOk(true); }
  }
  const inputCls = 'w-full rounded-2xl border bg-white px-3.5 py-2.5 text-sm shadow-soft placeholder:text-slate-400 focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-100 dark:border-white/10 dark:bg-slate-800 dark:text-white dark:placeholder:text-slate-500';
  return (
    <form action={onSubmit} className="space-y-5 rounded-[24px] border bg-white p-6 shadow-card dark:border-white/10 dark:bg-slate-900/70 sm:p-7">
      <div className="rounded-2xl bg-brand-50 p-4 text-sm text-brand-900 dark:bg-brand-950/40 dark:text-brand-200">
        <span className="font-extrabold">Donor tip:</span> Publish requires a future <code>best_before</code> and a valid pickup window. Only vegetarian food is accepted during this pilot.
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Title" required><input name="title" defaultValue={initial?.title ?? ''} required className={inputCls} placeholder="e.g. Veg biryani — 40 servings" /></Field>
        <Field label="Food type" required>
          <select name="food_type" defaultValue={initial?.food_type ?? 'veg'} className={inputCls}>
            <option value="veg">Veg</option><option value="vegan">Vegan</option><option value="jain">Jain</option>
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
          <input
            type="checkbox"
            name="is_cooked"
            checked={isCooked}
            onChange={(e) => setIsCooked(e.target.checked)}
            className="h-4 w-4"
          /> Cooked food
        </label>
        <Field label="Allergens / notes"><input name="allergens" defaultValue={initial?.allergens ?? ''} className={inputCls} placeholder="e.g. contains nuts" /></Field>
        <Field label="Prepared at" required={isCooked}>
          <LocalDateInput
            name="prepared_at"
            type="datetime-local"
            initialValue={initial?.prepared_at}
            required={isCooked}
            className={inputCls}
          />
        </Field>
      </div>

      <label className="flex items-start gap-3 rounded-2xl border border-green-700/20 bg-green-50 p-4 text-sm dark:bg-green-950/25"><input className="mt-1 shrink-0" type="checkbox" name="vegetarian_confirmed" required defaultChecked={initial?.vegetarian_confirmed ?? false}/><span><strong>Vegetarian ingredients & separate packing</strong><span className="mt-1 block">I confirm this food contains no meat, fish, eggs or other non-vegetarian ingredients and has been packed separately from non-vegetarian food.</span></span></label>
      {/* ---- Food safety record ------------------------------------------
          These are not product decisions. The Food Safety and Standards
          (Recovery and Distribution of Surplus Food) Regulations, 2019 require
          a twelve-field record of every donation (reg 7 + Schedule-II). Nine
          of those fields are collected elsewhere on this form; these are the
          rest. The section is labelled so a donor can see why it is being
          asked, rather than meeting four unexplained inputs. */}
      <div className="space-y-4 rounded-2xl border border-dashed p-4 dark:border-white/15 sm:p-5">
        <div>
          <h3 className="text-sm font-extrabold dark:text-slate-100">Food safety record</h3>
          <p className="mt-0.5 text-xs text-slate-600 dark:text-slate-400">
            Required by the FSSAI surplus food rules. This record is what protects you if
            anyone asks later what was donated and when.
          </p>
        </div>

        <label className="flex items-start gap-2.5 rounded-2xl border bg-slate-50 px-3 py-2.5 text-sm font-bold dark:border-white/10 dark:bg-white/5 dark:text-white">
          {/* Not defaulted to checked. This tick is what makes the food
              "surplus food" in law — reg 2(1)(d) excludes anything already
              served to customers — so only the donor can assert it. */}
          <input
            type="checkbox"
            name="not_previously_served"
            defaultChecked={initial?.not_previously_served ?? false}
            required
            className="mt-0.5 h-4 w-4 shrink-0"
          />
          <span>
            This food was never served to customers <span className="text-red-600">*</span>
            <span className="mt-0.5 block text-xs font-medium text-slate-600 dark:text-slate-400">
              Food that has already been served cannot be donated under the rules.
            </span>
          </span>
        </label>

        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="Batch / service name">
            <input name="batch_no" defaultValue={initial?.batch_no ?? ''} className={inputCls} placeholder="e.g. evening thali" />
          </Field>
          {/* Nullable on purpose: a donor with no thermometer should leave this
              blank rather than invent a reading for a record meant to hold up
              later. The pilot reports coverage, not assumed compliance. */}
          <Field label="Food temperature (°C)">
            <input name="food_temp_c" type="number" step="0.1" defaultValue={initial?.food_temp_c ?? ''} className={inputCls} placeholder="leave blank if not measured" />
          </Field>
          <Field label="Perishable?">
            <select name="is_perishable" defaultValue={String(initial?.is_perishable ?? true)} className={inputCls}>
              <option value="true">Perishable</option>
              <option value="false">Non-perishable</option>
            </select>
          </Field>
        </div>
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        <Field label="Best before" required><LocalDateInput name="best_before" type="datetime-local" initialValue={initial?.best_before} required className={inputCls} /></Field>
        <Field label="Window start" required><LocalDateInput name="pickup_window_start" type="datetime-local" initialValue={initial?.pickup_window_start} required className={inputCls} /></Field>
        <Field label="Window end" required><LocalDateInput name="pickup_window_end" type="datetime-local" initialValue={initial?.pickup_window_end} required className={inputCls} /></Field>
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
          Map data &copy; OpenStreetMap contributors. Exact address is shared only with you, the claiming NGO, the assigned volunteer and administrators.
        </p>
      </div>

      {/* A photo is the single most useful thing an NGO can see before claiming:
          it answers "is this the quantity and condition I was told?" without a
          phone call. Stored privately — see 0017_storage.sql. */}
      <PhotoField
        name="photo"
        label={initial?.photo_url ? 'Replace the food photo' : 'Food photo (optional)'}
        hint={
          initial?.photo_url
            ? 'Leave empty to keep the current photo.'
            : 'A clear photo of the packed food helps the NGO decide before claiming. Up to 5 MB; it is resized on your device first.'
        }
      />
      {msg && <p className={`rounded-2xl p-3 text-sm font-semibold ${ok ? 'bg-emerald-50 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200' : 'bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-200'}`}>{msg}</p>}
      <button type="submit" className="w-full rounded-full bg-brand-600 px-6 py-3 font-extrabold text-white shadow-soft hover:bg-brand-700 sm:w-auto">
        {donationId ? 'Save changes' : 'Create draft'}
      </button>
    </form>
  );
}

function localDateTime(value: string): string {
  const date = new Date(value);
  return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
}

function LocalDateInput({ initialValue, ...props }: React.InputHTMLAttributes<HTMLInputElement> & { initialValue?: string | null }) {
  const [value, setValue] = useState('');
  useEffect(() => { setValue(initialValue ? localDateTime(initialValue) : ''); }, [initialValue]);
  return <input {...props} value={value} onChange={(event) => setValue(event.target.value)} />;
}
