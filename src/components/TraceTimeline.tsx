import { FAILURE_REASON_LABELS, type DonationStatus, type FailureReason } from '@/types/database';

// Shape returned by public_trace_events() (0013_public_trace.sql). actor_id is
// intentionally absent: a public label should prove that a volunteer collected
// the food at 21:05 without naming which account that was.
export type TraceEvent = {
  from_status: DonationStatus | null;
  to_status: DonationStatus;
  actor_role: string | null;
  note: string | null;
  reason: FailureReason | null;
  created_at: string;
};

const STEP_META: Record<string, { label: string; desc: string; icon: string }> = {
  draft: { label: 'Draft created', desc: 'Donor started the donation', icon: '📝' },
  available: { label: 'Published · Available', desc: 'Visible to verified NGOs', icon: '📢' },
  claimed: { label: 'Claimed by NGO', desc: 'Receiver accepted · address revealed to NGO', icon: '🤝' },
  pickup_scheduled: { label: 'Pickup scheduled', desc: 'Volunteer assigned · route via OSM/Google', icon: '🛻' },
  picked_up: { label: 'Picked up', desc: 'Volunteer collected the food', icon: '📦' },
  delivered: { label: 'Delivered', desc: 'At NGO · proof + servings logged', icon: '🏠' },
  completed: { label: 'Completed · Served', desc: 'NGO confirmed receipt · impact counted', icon: '✅' },
  cancelled: { label: 'Cancelled', desc: 'Stopped before the food moved', icon: '⛔' },
  expired: { label: 'Expired', desc: 'Freshness window lapsed · auto-blocked', icon: '⏰' },
  // Terminal and deliberately distinct from cancelled: the food was refused by
  // the receiving side, which Schedule-I 2(4) of the surplus food rules
  // contemplates. Recording it as anything else would be a false record.
  rejected: { label: 'Food refused', desc: 'Receiving side would not accept this food', icon: '🚫' },
};

export default function TraceTimeline({ events, status }: { events: TraceEvent[]; status: string }) {
  if (!events?.length) {
    return (
      <div className="rounded-2xl border border-dashed bg-slate-50 p-6 text-center dark:border-white/10 dark:bg-white/5">
        <p className="text-sm font-bold dark:text-white">Trace starts at publish</p>
        <p className="text-xs text-slate-500 dark:text-slate-400">Collection and distribution records will appear here with a timestamp.</p>
      </div>
    );
  }
  return (
    <ol className="relative ml-3 border-l border-slate-200 pl-6 dark:border-white/10">
      {events.map((e, i) => {
        const base = STEP_META[e.to_status] ?? { label: e.to_status, desc: '', icon: '•' };
        const direct = e.actor_role === 'ngo';
        const meta = direct && e.to_status === 'picked_up' ? {...base,label:'Collected by NGO',desc:'NGO collected directly from the lawn / donor'} : direct && e.to_status === 'delivered' ? {...base,label:'Distribution recorded',desc:'NGO recorded actual servings and people reached'} : base;
        const done = i < events.length - 1 || status === 'completed' || status === 'delivered';
        return (
          <li key={i} className="relative pb-6 last:pb-0">
            <span className={`absolute -left-[29px] grid h-7 w-7 place-items-center rounded-full border text-xs shadow-soft ${done ? 'border-emerald-200 bg-emerald-50 dark:border-emerald-900/40 dark:bg-emerald-950/40' : 'border-slate-200 bg-white dark:border-white/10 dark:bg-slate-800'}`}>
              {meta.icon}
            </span>
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <div className="text-sm font-extrabold dark:text-white">{meta.label}</div>
                <div className="text-xs text-slate-600 dark:text-slate-400">{meta.desc} {e.from_status ? <span className="font-mono text-slate-500">· {e.from_status} → {e.to_status}</span> : null}</div>
                {/* The structured reason, not the free-text note. This is the
                    value the pilot counts; the note only elaborates on it. */}
                {e.reason && (
                  <div className="mt-1 inline-block rounded-xl bg-rose-100 px-2.5 py-1 text-xs font-extrabold text-rose-900 dark:bg-rose-950/40 dark:text-rose-200">
                    {FAILURE_REASON_LABELS[e.reason]}
                  </div>
                )}
                {e.note && <div className="mt-1 rounded-xl bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-800 dark:bg-amber-950/30 dark:text-amber-200">Note: {e.note}</div>}
              </div>
              <div className="text-right">
                <div className="rounded-full bg-white px-2.5 py-1 text-xs font-bold shadow-soft dark:bg-slate-800 dark:text-slate-200">{new Date(e.created_at).toLocaleString()}</div>
                <div className="mt-1 text-xs font-semibold text-slate-500 dark:text-slate-400">by {e.actor_role ?? 'system'}</div>
              </div>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
