'use client';
import { useEffect, useState } from 'react';

function fmt(iso: string) {
  const d = new Date(iso).getTime() - Date.now();
  if (d <= 0) return 'Expired';
  const h = Math.floor(d / 3600000);
  const m = Math.floor((d % 3600000) / 60000);
  if (h > 24) return `${Math.floor(h / 24)}d ${h % 24}h left`;
  if (h > 0) return `${h}h ${m}m left`;
  return `${m}m left`;
}

export default function FreshnessMeter({
  bestBefore,
  preparedAt,
  storage,
  status,
}: {
  bestBefore: string;
  preparedAt?: string | null;
  storage?: string;
  status: string;
}) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 30000);
    return () => clearInterval(id);
  }, []);
  const end = new Date(bestBefore).getTime();
  const start = preparedAt ? new Date(preparedAt).getTime() : end - 6 * 3600000;
  const total = Math.max(1, end - start);
  const remain = end - now;
  const pct = Math.max(0, Math.min(100, (remain / total) * 100));
  const expired = remain <= 0 || status === 'expired';
  const tone =
    expired || pct < 15 ? 'from-red-500 to-orange-500' : pct < 40 ? 'from-amber-500 to-orange-500' : 'from-emerald-500 to-teal-500';
  const label = expired ? 'EXPIRED — do not distribute' : pct < 15 ? 'Critical — act now' : pct < 40 ? 'Use soon' : 'Fresh';

  return (
    <div className="rounded-[20px] border bg-white p-4 shadow-soft dark:border-white/10 dark:bg-slate-900/60">
      <div className="flex items-center justify-between gap-3">
        <div className="text-xs font-black uppercase tracking-widest text-slate-500 dark:text-slate-400">Freshness · FSSAI window</div>
        <span className="rounded-full border bg-slate-50 px-2.5 py-1 text-xs font-bold dark:border-white/10 dark:bg-white/5 dark:text-slate-200">
          {storage ?? 'room'} · {fmt(bestBefore)}
        </span>
      </div>
      <div className="mt-3 h-2.5 overflow-hidden rounded-full bg-slate-100 dark:bg-white/10">
        <div className={`h-full rounded-full bg-gradient-to-r ${tone} transition-all`} style={{ width: `${expired ? 100 : pct}%`, opacity: expired ? 0.9 : 1 }} />
      </div>
      <div className="mt-2 flex items-center justify-between text-xs">
        <span className={`font-black ${expired ? 'text-red-600 dark:text-red-300' : 'text-slate-700 dark:text-slate-200'}`}>{label}</span>
        <span className="font-mono text-slate-500 dark:text-slate-400">
          {preparedAt ? `Prepped ${new Date(preparedAt).toLocaleString()} → ` : ''}
          Best before {new Date(bestBefore).toLocaleString()}
        </span>
      </div>
      {expired && <p className="mt-2 rounded-xl bg-red-50 p-2 text-xs font-semibold text-red-700 dark:bg-red-950/40 dark:text-red-200">Guard blocks claim/publish past best-before. System cron marks expired.</p>}
    </div>
  );
}
