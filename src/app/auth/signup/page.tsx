'use client';
import { useState } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';

export default function SignupPage() {
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<'donor' | 'ngo' | 'volunteer'>('donor');
  const [phone, setPhone] = useState('');
  const [msg, setMsg] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  async function onSubmit(e: React.FormEvent) {
    e.preventDefault(); setLoading(true); setMsg(null);
    const supabase = createClient();
    const { error } = await supabase.auth.signUp({ email, password, options: { data: { role, full_name: fullName, phone } } });
    if (error) { setMsg(error.message); setLoading(false); return; }
    // The profiles row — and the ngos/volunteers detail row for those roles — is
    // created server-side by the handle_new_user() trigger. Doing it here would
    // fail silently: with email confirmation on there is no session yet, so
    // auth.uid() is null and RLS rejects the insert.
    setMsg('Account created. If email confirmation is on, confirm via email — then log in.');
    setLoading(false);
  }
  const inputCls = 'mt-1.5 w-full rounded-2xl border bg-white px-3.5 py-2.5 text-sm shadow-soft focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-100 dark:border-white/10 dark:bg-slate-800 dark:text-white';
  return (
    <div className="mx-auto max-w-md">
      <div className="overflow-hidden rounded-[28px] border bg-white shadow-card dark:border-white/10 dark:bg-slate-900/70">
        <div className="h-1 bg-gradient-to-r from-brand-600 via-emerald-600 to-teal-600" />
        <div className="p-7">
          <h1 className="font-display text-2xl font-extrabold tracking-tight dark:text-white">Join Food4All</h1>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">One account, one role. Change requests via profile.</p>
          <form onSubmit={onSubmit} className="mt-6 space-y-4">
            <label className="block"><span className="text-sm font-bold dark:text-slate-200">Full name / Org name</span><input value={fullName} onChange={(e) => setFullName(e.target.value)} required className={inputCls} /></label>
            <div className="grid grid-cols-2 gap-3">
              <label className="block"><span className="text-sm font-bold dark:text-slate-200">Role</span><select value={role} onChange={(e) => setRole(e.target.value as never)} className={inputCls}><option value="donor">Donor</option><option value="ngo">NGO</option><option value="volunteer">Volunteer</option></select></label>
              <label className="block"><span className="text-sm font-bold dark:text-slate-200">Phone</span><input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="Optional" className={inputCls} /></label>
            </div>
            <label className="block"><span className="text-sm font-bold dark:text-slate-200">Email</span><input value={email} onChange={(e) => setEmail(e.target.value)} type="email" required className={inputCls} /></label>
            <label className="block"><span className="text-sm font-bold dark:text-slate-200">Password</span><input value={password} onChange={(e) => setPassword(e.target.value)} type="password" required minLength={6} className={inputCls} /></label>
            {msg && <p className="rounded-2xl bg-amber-50 p-3 text-sm font-semibold text-amber-900 dark:bg-amber-950/40 dark:text-amber-200">{msg}</p>}
            <button disabled={loading} className="w-full rounded-full bg-brand-600 py-3 font-extrabold text-white shadow-soft hover:bg-brand-700 disabled:opacity-60">{loading ? 'Creating…' : 'Create account'}</button>
          </form>
          <p className="mt-4 text-center text-sm text-slate-600 dark:text-slate-400">Already have an account? <Link href="/auth/login" className="font-extrabold text-brand-700 hover:underline dark:text-brand-400">Log in</Link></p>
        </div>
      </div>
    </div>
  );
}
