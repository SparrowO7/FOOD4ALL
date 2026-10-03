// ============================================================================
// /api/geocode — a thin server-side proxy in front of Nominatim (OpenStreetMap)
//
// WHY A PROXY AND NOT A DIRECT fetch() FROM THE BROWSER:
//
//   1. Nominatim's usage policy requires a User-Agent (or Referer) that
//      identifies the application. A browser will not let JavaScript set
//      User-Agent — it is a forbidden header. Only a server can comply.
//
//   2. The policy caps usage at ~1 request/second for the free public
//      endpoint. One shared server-side gate can actually enforce that; a
//      hundred browser tabs each "being polite" on their own cannot.
//
//   3. Repeat queries ("Connaught Place") are answered from a local cache, so
//      the demo stays fast and the public endpoint stays unburdened.
//
//   4. The browser never learns which geocoder we use, so swapping Nominatim
//      for a paid provider later is a one-file change.
//
// Two modes:
//   GET /api/geocode?q=connaught+place      -> forward geocoding (text -> coords)
//   GET /api/geocode?lat=28.63&lng=77.21    -> reverse geocoding (coords -> text)
//
// Both return the same trimmed shape so the client has one thing to parse:
//   { results: [{ label, lat, lng }] }
// ============================================================================

import { NextResponse } from 'next/server';

const NOMINATIM = 'https://nominatim.openstreetmap.org';

// Nominatim asks for a real contact point. Put your deployed URL here.
const USER_AGENT =
  'Food4All/0.1 (nonprofit food-rescue project; +https://github.com/food4all)';

/** Nominatim's policy limit, plus 100ms of headroom for clock jitter. */
const MIN_GAP_MS = 1100;

/** Cache entries live this long. Street geometry does not change in an hour. */
const CACHE_TTL_MS = 60 * 60 * 1000;

/** Hard ceiling so a long-running instance cannot grow unbounded. */
const CACHE_MAX = 200;

type GeoResult = { label: string; lat: number; lng: number };

// ---------------------------------------------------------------------------
// Rate gate.
//
// Every upstream call appends itself to a single promise chain, so call N+1
// cannot start until MIN_GAP_MS after call N finished. Simple, and correct for
// a single instance.
//
// LIMITATION, stated honestly: this is per-instance memory. On Vercel's
// serverless runtime each cold instance gets its own chain, so N concurrent
// instances can produce N requests/second. For this project's traffic that
// never happens, but the real fix is a shared store (Upstash Redis free tier)
// or a paid geocoder. Noted rather than hidden.
// ---------------------------------------------------------------------------
let gate: Promise<unknown> = Promise.resolve();

function throttle<T>(job: () => Promise<T>): Promise<T> {
  const run = gate.then(job, job);
  // Chain the *delay*, not the result, so one failure cannot poison the gate.
  gate = run.then(
    () => new Promise((r) => setTimeout(r, MIN_GAP_MS)),
    () => new Promise((r) => setTimeout(r, MIN_GAP_MS)),
  );
  return run;
}

// ---------------------------------------------------------------------------
// Cache (insertion-ordered Map used as a crude LRU)
// ---------------------------------------------------------------------------
const cache = new Map<string, { at: number; results: GeoResult[] }>();

function cacheGet(key: string): GeoResult[] | null {
  const hit = cache.get(key);
  if (!hit) return null;
  if (Date.now() - hit.at > CACHE_TTL_MS) {
    cache.delete(key);
    return null;
  }
  // Touch: delete + re-insert moves it to the end of the iteration order.
  cache.delete(key);
  cache.set(key, hit);
  return hit.results;
}

function cacheSet(key: string, results: GeoResult[]): void {
  cache.set(key, { at: Date.now(), results });
  while (cache.size > CACHE_MAX) {
    const oldest = cache.keys().next().value;
    if (oldest === undefined) break;
    cache.delete(oldest);
  }
}

// ---------------------------------------------------------------------------
// Upstream shapes. Nominatim returns a lot; we want four fields.
// ---------------------------------------------------------------------------
type NominatimPlace = {
  lat?: string;
  lon?: string;
  display_name?: string;
  name?: string;
};

function toResults(raw: unknown): GeoResult[] {
  const list: NominatimPlace[] = Array.isArray(raw)
    ? (raw as NominatimPlace[])
    : raw && typeof raw === 'object'
      ? [raw as NominatimPlace]
      : [];

  return list
    .map((p) => {
      const lat = Number(p.lat);
      const lng = Number(p.lon);
      const label = (p.display_name ?? p.name ?? '').trim();
      // Nominatim hands coordinates back as strings; a malformed one would
      // otherwise sail through as NaN and land in the database.
      if (!Number.isFinite(lat) || !Number.isFinite(lng) || !label) return null;
      return { label, lat, lng };
    })
    .filter((r): r is GeoResult => r !== null);
}

async function callNominatim(url: string): Promise<GeoResult[]> {
  const res = await throttle(() =>
    fetch(url, {
      headers: { 'User-Agent': USER_AGENT, Accept: 'application/json' },
      // Next must not try to cache this itself — we run our own cache above.
      cache: 'no-store',
    }),
  );
  if (!res.ok) throw new Error(`Nominatim responded ${res.status}`);
  return toResults(await res.json());
}

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const q = (params.get('q') ?? '').trim();
  const latRaw = params.get('lat');
  const lngRaw = params.get('lng');

  try {
    // ----- reverse: coordinates -> address -------------------------------
    if (latRaw !== null && lngRaw !== null) {
      const lat = Number(latRaw);
      const lng = Number(lngRaw);
      if (
        !Number.isFinite(lat) ||
        !Number.isFinite(lng) ||
        lat < -90 ||
        lat > 90 ||
        lng < -180 ||
        lng > 180
      ) {
        return NextResponse.json(
          { error: 'lat/lng out of range' },
          { status: 400 },
        );
      }

      // 5 decimal places (~1 m) is far finer than any address needs, and
      // rounding makes nearby clicks share one cache entry.
      const key = `r:${lat.toFixed(5)},${lng.toFixed(5)}`;
      const cached = cacheGet(key);
      if (cached) return NextResponse.json({ results: cached, cached: true });

      const url =
        `${NOMINATIM}/reverse?format=jsonv2` +
        `&lat=${encodeURIComponent(lat)}&lon=${encodeURIComponent(lng)}` +
        `&zoom=18&addressdetails=1`;
      const results = await callNominatim(url);
      cacheSet(key, results);
      return NextResponse.json({ results });
    }

    // ----- forward: text -> coordinates ----------------------------------
    if (q.length < 3) {
      // Not an error: the client types one character at a time, and a
      // one-character search would be a wasted upstream call.
      return NextResponse.json({ results: [] });
    }
    if (q.length > 200) {
      return NextResponse.json({ error: 'query too long' }, { status: 400 });
    }

    const key = `s:${q.toLowerCase()}`;
    const cached = cacheGet(key);
    if (cached) return NextResponse.json({ results: cached, cached: true });

    // countrycodes=in keeps results relevant: a donor in Delhi searching
    // "Springfield" should not be offered one in Illinois.
    const url =
      `${NOMINATIM}/search?format=jsonv2&q=${encodeURIComponent(q)}` +
      `&countrycodes=in&limit=5&addressdetails=1`;
    const results = await callNominatim(url);
    cacheSet(key, results);
    return NextResponse.json({ results });
  } catch (err) {
    // The map still works without geocoding — the donor can drop a pin by
    // hand — so a geocoder outage degrades the feature instead of breaking
    // the form. 502 tells the client "upstream", not "you sent nonsense".
    const message = err instanceof Error ? err.message : 'geocoding failed';
    return NextResponse.json({ error: message, results: [] }, { status: 502 });
  }
}
