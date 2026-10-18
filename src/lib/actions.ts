'use server';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { uploadPhoto } from '@/lib/media';
import type { FailureReason } from '@/types/database';

// ---- Auth ----
export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect('/');
}

// ---- Coordinate parsing -----------------------------------------------------
//
// Number() is the wrong tool for form data and this is why:
//
//     Number(null)  === 0      <- field absent  (FormData.get returns null)
//     Number('')    === 0      <- field present but blank
//     isFinite(0)   === true   <- so both sail past a finiteness check
//
// A missing latitude therefore used to be stored as 0, and 0,0 is a real
// coordinate: a point in the Atlantic Ocean south of Ghana. The donation would
// save "successfully" and every distance calculation against it would be
// nonsense. Parsing has to reject absence explicitly, not coerce it.
function parseCoord(raw: FormDataEntryValue | null, max: number): number | null {
  if (raw === null) return null;
  const text = String(raw).trim();
  if (text === '') return null;
  const n = Number(text);
  // Range-check too: a swapped lat/lng pair (a longitude of 77 placed in a
  // latitude field is still a valid number) is the next most likely mistake.
  if (!Number.isFinite(n) || n < -max || n > max) return null;
  return n;
}

// Validate before calling toISOString(), which throws on malformed input.
function validateDonationInput(form: FormData): string | null {
  if (!['veg','vegan','jain'].includes(String(form.get('food_type')??''))) return 'Food4All India currently accepts vegetarian food only.';
  if (!['true','on'].includes(String(form.get('vegetarian_confirmed')??''))) return 'Confirm vegetarian ingredients and separate packing.';
  const dates = ['prepared_at', 'best_before', 'pickup_window_start', 'pickup_window_end'];
  for (const name of dates) {
    const value = String(form.get(name) ?? '');
    if (value && (!/(Z|[+-]\d{2}:\d{2})$/.test(value) || !Number.isFinite(Date.parse(value)))) {
      return 'Choose a valid date and time for ' + name.replaceAll('_', ' ') + '.';
    }
  }
  for (const name of ['title', 'quantity_desc', 'pickup_address', 'best_before', 'pickup_window_start', 'pickup_window_end']) {
    if (!String(form.get(name) ?? '').trim()) return 'Please fill ' + name.replaceAll('_', ' ') + '.';
  }
  const servings = String(form.get('servings_estimate') ?? '').trim();
  if (servings && (!Number.isInteger(Number(servings)) || Number(servings) < 0 || Number(servings) > 2147483647))
    return 'Servings must be a non-negative whole number.';
  const temperature = String(form.get('food_temp_c') ?? '').trim();
  if (temperature && (!Number.isFinite(Number(temperature)) || Math.abs(Number(temperature)) >= 1000))
    return 'Enter a valid food temperature.';
  const start = Date.parse(String(form.get('pickup_window_start')));
  const end = Date.parse(String(form.get('pickup_window_end')));
  const best = Date.parse(String(form.get('best_before')));
  if (start >= end || end > best) return 'Pickup must end after its start and no later than best-before.';
  const prepared = form.get('prepared_at');
  if (prepared && Date.parse(String(prepared)) > best) return 'Preparation must be before best-before.';
  return null;
}

// ---- Donation CRUD (draft create/update) ----
export async function createDonation(formData: FormData) {
  const invalid = validateDonationInput(formData);
  if (invalid) return { error: invalid };
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: 'Not authenticated' };

  const payload: Record<string, unknown> = {
    donor_id: user.id,
    title: String(formData.get('title') || '').trim(),
    description: (String(formData.get('description') || '').trim() || null) as unknown,
    food_type: String(formData.get('food_type') || 'veg'),
    vegetarian_confirmed: ['on','true'].includes(String(formData.get('vegetarian_confirmed'))),
    is_cooked: formData.get('is_cooked') === 'on' || formData.get('is_cooked') === 'true',
    allergens: (String(formData.get('allergens') || '').trim() || null) as unknown,
    quantity_desc: String(formData.get('quantity_desc') || '').trim(),
    servings_estimate: formData.get('servings_estimate')
      ? Number(formData.get('servings_estimate'))
      : null,
    prepared_at: formData.get('prepared_at') ? new Date(String(formData.get('prepared_at'))).toISOString() : null,
    best_before: formData.get('best_before') ? new Date(String(formData.get('best_before'))).toISOString() : null,
    storage_condition: String(formData.get('storage_condition') || 'room'),
    pickup_address: String(formData.get('pickup_address') || '').trim(),
    pickup_landmark: (String(formData.get('pickup_landmark') || '').trim() || null) as unknown,
    pickup_lat: parseCoord(formData.get('pickup_lat'), 90),
    pickup_lng: parseCoord(formData.get('pickup_lng'), 180),
    pickup_window_start: formData.get('pickup_window_start')
      ? new Date(String(formData.get('pickup_window_start'))).toISOString()
      : null,
    pickup_window_end: formData.get('pickup_window_end')
      ? new Date(String(formData.get('pickup_window_end'))).toISOString()
      : null,
    // ---- FSSAI surplus-food record (reg 7 + Schedule-II) ----
    batch_no: (String(formData.get('batch_no') || '').trim() || null) as unknown,
    // Blank stays blank. A donor without a thermometer must not be pushed into
    // inventing a number for a record intended to hold up later.
    food_temp_c: formData.get('food_temp_c') ? Number(formData.get('food_temp_c')) : null,
    is_perishable: String(formData.get('is_perishable') ?? 'true') !== 'false',
    not_previously_served:
      formData.get('not_previously_served') === 'on' ||
      formData.get('not_previously_served') === 'true',
    status: 'draft' as const,
  };

  if (!payload.title || !payload.quantity_desc || !payload.pickup_address || !payload.best_before) {
    return { error: 'Please fill required fields: title, quantity, address, best-before.' };
  }
  if (payload.pickup_lat === null || payload.pickup_lng === null) {
    return { error: 'Set the pickup location on the map (latitude -90..90, longitude -180..180).' };
  }
  // Mirrors the cooked_requires_prepared_at constraint (0009_compliance.sql) so
  // the donor sees a sentence instead of a Postgres error. The database is still
  // the guard — this check can be bypassed, that one cannot.
  if (payload.is_cooked && !payload.prepared_at) {
    return { error: 'Cooked food needs a preparation time — it is required on the food safety record and on the label.' };
  }
  if (!payload.not_previously_served) {
    return { error: 'Please confirm the food was never served to customers. Food that has been served cannot be donated under the FSSAI surplus food rules.' };
  }

  const { data, error } = await supabase.from('donations').insert(payload).select('id').single();
  if (error) return { error: error.message };

  const id = (data as { id: string }).id;

  // The photo cannot be uploaded before the row exists: the storage policy
  // resolves the donation from the object path and checks that it is this
  // donor's draft. So the order is insert, upload, patch. A failed upload does
  // not undo a valid donation — it is reported on the donation page, where the
  // donor can retry, rather than pretending the whole save failed.
  let photoFailed = false;
  const photo = formData.get('photo');
  if (photo instanceof File && photo.size > 0) {
    const uploaded = await uploadPhoto(supabase, 'donation', id, photo);
    if ('error' in uploaded) {
      photoFailed = true;
    } else {
      const { error: patchError } = await supabase
        .from('donations').update({ photo_url: uploaded.path }).eq('id', id);
      if (patchError) photoFailed = true;
    }
  }

  revalidatePath('/donations');
  revalidatePath('/dashboard');
  redirect(`/donations/${id}${photoFailed ? '?photo=failed' : ''}`);
}

export async function updateDonation(id: string, formData: FormData) {
  const invalid = validateDonationInput(formData);
  if (invalid) return { error: invalid };
  const supabase = await createClient();
  const patch: Record<string, unknown> = {};
  const fields = [
    'title', 'description', 'food_type', 'allergens', 'quantity_desc',
    'servings_estimate', 'prepared_at', 'best_before', 'storage_condition',
    'pickup_address', 'pickup_landmark', 'pickup_lat', 'pickup_lng',
    'pickup_window_start', 'pickup_window_end', 'batch_no', 'food_temp_c',
  ] as const;
  for (const f of fields) {
    const v = formData.get(f);
    if (v !== null && String(v) !== '') {
      if (f === 'pickup_lat' || f === 'pickup_lng') {
        // Same guard as createDonation. An out-of-range or non-numeric value
        // is rejected here rather than handed to Postgres as NaN.
        const coord = parseCoord(v, f === 'pickup_lat' ? 90 : 180);
        if (coord === null) return { error: `${f} is not a valid coordinate.` };
        patch[f] = coord;
      }
      else if (f === 'servings_estimate') patch[f] = Number(v);
      else if (f === 'food_temp_c') {
        const t = Number(v);
        if (!Number.isFinite(t)) return { error: 'Food temperature is not a number.' };
        patch[f] = t;
      }
      else if (f === 'prepared_at' || f === 'best_before' || f === 'pickup_window_start' || f === 'pickup_window_end')
        patch[f] = new Date(String(v)).toISOString();
      else patch[f] = String(v).trim();
    }
  }
  if (formData.get('is_cooked') !== null) patch['is_cooked'] = formData.get('is_cooked') === 'on' || formData.get('is_cooked') === 'true';
  if (formData.get('is_perishable') !== null) patch['is_perishable'] = String(formData.get('is_perishable')) !== 'false';
  if (formData.get('not_previously_served') !== null) {
    patch['not_previously_served'] =
      formData.get('not_previously_served') === 'on' ||
      formData.get('not_previously_served') === 'true';
  }
  patch['vegetarian_confirmed'] = ['on','true'].includes(String(formData.get('vegetarian_confirmed')));
  // allow clearing
  if (formData.get('description') === '') patch['description'] = null;
  if (formData.get('allergens') === '') patch['allergens'] = null;
  if (formData.get('pickup_landmark') === '') patch['pickup_landmark'] = null;
  if (formData.get('prepared_at') === '') patch['prepared_at'] = null;
  if (formData.get('batch_no') === '') patch['batch_no'] = null;
  if (formData.get('food_temp_c') === '') patch['food_temp_c'] = null;

  // The edit form posts is_cooked and prepared_at together, so this catches the
  // combination that 0009's constraint would otherwise reject with a raw error.
  if (patch['is_cooked'] === true && patch['prepared_at'] === null) {
    return { error: 'Cooked food needs a preparation time — it is required on the food safety record and on the label.' };
  }

  const { data, error } = await supabase.from('donations').update(patch).eq('id', id).eq('status', 'draft').select('id').maybeSingle();
  if (!error && !data) return { error: 'Draft not found or you no longer have permission to edit it.' };
  if (error) return { error: error.message };

  // Replace the photo if a new one was chosen. Leaving the existing object in
  // place when no file was selected is deliberate: the form shows the current
  // photo, and an empty file input means "keep it", not "delete it".
  const photo = formData.get('photo');
  if (photo instanceof File && photo.size > 0) {
    const uploaded = await uploadPhoto(supabase, 'donation', id, photo);
    if ('error' in uploaded) return { error: uploaded.error };
    const { error: patchError } = await supabase
      .from('donations').update({ photo_url: uploaded.path }).eq('id', id);
    if (patchError) return { error: patchError.message };
  }

  revalidatePath(`/donations/${id}`);
  revalidatePath('/dashboard');
  return { ok: true };
}

// ---- Failure taxonomy ----
// The enum, its labels and the FailureReason type live in @/types/database
// alongside the other mirrors of Postgres enums, so the UI can import them
// without pulling in this module's server actions.

/**
 * Mirrors the rule in transition_donation (0010b): an ending needs a reason,
 * except discarding a draft — that was never published, so no rescue failed and
 * counting it would inflate the failure statistics.
 */
function reasonRequired(to: string, from?: string): boolean {
  if (to === 'expired' || to === 'rejected') return true;
  if (to === 'cancelled') return from !== 'draft';
  return false;
}

// ---- Guarded transitions (via RPC transition_donation) ----
export async function transitionDonation(
  id: string,
  to: string,
  opts?: { note?: string; volunteerId?: string; reason?: FailureReason; from?: string },
) {
  // Checked here as well as in the RPC so the user gets a clear message instead
  // of a raised Postgres exception. The database remains the real guard.
  if (reasonRequired(to, opts?.from) && !opts?.reason) {
    return { error: `A reason is required when marking a donation ${to}.` };
  }
  if (opts?.reason === 'other' && !opts?.note?.trim()) {
    return { error: 'Choosing "Other" requires a short explanation.' };
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc('transition_donation', {
    p_id: id,
    p_to: to,
    p_note: opts?.note ?? null,
    p_volunteer: opts?.volunteerId ?? null,
    p_reason: opts?.reason ?? null,
  });
  if (error) return { error: error.message };
  revalidatePath(`/donations/${id}`);
  revalidatePath('/donations');
  revalidatePath('/dashboard');
  revalidatePath('/impact');
  return { ok: true };
}

// ---- Post-hoc outcome annotation (via RPC annotate_outcome) ----
// For donations the system expired on its own: the cron sweeper has no way to
// know why nobody collected the food, so a human records it afterwards.
// Write-once in the database — see 0011_outcomes.sql.
export async function annotateOutcome(
  id: string,
  reason: FailureReason,
  note?: string,
) {
  if (reason === 'other' && !note?.trim()) {
    return { error: 'Choosing "Other" requires a short explanation.' };
  }
  const supabase = await createClient();
  const { error } = await supabase.rpc('annotate_outcome', {
    p_id: id,
    p_reason: reason,
    p_note: note ?? null,
  });
  if (error) return { error: error.message };
  revalidatePath(`/donations/${id}`);
  revalidatePath('/dashboard');
  return { ok: true };
}

// ---- Volunteer location ----
export async function updateVolunteerLocation(lat: number, lng: number) {
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180)
    return { error: 'Choose a valid location.' };
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: 'Not authenticated' };
  const { error } = await supabase.from('volunteers').update({
    current_lat: lat,
    current_lng: lng,
    location_updated_at: new Date().toISOString(),
  }).eq('id', user.id);
  if (error) return { error: error.message };
  return { ok: true };
}

// ---- Profile update ----
export async function updateProfile(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: 'Not authenticated' };
  const patch: Record<string, unknown> = {};
  const full_name = String(formData.get('full_name') || '').trim();
  const phone = String(formData.get('phone') || '').trim();
  const city = String(formData.get('city') || '').trim();
  if (full_name) patch['full_name'] = full_name;
  if (phone) patch['phone'] = phone;
  if (city) patch['city'] = city;
  const roleExtra = String(formData.get('vehicle_type') || '');
  if (roleExtra) {
    // also update volunteers row if exists
    const { error } = await supabase.from('volunteers').update({ vehicle_type: roleExtra }).eq('id', user.id);
    if (error) return { error: error.message };
  }
  if (Object.keys(patch).length) {
    const { error } = await supabase.from('profiles').update(patch).eq('id', user.id);
    if (error) return { error: error.message };
  }
  revalidatePath('/profile');
  revalidatePath('/dashboard');
  return { ok: true };
}

// Persist the handover record; RLS checks assignment, NGO and delivered status.
export async function recordDelivery(id: string, form: FormData) {
  const raw = String(form.get('servings') ?? '').trim();
  const servings = Number(raw);
  if (!raw || !Number.isInteger(servings) || servings < 0 || servings > 2147483647)
    return { error: 'Enter the actual number of servings delivered (a non-negative whole number).' };
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: 'Please sign in again.' };
  const { data: donation, error: readError } = await supabase.from('donations')
    .select('claimed_by_ngo,assigned_volunteer,status').eq('id', id).single();
  if (readError || !donation || donation.assigned_volunteer !== user.id || donation.status !== 'delivered')
    return { error: 'Only the assigned volunteer can record this delivered donation.' };

  // Stored first, then referenced. The proof bucket has no update policy, so the
  // row must carry the final path from the moment it is inserted — a two-step
  // insert-then-patch would be impossible by design.
  let proofPath: string | null = null;
  const proof = form.get('proof');
  if (proof instanceof File && proof.size > 0) {
    const uploaded = await uploadPhoto(supabase, 'proof', id, proof);
    if ('error' in uploaded) return { error: uploaded.error };
    proofPath = uploaded.path;
  }

  const { error } = await supabase.from('deliveries').insert({
    donation_id: id, volunteer_id: user.id, ngo_id: donation.claimed_by_ngo,
    servings_delivered: servings,
    proof_photo_url: proofPath,
    recipient_note: String(form.get('note') ?? '').trim().slice(0, 2000) || null,
    distribution_area: String(form.get('area') ?? '').trim().slice(0, 300) || null,
  });
  if (error) return { error: error.code === '23505' ? 'A delivery record already exists. Refresh to view it.' : error.message };
  revalidatePath(`/donations/${id}`);
  revalidatePath('/records');
  revalidatePath('/impact');
  return { ok: true };
}

export async function verifyNgo(id: string, approved: boolean) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: 'Please sign in.' };
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single();
  if (profile?.role !== 'admin') return { error: 'Only an administrator can review organisations.' };
  const { data, error } = await supabase.from('ngos').update({ verification_status: approved ? 'verified' : 'rejected', verified_by: user.id, verified_at: new Date().toISOString() }).eq('id',id).select('id').maybeSingle();
  if (error || !data) return { error: error?.message ?? 'Organisation not found.' };
  revalidatePath('/dashboard');
  return { ok:true };
}
export async function markNotificationRead(id: string) {
  const supabase = await createClient();
  const { error } = await supabase.rpc('read_notification',{p_id:id});
  if (error) return {error:error.message};
  revalidatePath('/dashboard');
  return {ok:true};
}

export async function updateNgoProfile(form: FormData) {
  const db=await createClient();const {data:{user}}=await db.auth.getUser();if(!user)return {error:'Please sign in.'};
  const fields=['org_name','registration_no','contact_person','contact_phone','address','fssai_licence_no','licence_not_required_note'];
  const patch=Object.fromEntries(fields.map(k=>[k,String(form.get(k)??'').trim()||null]));
  if(!patch.org_name||!patch.contact_person||!patch.contact_phone||!patch.address)return {error:'Enter the organisation name, contact person, phone and address.'};
  const {data,error}=await db.from('ngos').update(patch).eq('id',user.id).select('id').maybeSingle();
  if(error||!data)return {error:error?.message??'Organisation profile not found.'};revalidatePath('/profile');revalidatePath('/dashboard');return {ok:true};
}

export async function ngoCollect(id:string) {
 const db=await createClient();const {error}=await db.rpc('ngo_collect',{p_id:id});
 if(error)return {error:error.message};revalidatePath(`/donations/${id}`);revalidatePath(`/trace/${id}`);revalidatePath('/dashboard');return {ok:true};
}
export async function ngoDistribute(id:string,form:FormData) {
 const servings=Number(form.get('servings')),people=Number(form.get('people'));
 if(!Number.isInteger(servings)||!Number.isInteger(people)||servings<=0||people<=0||servings>2147483647||people>2147483647)return {error:'Enter positive whole numbers for servings and people reached.'};
 const db=await createClient();const {error}=await db.rpc('ngo_distribute',{p_id:id,p_servings:servings,p_people:people,p_area:String(form.get('area')??'').trim(),p_note:String(form.get('note')??'').trim()||null});
 if(error)return {error:error.message};for(const path of [`/donations/${id}`,`/trace/${id}`,'/dashboard','/records','/impact'])revalidatePath(path);return {ok:true};
}
