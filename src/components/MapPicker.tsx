'use client';

// ============================================================================
// MapPicker — pick a pickup point on a real map instead of typing coordinates.
//
// WHY THIS EXISTS: before this component the donor form had two bare number
// inputs, "Lat" and "Lng", with a tip saying "drop a pin on OpenStreetMap and
// paste the coordinates". That is a developer's workaround, not a product. A
// restaurant manager with ten trays of leftover biryani and twenty minutes of
// shelf life is not going to open a second website to copy decimal degrees.
//
// WHY LEAFLET AND NOT GOOGLE MAPS: Google Maps JavaScript API bills per map
// load and requires a key with a card attached. Leaflet is MIT-licensed and
// renders tiles from any source; OpenStreetMap's public tile server is free
// and requires only attribution. Total cost of this feature: zero.
//
// WHY VANILLA LEAFLET AND NOT react-leaflet: react-leaflet is a thin wrapper
// that adds a peer-dependency relationship to React's version. We need exactly
// one map with one marker — the wrapper would add a dependency to maintain and
// buy us nothing. Leaflet is imported dynamically inside useEffect so its
// module body never executes during server rendering.
//
// WHY THE DEFAULT MARKER ICON IS REPLACED: Leaflet's stock marker is a PNG
// referenced by a relative URL computed from the stylesheet's location. Under a
// bundler that path resolves to nothing and you get a silently invisible
// marker. An inline SVG divIcon has no asset to lose.
// ============================================================================

import { useCallback, useEffect, useId, useRef, useState } from 'react';
import type * as LeafletNS from 'leaflet';
import 'leaflet/dist/leaflet.css';

type GeoResult = { label: string; lat: number; lng: number };

/** India's rough geographic centre — a neutral starting view. */
const FALLBACK = { lat: 22.9734, lng: 78.6569, zoom: 4 };

/** A dropped pin opens at street level, not country level. */
const PIN_ZOOM = 16;

/** Pause after the last keystroke before calling the geocoder. */
const SEARCH_DEBOUNCE_MS = 450;

const MARKER_SVG = `
<svg viewBox="0 0 24 24" width="34" height="34" aria-hidden="true"
     style="filter:drop-shadow(0 2px 3px rgba(0,0,0,.4))">
  <path fill="#059669" stroke="#fff" stroke-width="1.5"
        d="M12 1.5c-4.1 0-7.5 3.3-7.5 7.4 0 5.3 6.7 12.9 7 13.2.3.3.7.3 1 0 .3-.3 7-8 7-13.2 0-4.1-3.4-7.4-7.5-7.4z"/>
  <circle cx="12" cy="9" r="2.8" fill="#fff"/>
</svg>`;

export type MapPickerProps = {
  lat: number | null;
  lng: number | null;
  /** Called on map click, marker drag, search pick, or browser geolocation. */
  onChange: (next: { lat: number; lng: number; label?: string }) => void;
};

export default function MapPicker({ lat, lng, onChange }: MapPickerProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<LeafletNS.Map | null>(null);
  const markerRef = useRef<LeafletNS.Marker | null>(null);
  const leafletRef = useRef<typeof LeafletNS | null>(null);

  // onChange is called from Leaflet event handlers that are registered once.
  // Reading the latest callback through a ref keeps those handlers stable
  // instead of tearing the map down and rebuilding it on every parent render.
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  const [query, setQuery] = useState('');
  const [results, setResults] = useState<GeoResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const listboxId = useId();

  // ------------------------------------------------------------------
  // Reverse-geocode a dropped pin so the address field fills itself.
  // Best-effort: a geocoder outage must not block the donation.
  // ------------------------------------------------------------------
  const reverse = useCallback(async (la: number, ln: number) => {
    onChangeRef.current({ lat: la, lng: ln });
    try {
      const res = await fetch(`/api/geocode?lat=${la}&lng=${ln}`);
      const data: { results?: GeoResult[] } = await res.json();
      const label = data.results?.[0]?.label;
      if (label) onChangeRef.current({ lat: la, lng: ln, label });
    } catch {
      // Coordinates are already saved above; only the auto-filled address
      // text is lost, and the donor can type it.
    }
  }, []);

  // ------------------------------------------------------------------
  // Create the map exactly once.
  // ------------------------------------------------------------------
  useEffect(() => {
    let cancelled = false;

    (async () => {
      const L = (await import('leaflet')).default;
      // Bail out if React unmounted us while the chunk was downloading;
      // otherwise Leaflet initialises into a detached DOM node.
      if (cancelled || !containerRef.current || mapRef.current) return;
      leafletRef.current = L;

      const hasPin = lat !== null && lng !== null;
      const map = L.map(containerRef.current, {
        center: hasPin ? [lat, lng] : [FALLBACK.lat, FALLBACK.lng],
        zoom: hasPin ? PIN_ZOOM : FALLBACK.zoom,
        // The map sits inside a scrollable form. Grabbing the page scroll to
        // zoom is hostile, so require Ctrl/⌘ + wheel (Leaflet shows a hint).
        scrollWheelZoom: false,
      });

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        // Not decoration: OSM's tile usage policy requires visible credit.
        attribution:
          '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      }).addTo(map);

      map.on('click', (e: LeafletNS.LeafletMouseEvent) => {
        void reverse(e.latlng.lat, e.latlng.lng);
      });

      mapRef.current = map;
      setReady(true);
    })();

    return () => {
      cancelled = true;
      mapRef.current?.remove();
      mapRef.current = null;
      markerRef.current = null;
    };
    // Deliberately empty: `lat`/`lng` seed the first view only. Keeping them
    // out means a later coordinate change pans the existing map (effect
    // below) rather than destroying and rebuilding it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ------------------------------------------------------------------
  // Mirror the controlled lat/lng into the marker.
  // ------------------------------------------------------------------
  useEffect(() => {
    const L = leafletRef.current;
    const map = mapRef.current;
    if (!L || !map || !ready) return;

    if (lat === null || lng === null) {
      markerRef.current?.remove();
      markerRef.current = null;
      return;
    }

    if (!markerRef.current) {
      const icon = L.divIcon({
        html: MARKER_SVG,
        className: 'f4a-pin',
        iconSize: [34, 34],
        iconAnchor: [17, 33], // tip of the teardrop, not its centre
      });
      const marker = L.marker([lat, lng], { draggable: true, icon }).addTo(map);
      marker.on('dragend', () => {
        const p = marker.getLatLng();
        void reverse(p.lat, p.lng);
      });
      markerRef.current = marker;
    } else {
      markerRef.current.setLatLng([lat, lng]);
    }

    // Only recentre when the pin has moved out of view, so a small drag does
    // not yank the map away from what the donor is looking at.
    if (!map.getBounds().contains([lat, lng])) {
      map.setView([lat, lng], Math.max(map.getZoom(), PIN_ZOOM));
    }
  }, [lat, lng, ready, reverse]);

  // ------------------------------------------------------------------
  // Debounced forward search.
  // ------------------------------------------------------------------
  useEffect(() => {
    const q = query.trim();
    if (q.length < 3) {
      setResults([]);
      return;
    }

    const controller = new AbortController();
    const timer = setTimeout(async () => {
      setSearching(true);
      setNote(null);
      try {
        const res = await fetch(`/api/geocode?q=${encodeURIComponent(q)}`, {
          signal: controller.signal,
        });
        const data: { results?: GeoResult[] } = await res.json();
        const found = data.results ?? [];
        setResults(found);
        if (found.length === 0) {
          setNote('No match. Drop a pin on the map instead.');
        }
      } catch (err) {
        // An aborted request is the expected outcome of typing another
        // character — not a failure worth showing the donor.
        if ((err as Error)?.name !== 'AbortError') {
          setNote('Search is unavailable. You can still drop a pin.');
        }
      } finally {
        setSearching(false);
      }
    }, SEARCH_DEBOUNCE_MS);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [query]);

  function choose(r: GeoResult) {
    setResults([]);
    setQuery(r.label);
    onChangeRef.current({ lat: r.lat, lng: r.lng, label: r.label });
  }

  function locateMe() {
    if (!('geolocation' in navigator)) {
      setNote('This browser cannot share your location.');
      return;
    }
    setNote('Finding your location…');
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setNote(null);
        void reverse(pos.coords.latitude, pos.coords.longitude);
      },
      () => setNote('Location permission denied. Drop a pin instead.'),
      { enableHighAccuracy: true, timeout: 10_000 },
    );
  }

  const inputCls =
    'w-full rounded-2xl border bg-white px-3.5 py-2.5 text-sm shadow-soft placeholder:text-slate-400 focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-100 dark:border-white/10 dark:bg-slate-800 dark:text-white dark:placeholder:text-slate-500';

  return (
    <div className="space-y-3">
      {/* ---------- search + locate ---------- */}
      <div className="flex flex-col gap-2 sm:flex-row">
        <div className="relative flex-1">
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search a place — e.g. Connaught Place, New Delhi"
            className={inputCls}
            role="combobox"
            aria-expanded={results.length > 0}
            aria-controls={listboxId}
            aria-autocomplete="list"
          />
          {searching && (
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-semibold text-slate-400">
              …
            </span>
          )}
          {results.length > 0 && (
            <ul
              id={listboxId}
              role="listbox"
              // Leaflet's own control panes sit at z-index 1000. The dropdown
              // hangs over the map, so it has to clear them or the zoom
              // buttons punch through the suggestion list.
              className="absolute z-[1100] mt-1 max-h-60 w-full overflow-auto rounded-2xl border bg-white py-1 shadow-card dark:border-white/10 dark:bg-slate-800"
            >
              {results.map((r) => (
                <li key={`${r.lat},${r.lng}`} role="option" aria-selected={false}>
                  <button
                    type="button"
                    onClick={() => choose(r)}
                    className="block w-full px-3.5 py-2 text-left text-sm hover:bg-brand-50 dark:text-slate-200 dark:hover:bg-white/10"
                  >
                    {r.label}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
        <button
          type="button"
          onClick={locateMe}
          className="shrink-0 rounded-2xl border px-4 py-2.5 text-sm font-bold hover:bg-slate-50 dark:border-white/10 dark:text-slate-200 dark:hover:bg-white/10"
        >
          Use my location
        </button>
      </div>

      {/* ---------- the map ---------- */}
      <div
        ref={containerRef}
        className="h-72 w-full overflow-hidden rounded-2xl border bg-slate-100 dark:border-white/10 dark:bg-slate-800"
        // Leaflet measures its container on init; without a height here the
        // map would initialise at 0px and render a grey void.
        style={{ minHeight: '18rem' }}
      />

      <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
        <p className="text-slate-600 dark:text-slate-400">
          Click the map or drag the pin to set the exact pickup point.
        </p>
        {lat !== null && lng !== null ? (
          <code className="rounded-lg bg-slate-100 px-2 py-1 font-semibold text-slate-700 dark:bg-white/10 dark:text-slate-300">
            {lat.toFixed(6)}, {lng.toFixed(6)}
          </code>
        ) : (
          <span className="font-semibold text-amber-700 dark:text-amber-400">
            No pickup point set yet
          </span>
        )}
      </div>

      {note && (
        <p className="rounded-2xl bg-amber-50 p-3 text-xs font-semibold text-amber-800 dark:bg-amber-950/40 dark:text-amber-200">
          {note}
        </p>
      )}
    </div>
  );
}
