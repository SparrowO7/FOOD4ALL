import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * Photo storage helpers.
 *
 * The database stores an object PATH (`{donation_id}/{uuid}.jpg`), never a
 * public URL — the buckets are private (0017_storage.sql). A signed URL is
 * minted on read, after the storage policies have checked who is asking.
 *
 * That choice has one consequence worth stating: a stored value may still be a
 * full URL from before this change, or one a user pasted in. Those are returned
 * unchanged, so old rows keep working and the display code stays total.
 */

export type MediaKind = 'donation' | 'proof';

const BUCKET: Record<MediaKind, string> = {
  donation: 'donation-photos',
  proof: 'delivery-proofs',
};

// One hour. Long enough for a page to stay open while someone reads it, short
// enough that a URL copied out of the address bar is not a lasting gift.
const SIGNED_TTL_SECONDS = 60 * 60;

/** True when the value is an object path in our bucket rather than an external URL. */
export function isStoragePath(value: string | null | undefined): value is string {
  if (!value) return false;
  return !/^https?:\/\//i.test(value) && !value.startsWith('data:') && !value.startsWith('blob:');
}

/** Resolve one stored value to something an <img> can load. */
export async function signedMediaUrl(
  supabase: SupabaseClient,
  kind: MediaKind,
  value: string | null | undefined,
): Promise<string | null> {
  if (!value) return null;
  if (!isStoragePath(value)) return value; // legacy external URL

  const { data, error } = await supabase.storage
    .from(BUCKET[kind])
    .createSignedUrl(value, SIGNED_TTL_SECONDS);

  // A failure here is usually a policy denial, which is the correct outcome for
  // a viewer who should not see the photo. Render nothing rather than a broken
  // image, and log the reason for the server's own diagnosis.
  if (error || !data?.signedUrl) {
    if (error) console.warn(`[media] signed URL refused for ${kind} ${value}: ${error.message}`);
    return null;
  }
  return data.signedUrl;
}

/**
 * Resolve many values in one round trip.
 *
 * The dashboard can show forty donations; signing each one separately would be
 * forty sequential requests inside a server render. `createSignedUrls` batches
 * them, and the map is keyed by the original stored value so callers do not
 * have to track paths separately from the rows they came from.
 */
export async function signedMediaUrlMap(
  supabase: SupabaseClient,
  kind: MediaKind,
  values: (string | null | undefined)[],
): Promise<Map<string, string>> {
  const result = new Map<string, string>();
  const paths = new Set<string>();

  for (const value of values) {
    if (!value) continue;
    if (isStoragePath(value)) paths.add(value);
    else result.set(value, value); // external URL passes through
  }

  if (paths.size === 0) return result;

  const { data, error } = await supabase.storage
    .from(BUCKET[kind])
    .createSignedUrls([...paths], SIGNED_TTL_SECONDS);

  if (error) {
    console.warn(`[media] batch signed URLs refused for ${kind}: ${error.message}`);
    return result;
  }

  // createSignedUrls returns one entry per requested path, in order. Match on
  // the returned `path` rather than by index: the API documents the order, but
  // matching a key to itself is the version that cannot silently mis-assign a
  // photo to the wrong donation.
  for (const item of data ?? []) {
    if (item.path && item.signedUrl) result.set(item.path, item.signedUrl);
  }
  return result;
}

const EXTENSION_BY_MIME: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/jpg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
};

export const MAX_PHOTO_BYTES = 5 * 1024 * 1024;

export type UploadResult = { path: string } | { error: string };

/**
 * Validate and store one photo.
 *
 * Three deliberate choices:
 *
 *  - The file's own name is discarded. A name such as
 *    `../../someone-else/photo.jpg` is the obvious attack on a bucket addressed
 *    by path, and generating the name removes the attack rather than trying to
 *    sanitise it.
 *  - The MIME type is checked against an allow-list and used to pick the
 *    extension, so the stored object's type matches its suffix.
 *  - The size ceiling is enforced here as well as by the bucket. The bucket is
 *    the real guard; this produces a sentence a person can act on.
 */
export async function uploadPhoto(
  supabase: SupabaseClient,
  kind: MediaKind,
  donationId: string,
  file: File,
): Promise<UploadResult> {
  if (!(file instanceof File) || file.size === 0) return { error: 'Choose a photo first.' };

  const extension = EXTENSION_BY_MIME[file.type.toLowerCase()];
  if (!extension) return { error: 'Use a JPEG, PNG or WebP photo.' };
  if (file.size > MAX_PHOTO_BYTES) return { error: 'That photo is larger than 5 MB. Choose a smaller one.' };

  const path = `${donationId}/${crypto.randomUUID()}.${extension}`;

  const { error } = await supabase.storage.from(BUCKET[kind]).upload(path, file, {
    contentType: file.type,
    upsert: false,
    cacheControl: '3600',
  });

  if (error) {
    // Storage reports a policy denial as a generic message; translate the one
    // case a user can actually act on.
    if (/row-level security|policy|permission/i.test(error.message)) {
      return { error: 'You cannot add a photo to this donation at this stage.' };
    }
    return { error: error.message };
  }

  return { path };
}
