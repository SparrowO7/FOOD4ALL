'use client';
import { useMemo, useState } from 'react';

/**
 * Renders the Schedule-II register and exports it as CSV.
 *
 * The export matters more than the table: when someone asks a donor or an NGO to
 * produce its record of surplus food, a file it can hand over is the answer. The
 * column order follows Schedule-II so the two can be read side by side.
 */

export type RegisterRow = {
  donation_id: string;
  donor_name: string;
  donor_address: string | null;
  donor_fssai_licence: string | null;
  sfdo_name: string | null;
  sfdo_address: string | null;
  sfdo_fssai_licence: string | null;
  donation_date: string;
  food_item: string;
  batch_no: string | null;
  date_of_manufacture: string | null;
  best_before: string;
  quantity_donated: string;
  servings_offered: number | null;
  food_temperature_c: number | null;
  servings_distributed: number | null;
  distribution_area: string | null;
  distribution_date: string | null;
  status: string;
  veg_nonveg: string;
  is_perishable: boolean;
  donor_attested_unserved: boolean;
};

// Schedule-II order, with the column headings spelled the way the schedule
// spells them so an inspector can match them without a translation step.
const COLUMNS: { key: keyof RegisterRow; head: string }[] = [
  { key: 'donor_name', head: '1. Donor organisation' },
  { key: 'donor_address', head: '1. Donor address' },
  { key: 'sfdo_name', head: '2. Distribution organisation' },
  { key: 'sfdo_address', head: '2. Distribution org address' },
  { key: 'donation_date', head: '3. Donation date' },
  { key: 'food_item', head: '4. Food item' },
  { key: 'batch_no', head: '5. Batch number' },
  { key: 'date_of_manufacture', head: '6. Date of manufacture' },
  { key: 'best_before', head: '7. Best before' },
  { key: 'quantity_donated', head: '8. Quantity donated' },
  { key: 'food_temperature_c', head: '9. Temperature (°C)' },
  { key: 'servings_distributed', head: '10. Quantity distributed' },
  { key: 'distribution_area', head: '11. Distribution area' },
  { key: 'distribution_date', head: '12. Date of distribution' },
  { key: 'veg_nonveg', head: 'Veg / non-veg' },
  { key: 'status', head: 'Status' },
];

function show(v: unknown): string {
  if (v === null || v === undefined || v === '') return '';
  if (typeof v === 'boolean') return v ? 'Yes' : 'No';
  if (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}T/.test(v)) {
    return new Date(v).toLocaleString();
  }
  return String(v);
}

/** RFC 4180 quoting: a field containing a quote, comma or newline must be
 *  wrapped in quotes with inner quotes doubled, or the file breaks on import. */
function csvField(v: string): string {
  return /[",\n\r]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v;
}

export default function RegisterTable({ rows }: { rows: RegisterRow[] }) {
  const [onlyGaps, setOnlyGaps] = useState(false);

  const gaps = useMemo(() => ({
    batch: rows.filter((r) => !r.batch_no).length,
    temp: rows.filter((r) => r.food_temperature_c === null).length,
    area: rows.filter((r) => r.status === 'completed' && !r.distribution_area).length,
  }), [rows]);

  const shown = useMemo(
    () => (onlyGaps
      ? rows.filter((r) => !r.batch_no || r.food_temperature_c === null ||
          (r.status === 'completed' && !r.distribution_area))
      : rows),
    [rows, onlyGaps],
  );

  function downloadCsv() {
    const header = COLUMNS.map((c) => csvField(c.head)).join(',');
    const body = shown.map((r) => COLUMNS.map((c) => csvField(show(r[c.key]))).join(',')).join('\n');
    const blob = new Blob([`${header}\n${body}\n`], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `surplus-food-register-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  if (!rows.length) {
    return (
      <div className="rounded-2xl border border-dashed bg-slate-50 p-8 text-center dark:border-white/10 dark:bg-white/5">
        <p className="text-sm font-bold dark:text-white">No donations in the register yet</p>
        <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
          A donation enters the record once it is published. Drafts are excluded.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Coverage, not compliance. Stating how often a legally required field is
          actually filled is more useful than asserting the register is complete. */}
      <div className="grid gap-3 sm:grid-cols-4">
        <Stat label="Donations on record" value={String(rows.length)} />
        <Stat label="Missing batch number" value={String(gaps.batch)} warn={gaps.batch > 0} />
        <Stat label="Temperature not measured" value={String(gaps.temp)} warn={gaps.temp > 0} />
        <Stat label="Completed, no area recorded" value={String(gaps.area)} warn={gaps.area > 0} />
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <button onClick={downloadCsv} className="rounded-full bg-slate-900 px-5 py-2.5 text-sm font-extrabold text-white hover:bg-black dark:bg-white dark:text-slate-900">
          Download CSV ({shown.length} rows)
        </button>
        <label className="inline-flex items-center gap-2 rounded-full border bg-white px-4 py-2 text-sm font-bold dark:border-white/10 dark:bg-white/5 dark:text-white">
          <input type="checkbox" checked={onlyGaps} onChange={(e) => setOnlyGaps(e.target.checked)} className="h-4 w-4" />
          Only rows with gaps
        </label>
      </div>

      <div className="overflow-x-auto rounded-2xl border dark:border-white/10">
        <table className="w-full border-collapse text-left text-xs">
          <thead>
            <tr className="bg-slate-900 text-white dark:bg-white/10">
              {COLUMNS.map((c) => (
                <th key={c.key} className="whitespace-nowrap px-3 py-2.5 font-bold">{c.head}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {shown.map((r) => (
              <tr key={r.donation_id} className="border-t odd:bg-white even:bg-slate-50 dark:border-white/10 dark:odd:bg-slate-900/40 dark:even:bg-white/[0.03]">
                {COLUMNS.map((c) => {
                  const text = show(r[c.key]);
                  return (
                    <td key={c.key} className="whitespace-nowrap px-3 py-2 dark:text-slate-200">
                      {text || <span className="text-slate-400 dark:text-slate-600">—</span>}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Stat({ label, value, warn }: { label: string; value: string; warn?: boolean }) {
  return (
    <div className={`rounded-2xl border p-3 dark:border-white/10 ${warn ? 'bg-amber-50 dark:bg-amber-950/25' : 'bg-white dark:bg-white/5'}`}>
      <div className="text-xs font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">{label}</div>
      <div className="mt-0.5 text-xl font-extrabold dark:text-white">{value}</div>
    </div>
  );
}
