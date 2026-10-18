'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

/**
 * The landing-page hero.
 *
 * Cooked food is safe for *hours*, not days — so the whole product is a race
 * against a clock. The hero is therefore the clock itself: a live board of
 * what is currently on offer and how long each item has left, modelled on the
 * pass in a commercial kitchen rather than on a marketing stat.
 *
 * Rows come from `donations_public`, the same privacy-masked view the browse
 * page uses, so the numbers here are real. When nothing is live the board
 * falls back to clearly-labelled sample rows rather than rendering empty.
 */

export type BoardRow = {
  id: string;
  title: string;
  servings_estimate: number | null;
  quantity_desc: string | null;
  best_before: string;
  is_cooked: boolean | null;
};

/** Shown only when the database has no live donations. Labelled as such. */
const SAMPLE: BoardRow[] = [
  { id: 's1', title: 'Veg biryani, catering tray', servings_estimate: 60, quantity_desc: '2 trays', best_before: '', is_cooked: true },
  { id: 's2', title: 'Chapati + dal, canteen surplus', servings_estimate: 35, quantity_desc: '1 drum', best_before: '', is_cooked: true },
  { id: 's3', title: 'Bananas, unsold crate', servings_estimate: 80, quantity_desc: '1 crate', best_before: '', is_cooked: false },
];

/** Minutes from now until `iso`. Negative once it has passed. */
function minutesLeft(iso: string, now: number): number {
  return (new Date(iso).getTime() - now) / 60000;
}

/**
 * Seconds appear only below an hour. Above that they are noise; below it they
 * are the point — this is the moment a volunteer either moves or the food is
 * lost, and it is the only thing on the page that animates.
 */
function formatLeft(mins: number): string {
  if (mins <= 0) return 'expired';
  if (mins >= 60) {
    const h = Math.floor(mins / 60);
    const m = Math.floor(mins % 60);
    return `${h}h ${String(m).padStart(2, '0')}m`;
  }
  const m = Math.floor(mins);
  const s = Math.floor((mins - m) * 60);
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

export default function RescueBoard({ rows }: { rows: BoardRow[] }) {
  // Sample timings are generated on the client so they are always relative to
  // the viewer's clock, and so the server and client agree at hydration.
  const [now, setNow] = useState<number | null>(null);
  const [sample, setSample] = useState<BoardRow[] | null>(null);

  const isSample = rows.length === 0;

  useEffect(() => {
    const t = Date.now();
    setNow(t);
    if (isSample) {
      // 3h 20m, 48m, 5h 05m — one row deliberately inside the urgent window.
      const offsets = [200, 48, 305];
      setSample(SAMPLE.map((r, i) => ({ ...r, best_before: new Date(t + offsets[i] * 60000).toISOString() })));
    }
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [isSample]);

  const data = isSample ? (sample ?? []) : rows;

  return (
    <div className="rounded-sm border border-white/15 bg-rescue-deep/60 shadow-[0_24px_60px_-20px_rgba(0,0,0,.6)]">
      {/* Board header. Doubles as the legend, so no separate key is needed. */}
      <div className="flex items-baseline justify-between gap-4 border-b border-white/15 px-4 py-3 sm:px-5">
        <div className="flex items-center gap-2.5">
          <span className="pulse-dot relative grid h-2.5 w-2.5 place-items-center">
            <span className="absolute h-2.5 w-2.5 animate-ping rounded-full bg-rescue-marigold/70" />
            <span className="h-2 w-2 rounded-full bg-rescue-marigold" />
          </span>
          <span className="text-[13px] font-semibold tracking-tight text-white">On the board now</span>
          {isSample && (
            <span className="rounded-sm border border-rescue-marigold/40 bg-rescue-marigold/10 px-1.5 py-0.5 text-[10px] font-bold text-rescue-marigold">
              Sample
            </span>
          )}
        </div>
        <span className="text-[11px] font-medium text-rescue-steel/70">Time left before it spoils</span>
      </div>

      <ul className="divide-y divide-white/10">
        {data.map((r) => {
          const mins = now === null ? null : minutesLeft(r.best_before, now);
          const urgent = mins !== null && mins > 0 && mins < 60;
          const gone = mins !== null && mins <= 0;

          return (
            <li key={r.id} className="flex items-center gap-4 px-4 py-3.5 sm:px-5">
              <div className="min-w-0 flex-1">
                <p className="truncate text-[15px] font-semibold leading-snug text-white">{r.title}</p>
                <p className="mt-0.5 text-[12.5px] text-rescue-steel/80">
                  {r.servings_estimate ? `~${r.servings_estimate} servings` : r.quantity_desc ?? 'quantity on request'}
                  {r.is_cooked ? ' · cooked' : ''}
                </p>
              </div>

              {/* Right-aligned and tabular so the digits never shift the row. */}
              <div className="shrink-0 text-right">
                <span
                  className={`tnum block text-[19px] font-bold leading-none ${
                    gone ? 'text-rescue-steel/40' : urgent ? 'text-rescue-chilli' : 'text-rescue-marigold'
                  }`}
                >
                  {mins === null ? '—' : formatLeft(mins)}
                </span>
                {urgent && <span className="mt-1 block text-[10.5px] font-bold text-rescue-chilli">needs a volunteer</span>}
              </div>
            </li>
          );
        })}

        {/* Server returned nothing and the client has not generated the sample
            yet. Reserves the board's height so the hero does not jump. */}
        {data.length === 0 && <li className="px-5 py-14 text-center text-[13px] text-rescue-steel/60">Loading the board…</li>}
      </ul>

      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-white/15 px-4 py-3 sm:px-5">
        <p className="text-[12px] leading-snug text-rescue-steel/70">
          Pickup address appears once an NGO claims the food.
        </p>
        <Link
          href="/donations"
          className="rounded-sm bg-white/10 px-3 py-1.5 text-[12.5px] font-semibold text-white transition-colors hover:bg-white/20"
        >
          See all donations
        </Link>
      </div>
    </div>
  );
}
