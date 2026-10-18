import Link from 'next/link';
import StatusBadge from './StatusBadge';
import FoodTypeBadge from './FoodTypeBadge';

export type FoodCardData = {
  id: string;
  title: string;
  food_type: string;
  status: string;
  quantity_desc: string;
  servings_estimate?: number | null;
  best_before?: string;
  pickup_address?: string | null;
  address_revealed?: boolean;
  photo_url?: string | null;
};

/**
 * A donation summary card.
 *
 * `photoUrl` is a short-lived signed URL minted on the server (see lib/media.ts),
 * not the stored value — the buckets are private, so a stored path is not
 * loadable by a browser. When it is absent the decorative strip stands in, which
 * is also what an unauthenticated or unauthorised viewer sees.
 */
export default function FoodCard({ food, photoUrl }: { food: FoodCardData; photoUrl?: string }) {
  return (
    <Link
      href={`/donations/${food.id}`}
      className="group flex flex-col overflow-hidden rounded-[20px] border bg-white shadow-soft transition hover:shadow-card dark:border-white/10 dark:bg-slate-900/60"
    >
      {/* The photo says more than the decorative strip does, so it replaces it
          rather than sitting beside it. alt names the food, not the fact that an
          image exists — a screen reader should hear "Veg biryani", not "photo". */}
      {photoUrl ? (
        <div className="aspect-[4/3] w-full overflow-hidden bg-slate-100 dark:bg-slate-800">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={photoUrl}
            alt={food.title}
            loading="lazy"
            className="h-full w-full object-cover transition duration-300 group-hover:scale-[1.03]"
          />
        </div>
      ) : (
        <div
          aria-hidden
          className="flex h-24 items-center justify-between gap-3 border-b bg-gradient-to-r from-brand-50 to-emerald-50 px-5 text-[10px] font-black uppercase tracking-[0.18em] text-brand-800 dark:border-white/10 dark:from-brand-950/40 dark:to-emerald-950/30 dark:text-brand-200"
        >
          <span className="text-xl">✳</span>
          <span className="text-right leading-relaxed">
            {food.food_type === 'nonveg' ? 'PREPARED WITH CARE' : 'GOOD FOOD. ANOTHER CHANCE.'}
          </span>
        </div>
      )}

      <div className="flex flex-1 flex-col gap-2 p-5">
        <div className="flex flex-wrap gap-2">
          <FoodTypeBadge type={food.food_type as never} />
          <StatusBadge status={food.status as never} />
        </div>
        <h3 className="font-display text-base font-extrabold leading-tight group-hover:text-brand-700 dark:text-white dark:group-hover:text-brand-300">
          {food.title}
        </h3>
        <p className="text-sm leading-relaxed text-slate-600 dark:text-slate-400">{food.quantity_desc}</p>

        <div className="mt-auto flex flex-wrap gap-2 pt-2 text-xs font-semibold text-slate-500 dark:text-slate-400">
          <span className="rounded-full border bg-slate-50 px-2.5 py-1 dark:border-white/10 dark:bg-white/5">
            {food.servings_estimate != null ? `${food.servings_estimate} estimated servings` : 'See quantity details'}
          </span>
          {food.best_before && (
            <span className="rounded-full border bg-slate-50 px-2.5 py-1 dark:border-white/10 dark:bg-white/5">
              Best before{' '}
              {new Intl.DateTimeFormat('en-IN', {
                timeZone: 'Asia/Kolkata',
                day: 'numeric',
                month: 'short',
                hour: 'numeric',
                minute: '2-digit',
              }).format(new Date(food.best_before))}{' '}
              IST
            </span>
          )}
        </div>

        <div className="flex items-center justify-between gap-2 border-t pt-3 text-xs text-slate-500 dark:border-white/10 dark:text-slate-400">
          <span className="line-clamp-1">
            {food.address_revealed && food.pickup_address ? food.pickup_address : 'Pickup details kept private'}
          </span>
          <span aria-hidden>↗</span>
        </div>
      </div>
    </Link>
  );
}
