'use client';

// ============================================================================
// LocationMap — read-only map for the donation detail page.
//
// THE INTERESTING PART IS THE PRIVACY BEHAVIOUR, not the map.
//
// The database already masks location for anyone who has not claimed or been
// assigned to a donation: the `donations_public` view nulls the address and
// rounds coordinates with round(lat, 2). Six decimal places locate a doorway
// to about 11 cm; two decimal places locate it to about 1.1 km.
//
// A map could quietly undo that. Dropping a sharp pin on rounded coordinates
// looks precise, and a viewer would reasonably read it as "the food is at this
// building" — which is a false claim, and an invitation to go knock on the
// wrong door. So:
//
//   revealed = true   -> a pin at the exact point, street zoom
//   revealed = false  -> a translucent circle of ~1.1 km and NO pin, zoomed out
//
// The circle is not decoration. Its radius is the actual uncertainty created
// by rounding, so the picture and the data finally agree: "somewhere in here".
// A visual that is honest about its own precision is the whole point.
// ============================================================================

import { useEffect, useRef } from 'react';
import type * as LeafletNS from 'leaflet';
import 'leaflet/dist/leaflet.css';

/** Metres of uncertainty introduced by round(lat, 2) — 0.01° ≈ 1.1 km. */
const MASK_RADIUS_M = 1100;

const EXACT_ZOOM = 16;
const MASKED_ZOOM = 12;

const MARKER_SVG = `
<svg viewBox="0 0 24 24" width="34" height="34" aria-hidden="true"
     style="filter:drop-shadow(0 2px 3px rgba(0,0,0,.4))">
  <path fill="#059669" stroke="#fff" stroke-width="1.5"
        d="M12 1.5c-4.1 0-7.5 3.3-7.5 7.4 0 5.3 6.7 12.9 7 13.2.3.3.7.3 1 0 .3-.3 7-8 7-13.2 0-4.1-3.4-7.4-7.5-7.4z"/>
  <circle cx="12" cy="9" r="2.8" fill="#fff"/>
</svg>`;

export type LocationMapProps = {
  lat: number;
  lng: number;
  /** True once the viewer is the donor, claiming NGO, assigned volunteer, or an admin. */
  revealed: boolean;
};

export default function LocationMap({ lat, lng, revealed }: LocationMapProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<LeafletNS.Map | null>(null);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      const L = (await import('leaflet')).default;
      if (cancelled || !containerRef.current || mapRef.current) return;

      const map = L.map(containerRef.current, {
        center: [lat, lng],
        zoom: revealed ? EXACT_ZOOM : MASKED_ZOOM,
        scrollWheelZoom: false,
        // Nothing to pick here, so the map is a picture: no drag, no zoom
        // controls, no keyboard trap for someone tabbing through the page.
        dragging: false,
        zoomControl: false,
        doubleClickZoom: false,
        boxZoom: false,
        keyboard: false,
        touchZoom: false,
        attributionControl: true,
      });

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution:
          '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      }).addTo(map);

      if (revealed) {
        const icon = L.divIcon({
          html: MARKER_SVG,
          className: 'f4a-pin',
          iconSize: [34, 34],
          iconAnchor: [17, 33],
        });
        L.marker([lat, lng], { icon, interactive: false }).addTo(map);
      } else {
        L.circle([lat, lng], {
          radius: MASK_RADIUS_M,
          color: '#d97706',
          weight: 2,
          dashArray: '6 5',
          fillColor: '#f59e0b',
          fillOpacity: 0.14,
          interactive: false,
        }).addTo(map);
      }

      mapRef.current = map;
    })();

    return () => {
      cancelled = true;
      mapRef.current?.remove();
      mapRef.current = null;
    };
    // Rebuild on any change: this map has no interactive state worth keeping,
    // and `revealed` flipping (the NGO just claimed it) should redraw cleanly
    // from circle to pin rather than try to mutate layers in place.
  }, [lat, lng, revealed]);

  return (
    <div className="space-y-1.5">
      <div
        ref={containerRef}
        className="h-56 w-full overflow-hidden rounded-2xl border dark:border-white/10"
        style={{ minHeight: '14rem' }}
        role="img"
        aria-label={
          revealed
            ? `Map showing the exact pickup point at ${lat.toFixed(5)}, ${lng.toFixed(5)}`
            : 'Map showing the approximate pickup area, about one kilometre across. The exact address is hidden until an NGO claims this donation.'
        }
      />
      {!revealed && (
        <p className="text-xs font-semibold text-amber-700 dark:text-amber-300">
          Approximate area only — the circle is about 1 km across. The exact point appears once
          this donation is claimed.
        </p>
      )}
    </div>
  );
}
