import { STATUS_LABEL, STATUS_COLOR, type DonationStatus } from '@/types/database';

export default function StatusBadge({ status }: { status: DonationStatus }) {
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-extrabold shadow-soft ${STATUS_COLOR[status]}`}>
      <span className="h-1.5 w-1.5 rounded-full bg-current opacity-70" />
      {STATUS_LABEL[status]}
    </span>
  );
}
