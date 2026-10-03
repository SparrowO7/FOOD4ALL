'use server';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';

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

// ---- Donation CRUD (draft create/update) ----
export async function createDonation(formData: FormData) {
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
    status: 'draft' as const,
  };

  if (!payload.title || !payload.quantity_desc || !payload.pickup_address || !payload.best_before) {
    return { error: 'Please fill required fields: title, quantity, address, best-before.' };
  }
  if (payload.pickup_lat === null || payload.pickup_lng === null) {
    return { error: 'Set the pickup location on the map (latitude -90..90, longitude -180..180).' };
  }

  const { data, error } = await supabase.from('donations').insert(payload).select('id').single();
  if (error) return { error: error.message };
  revalidatePath('/donations');
  revalidatePath('/dashboard');
  redirect(`/donations/${(data as { id: string }).id}`);
}

export async function updateDonation(id: string, formData: FormData) {
  const supabase = await createClient();
  const patch: Record<string, unknown> = {};
  const fields = [
    'title', 'description', 'food_type', 'allergens', 'quantity_desc',
    'servings_estimate', 'prepared_at', 'best_before', 'storage_condition',
    'pickup_address', 'pickup_landmark', 'pickup_lat', 'pickup_lng',
    'pickup_window_start', 'pickup_window_end',
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
      else if (f === 'prepared_at' || f === 'best_before' || f === 'pickup_window_start' || f === 'pickup_window_end')
        patch[f] = new Date(String(v)).toISOString();
      else patch[f] = String(v).trim();
    }
  }
  if (formData.get('is_cooked') !== null) patch['is_cooked'] = formData.get('is_cooked') === 'on' || formData.get('is_cooked') === 'true';
  // allow clearing
  if (formData.get('description') === '') patch['description'] = null;
  if (formData.get('allergens') === '') patch['allergens'] = null;
  if (formData.get('pickup_landmark') === '') patch['pickup_landmark'] = null;
  if (formData.get('prepared_at') === '') patch['prepared_at'] = null;

  const { error } = await supabase.from('donations').update(patch).eq('id', id);
  if (error) return { error: error.message };
  revalidatePath(`/donations/${id}`);
  revalidatePath('/dashboard');
  return { ok: true };
}

// ---- Guarded transitions (via RPC transition_donation) ----
export async function transitionDonation(
  id: string,
  to: string,
  opts?: { note?: string; volunteerId?: string },
) {
  const supabase = await createClient();
  const { error } = await supabase.rpc('transition_donation', {
    p_id: id,
    p_to: to,
    p_note: opts?.note ?? null,
    p_volunteer: opts?.volunteerId ?? null,
  });
  if (error) return { error: error.message };
  revalidatePath(`/donations/${id}`);
  revalidatePath('/donations');
  revalidatePath('/dashboard');
  revalidatePath('/impact');
  return { ok: true };
}

// ---- Volunteer location ----
export async function updateVolunteerLocation(lat: number, lng: number) {
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
    await supabase.from('volunteers').update({ vehicle_type: roleExtra }).eq('id', user.id);
  }
  if (Object.keys(patch).length) {
    const { error } = await supabase.from('profiles').update(patch).eq('id', user.id);
    if (error) return { error: error.message };
  }
  revalidatePath('/profile');
  revalidatePath('/dashboard');
  return { ok: true };
}
