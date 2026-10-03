'use client';
import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [msg, setMsg] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  async function onSubmit(e: React.FormEvent) {
    e.preventDefault(); setLoading(true); setMsg(null);
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) setMsg(error.message); else router.push('/dashboard');
    setLoading(false);
  }
  return (
    <div className="mx-auto max-w-md">
      <div className="overflow-hidden rounded-[28px] border bg-white shadow-card dark:border-white/10 dark:bg-slate-900/70">
        <div className="h-1 bg-gradient-to-r from-brand-600 to-emerald-600" />
        <div className="p-7">
          <h1 className="font-display text-2xl font-extrabold tracking-tight dark:text-white">Welcome back</h1>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">Sign in to continue your Food4All role.</p>
          <form onSubmit={onSubmit} className="mt-6 space-y-4">
            <label className="block"><span className="text-sm font-bold dark:text-slate-200">Email</span><input value={email} onChange={(e) => setEmail(e.target.value)} type="email" required placeholder="you@college.edu" className="mt-1.5 w-full rounded-2xl border bg-white px-3.5 py-2.5 text-sm shadow-soft focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-100 dark:border-white/10 dark:bg-slate-800 dark:text-white dark:placeholder:text-slate-500" /></label>
            <label className="block"><span className="text-sm font-bold dark:text-slate-200">Password</span><input value={password} onChange={(e) => setPassword(e.target.value)} type="password" required className="mt-1.5 w-full rounded-2xl border bg-white px-3.5 py-2.5 text-sm shadow-soft focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-100 dark:border-white/10 dark:bg-slate-800 dark:text-white" /></label>
            {msg && <p className="rounded-2xl bg-red-50 p-3 text-sm font-semibold text-red-700 dark:bg-red-950/40 dark:text-red-200">{msg}</p>}
            <button disabled={loading} className="w-full rounded-full bg-slate-900 py-3 font-extrabold text-white shadow-soft hover:bg-black disabled:opacity-60 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-100">{loading ? 'Signing in…' : 'Sign in'}</button>
          </form>
          <p className="mt-4 text-center text-sm text-slate-600 dark:text-slate-400">No account? <Link href="/auth/signup" className="font-extrabold text-brand-700 hover:underline dark:text-brand-400">Create one</Link></p>
        </div>
      </div>
    </div>
  );
}
