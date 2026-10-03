import Link from 'next/link';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import StatusBadge from '@/components/StatusBadge';
import FoodTypeBadge from '@/components/FoodTypeBadge';
import ImpactCards from '@/components/ImpactCards';
import type { ImpactSummary } from '@/types/database';

export default async function DashboardPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/auth/login');
  const { data: profile } = await supabase.from('profiles').select('*').eq('id', user.id).single();
  const role = (profile as { role: string } | null)?.role ?? 'donor';
  let impact: ImpactSummary | null = null;
  try { const { data } = await supabase.from('impact_summary').select('*').single(); if (data) impact = data as ImpactSummary; } catch {}
  let myDonations: unknown[] = [];
  if (role === 'donor' || role === 'admin') {
    const { data } = await supabase.from('donations').select('*').eq('donor_id', user.id).order('created_at', { ascending: false }).limit(20);
    myDonations = (data ?? []) as unknown[];
  }
  let ngoClaims: unknown[] = [];
  if (role === 'ngo' || role === 'admin') {
    const { data } = await supabase.from('donations').select('*').eq('claimed_by_ngo', user.id).order('created_at', { ascending: false }).limit(20);
    ngoClaims = (data ?? []) as unknown[];
  }
  let volunteerTasks: unknown[] = [];
  if (role === 'volunteer' || role === 'admin') {
    const { data } = await supabase.from('donations').select('*').eq('assigned_volunteer', user.id).order('created_at', { ascending: false }).limit(20);
    volunteerTasks = (data ?? []) as unknown[];
  }
  const available: unknown[] = [];
  if (role === 'ngo' || role === 'volunteer' || role === 'admin') {
    const { data } = await supabase.from('donations_public').select('*').eq('status', 'available').order('created_at', { ascending: false }).limit(12);
    available.push(...((data as unknown[]) ?? []));
  }
  const Card = ({ d }: { d: Record<string, string> }) => (
    <Link href={`/donations/${d['id']}`} className="rounded-[20px] border bg-white p-5 shadow-soft transition hover:shadow-card dark:border-white/10 dark:bg-slate-900/60">
      <div className="flex items-center gap-2"><FoodTypeBadge type={d['food_type'] as never} /><StatusBadge status={d['status'] as never} /></div>
      <div className="mt-2 line-clamp-1 font-display font-extrabold dark:text-white">{d['title']}</div>
      <div className="line-clamp-1 text-sm text-slate-600 dark:text-slate-400">{d['quantity_desc']}</div>
    </Link>
  );
  return (
    <div className="space-y-6">
      <div className="overflow-hidden rounded-[28px] border bg-white shadow-card dark:border-white/10 dark:bg-slate-900/60">
        <div className="h-1 bg-gradient-to-r from-brand-600 to-emerald-600" />
        <div className="flex flex-wrap items-center justify-between gap-4 p-6">
          <div>
            <h1 className="font-display text-2xl font-extrabold tracking-tight dark:text-white">Dashboard</h1>
            <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">Role <span className="rounded-full bg-slate-900 px-2.5 py-1 text-xs font-black uppercase tracking-wide text-white dark:bg-white dark:text-slate-900">{role}</span> <span className="ml-2 text-slate-500 dark:text-slate-400">{user.email}</span></p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link href="/profile" className="rounded-full border bg-white px-4 py-2 text-sm font-bold shadow-soft hover:bg-slate-50 dark:border-white/10 dark:bg-white/5 dark:text-white dark:hover:bg-white/10">Profile</Link>
            <Link href="/impact" className="rounded-full border bg-white px-4 py-2 text-sm font-bold shadow-soft hover:bg-slate-50 dark:border-white/10 dark:bg-white/5 dark:text-white dark:hover:bg-white/10">Impact</Link>
            <Link href="/donations/new" className="rounded-full bg-brand-600 px-5 py-2.5 text-sm font-extrabold text-white shadow-soft hover:bg-brand-700">+ Donate</Link>
          </div>
        </div>
      </div>
      {impact && <ImpactCards data={impact} />}
      {role === 'donor' && (
        <section className="rounded-[24px] border bg-white p-6 shadow-soft dark:border-white/10 dark:bg-slate-900/60">
          <h2 className="font-display font-extrabold dark:text-white">My donations</h2>
          <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {myDonations.length ? (myDonations as Record<string,string>[]).map((d) => <Card key={d['id']} d={d} />) : <p className="text-sm text-slate-500 dark:text-slate-400">No donations yet. Create your first draft.</p>}
          </div>
        </section>
      )}
      {role === 'ngo' && (
        <>
          <section className="rounded-[24px] border bg-white p-6 shadow-soft dark:border-white/10 dark:bg-slate-900/60">
            <h2 className="font-display font-extrabold dark:text-white">Available near you</h2>
            <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {available.length ? (available as Record<string,string>[]).map((d) => <Card key={d['id']} d={d} />) : <p className="text-sm text-slate-500 dark:text-slate-400">Nothing available right now.</p>}
            </div>
          </section>
          <section className="rounded-[24px] border bg-white p-6 shadow-soft dark:border-white/10 dark:bg-slate-900/60">
            <h2 className="font-display font-extrabold dark:text-white">My claims</h2>
            <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {ngoClaims.length ? (ngoClaims as Record<string,string>[]).map((d) => <Card key={d['id']} d={d} />) : <p className="text-sm text-slate-500 dark:text-slate-400">No claims yet.</p>}
            </div>
          </section>
        </>
      )}
      {role === 'volunteer' && (
        <>
          <section className="rounded-[24px] border bg-white p-6 shadow-soft dark:border-white/10 dark:bg-slate-900/60">
            <h2 className="font-display font-extrabold dark:text-white">Available pickups</h2>
            <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {available.length ? (available as Record<string,string>[]).map((d) => <Card key={d['id']} d={d} />) : <p className="text-sm text-slate-500 dark:text-slate-400">No open pickups.</p>}
            </div>
          </section>
          <section className="rounded-[24px] border bg-white p-6 shadow-soft dark:border-white/10 dark:bg-slate-900/60">
            <h2 className="font-display font-extrabold dark:text-white">My tasks</h2>
            <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {volunteerTasks.length ? (volunteerTasks as Record<string,string>[]).map((d) => <Card key={d['id']} d={d} />) : <p className="text-sm text-slate-500 dark:text-slate-400">No assigned tasks.</p>}
            </div>
          </section>
        </>
      )}
      {role === 'admin' && (
        <section className="rounded-[24px] border bg-white p-6 shadow-soft dark:border-white/10 dark:bg-slate-900/60">
          <h2 className="font-display font-extrabold dark:text-white">Admin</h2>
          <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">Verify NGOs/volunteers in Supabase dashboard (flip <code>verification_status</code> / <code>is_verified</code>). All donations visible via RLS.</p>
          <Link href="/donations" className="mt-3 inline-flex rounded-full border px-4 py-2 text-sm font-bold shadow-soft hover:bg-slate-50 dark:border-white/10 dark:text-white dark:hover:bg-white/10">All donations</Link>
        </section>
      )}
    </div>
  );
}
