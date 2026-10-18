import Link from 'next/link';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import RegisterTable, { type RegisterRow } from '@/components/RegisterTable';

export const metadata = {
  title: 'Surplus food register · Food4All India',
  description: 'The Schedule-II record of surplus food required by reg 7 of the FSSAI surplus food regulations.',
};

export default async function RecordsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/auth/login');

  // The view is security_invoker, so this returns exactly the rows the caller is
  // party to: a donor sees its own donations, the claiming NGO sees the ones it
  // accepted, an admin sees everything. That matches reg 7, which places the
  // record-keeping duty on the donor and the distribution organisation alike.
  const { data, error } = await supabase
    .from('surplus_food_register')
    .select('*')
    .order('donation_date', { ascending: false });

  const rows = (data ?? []) as RegisterRow[];

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link href="/dashboard" className="inline-flex items-center gap-1.5 rounded-full border bg-white px-4 py-2 text-sm font-bold shadow-soft hover:bg-slate-50 dark:border-white/10 dark:bg-white/5 dark:text-white">← Dashboard</Link>
      </div>

      <div className="rounded-[28px] border bg-white p-6 shadow-card dark:border-white/10 dark:bg-slate-900/70 sm:p-7">
        <div className="inline-flex rounded-full bg-slate-900 px-3 py-1 text-xs font-black uppercase tracking-widest text-white dark:bg-white dark:text-slate-900">
          Statutory record
        </div>
        <h1 className="font-display mt-3 text-2xl font-extrabold tracking-tight dark:text-white sm:text-3xl">
          Surplus food register
        </h1>
        <p className="mt-2 max-w-3xl text-sm text-slate-600 dark:text-slate-300">
          Regulation 7 of the Food Safety and Standards (Recovery and Distribution of Surplus
          Food) Regulations, 2019 requires the food donor <em>and</em> the distribution
          organisation to maintain a record of surplus food in the form set out in Schedule-II.
          These are those twelve fields, in that order, for every donation you are party to.
        </p>
        <p className="mt-2 max-w-3xl text-xs text-slate-500 dark:text-slate-400">
          A blank cell means the field was not recorded — it is shown as blank rather than filled
          with a guess. The counters below say how often that happens, so the gaps are known
          before anyone else finds them.
        </p>
      </div>

      {error ? (
        <div className="rounded-2xl border-2 border-rose-300 bg-rose-50 p-5 text-sm font-semibold text-rose-900 dark:border-rose-900 dark:bg-rose-950/30 dark:text-rose-200">
          Could not load the register: {error.message}
          <div className="mt-1 text-xs font-normal">
            If this says the relation does not exist, run <code>0014_surplus_register.sql</code>.
          </div>
        </div>
      ) : (
        <RegisterTable rows={rows} />
      )}
    </div>
  );
}
