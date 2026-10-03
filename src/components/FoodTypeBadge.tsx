import { FOOD_TYPE_LABEL, type FoodType } from '@/types/database';

const COLOR: Record<FoodType, string> = {
  veg: 'bg-emerald-50 text-emerald-700 ring-emerald-600/20 border-emerald-200',
  nonveg: 'bg-red-50 text-red-700 ring-red-600/20 border-red-200',
  vegan: 'bg-lime-50 text-lime-800 ring-lime-600/20 border-lime-200',
  jain: 'bg-amber-50 text-amber-800 ring-amber-600/20 border-amber-200',
};

export default function FoodTypeBadge({ type }: { type: FoodType }) {
  return (
    <span className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-black ring-1 ring-inset ${COLOR[type]}`}>
      {FOOD_TYPE_LABEL[type]}
    </span>
  );
}
