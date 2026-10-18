'use client';

/**
 * The statutory label for donated prepared food.
 *
 * Regulation 6(3) of the Food Safety and Standards (Recovery and Distribution of
 * Surplus Food) Regulations, 2019 requires donated prepared food to be labelled
 * with exactly five things: the name of the food, the SOURCE of the food, the
 * date of preparation, the last date of consumption, and whether it is
 * vegetarian or non-vegetarian. All five are rendered below.
 *
 * So this is not a decorative summary card — printed and attached to the
 * container, it is the label the regulation asks for. Two consequences shape the
 * markup:
 *
 *   - reg 6(4): "The information on the label shall not be masked in any
 *     manner." Nothing here is abbreviated or hidden, including the donor's
 *     name. The location masking elsewhere in the app applies to the pre-claim
 *     board listing, which is a different artefact for a different audience.
 *
 *   - It has to survive a monochrome office printer. Colour is used only to
 *     reinforce, never to carry meaning, and print styles drop the tints.
 */

function qrUrl(target: string) {
  // Same third-party service the share card uses. Worth replacing with a local
  // generator before the pilot: it sends every donation id to an external host,
  // and a label printed without a network connection would have no QR at all.
  return `https://api.qrserver.com/v1/create-qr-code/?size=240x240&data=${encodeURIComponent(target)}`;
}

const FOOD_TYPE_DECLARATION: Record<string, string> = {
  veg: 'VEGETARIAN',
  vegan: 'VEGETARIAN (VEGAN)',
  jain: 'VEGETARIAN (JAIN)',
  nonveg: 'NON-VEGETARIAN',
};

function fmt(ts: string | null) {
  if (!ts) return '—';
  return new Date(ts).toLocaleString('en-IN', {
    timeZone: 'Asia/Kolkata', timeZoneName: 'short',
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

function Cell({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="border-t border-slate-300 px-4 py-2.5 dark:border-white/20 print:border-black">
      <div className="text-[10px] font-black uppercase tracking-widest text-slate-500 dark:text-slate-400 print:text-black">
        {label}
      </div>
      <div className={`mt-0.5 dark:text-white print:text-black ${strong ? 'text-base font-extrabold' : 'text-sm font-bold'}`}>
        {value}
      </div>
    </div>
  );
}

export default function FoodSafetyLabel({
  id, title, source, foodType, isCooked, preparedAt, bestBefore,
  quantityDesc, servings, batchNo, foodTempC, isPerishable, storage,
  allergens, traceUrl,
}: {
  id: string;
  title: string;
  source: string;
  foodType: string;
  isCooked: boolean;
  preparedAt: string | null;
  bestBefore: string;
  quantityDesc: string;
  servings: number | null;
  batchNo: string | null;
  foodTempC: number | null;
  isPerishable: boolean;
  storage: string;
  allergens: string | null;
  traceUrl: string;
}) {
  const nonVeg = foodType === 'nonveg';

  return (
    <section className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2 print:hidden">
        <h2 className="font-display font-extrabold dark:text-white">Food safety label</h2>
        <button
          onClick={() => window.print()}
          className="rounded-full bg-slate-900 px-4 py-2 text-xs font-extrabold text-white hover:bg-slate-700 dark:bg-white dark:text-slate-900"
        >
          Print label
        </button>
      </div>
      <p className="text-xs text-slate-600 dark:text-slate-400 print:hidden">
        Print this and attach it to the container. It carries the five things the FSSAI surplus
        food rules require on donated prepared food.
      </p>

      <div className="overflow-hidden rounded-2xl border-2 border-slate-900 bg-white dark:border-white/30 dark:bg-slate-900 print:rounded-none print:border-black print:bg-white">
        {/* header */}
        <div className="flex items-start justify-between gap-3 bg-slate-900 px-4 py-3 text-white dark:bg-white/10 print:bg-white print:text-black">
          <div>
            <div className="text-sm font-black uppercase tracking-widest">Food4All India · Donated food</div>
            <div className="mt-0.5 text-[10px] font-semibold leading-snug opacity-80">
              FSS (Recovery and Distribution of Surplus Food) Regulations, 2019 — reg 6(3)
            </div>
          </div>
          {/* The veg / non-veg declaration is the one field a recipient checks
              first, so it is the one thing set large enough to read at arm's
              length. The square-in-a-circle convention is intentional. */}
          <div
            className={`shrink-0 rounded-md border-2 px-2.5 py-1 text-center text-[11px] font-black leading-tight ${
              nonVeg ? 'border-red-400 text-red-200 print:border-black print:text-black'
                     : 'border-green-400 text-green-200 print:border-black print:text-black'
            }`}
          >
            {nonVeg ? '● NON-VEG' : '■ VEG'}
          </div>
        </div>

        {/* name of the food — reg 6(3) */}
        <div className="px-4 py-3">
          <div className="text-[10px] font-black uppercase tracking-widest text-slate-500 dark:text-slate-400 print:text-black">
            Name of food
          </div>
          <div className="mt-0.5 text-xl font-extrabold leading-tight dark:text-white print:text-black">{title}</div>
          <div className="mt-0.5 text-sm font-semibold text-slate-600 dark:text-slate-300 print:text-black">
            {quantityDesc}{servings ? ` · approx. ${servings} servings` : ''}
            {isCooked ? ' · cooked' : ' · uncooked'}
          </div>
        </div>

        <div className="grid sm:grid-cols-2">
          {/* source of the food — reg 6(3). Never abbreviated: reg 6(4). */}
          <Cell label="Source of food" value={source} strong />
          <Cell label="Date of preparation" value={fmt(preparedAt)} strong />
          {/* The safety-critical field. */}
          <Cell label="Consume before" value={fmt(bestBefore)} strong />
          <Cell label="Declaration" value={FOOD_TYPE_DECLARATION[foodType] ?? foodType.toUpperCase()} strong />
        </div>

        <div className="grid sm:grid-cols-3">
          <Cell label="Batch" value={batchNo ?? '—'} />
          {/* "Not recorded" rather than a dash: a blank here is a real fact
              about the donation, not a rendering gap. */}
          <Cell label="Temperature" value={foodTempC === null ? 'Not recorded' : `${foodTempC} °C`} />
          <Cell label="Storage" value={`${isPerishable ? 'Perishable' : 'Non-perishable'} · ${storage.replace('_', ' ')}`} />
        </div>

        {allergens && (
          <div className="border-t-2 border-slate-900 px-4 py-2.5 dark:border-white/30 print:border-black">
            <div className="text-[10px] font-black uppercase tracking-widest text-slate-500 dark:text-slate-400 print:text-black">
              Allergen information
            </div>
            <div className="mt-0.5 text-sm font-extrabold dark:text-white print:text-black">{allergens}</div>
          </div>
        )}

        {/* verification */}
        <div className="flex items-center gap-4 border-t-2 border-slate-900 px-4 py-3 dark:border-white/30 print:border-black">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={qrUrl(traceUrl)} alt="Scan to verify this donation" width={92} height={92} className="shrink-0 border border-slate-300 bg-white p-1 dark:border-white/20 print:border-black" />
          <div className="min-w-0">
            <div className="text-[10px] font-black uppercase tracking-widest text-slate-500 dark:text-slate-400 print:text-black">
              Scan to verify the full record
            </div>
            <div className="mt-0.5 break-all font-mono text-[11px] dark:text-slate-200 print:text-black">{traceUrl}</div>
            <div className="mt-1 font-mono text-[10px] text-slate-500 dark:text-slate-400 print:text-black">
              Donation ID {id}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
