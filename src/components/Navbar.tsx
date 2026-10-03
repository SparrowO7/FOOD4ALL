import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import ThemeToggle from '@/components/ThemeToggle';

export default async function Navbar() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  let role: string | null = null;
  if (user) {
    const { data } = await supabase.from('profiles').select('role').eq('id', user.id).single();
    role = (data as { role: string } | null)?.role ?? null;
  }
  return (
    <header className="sticky top-0 z-40 border-b border-slate-200/70 bg-white/80 backdrop-blur-xl dark:border-white/10 dark:bg-slate-900/60">
      <nav className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3 sm:px-6">
        <Link href="/" className="flex items-center gap-3">
          <span className="grid h-9 w-9 place-items-center rounded-xl bg-gradient-to-br from-brand-600 to-emerald-700 text-xs font-black tracking-wide text-white shadow-soft">F4A</span>
          <span className="font-display text-[17px] font-extrabold tracking-tight text-slate-900 dark:text-white">
            Food4All <span className="hidden sm:inline font-semibold text-slate-500 dark:text-slate-400">— Bridging Waste &amp; Hunger</span>
          </span>
        </Link>
        <div className="flex items-center gap-1.5 text-sm">
          <Link href="/donations" className="hidden rounded-full px-3.5 py-2 font-medium text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-white/10 sm:inline-flex">Donations</Link>
          <Link href="/impact" className="hidden rounded-full px-3.5 py-2 font-medium text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-white/10 sm:inline-flex">Impact</Link>
          <ThemeToggle />
          {user ? (
            <>
              <Link href="/donations/new" className="rounded-full border border-slate-200 bg-white px-3.5 py-2 font-semibold hover:bg-slate-50 dark:border-white/15 dark:bg-white/10 dark:text-white dark:hover:bg-white/15">Donate</Link>
              <Link href="/dashboard" className="rounded-full bg-slate-900 px-4 py-2 font-bold text-white shadow-soft hover:bg-black dark:bg-white dark:text-slate-900 dark:hover:bg-slate-100">Dashboard</Link>
              <span className="ml-1 hidden rounded-full bg-slate-900 px-2.5 py-1 text-xs font-bold uppercase tracking-wide text-white dark:bg-white dark:text-slate-900 sm:inline-flex">{role ?? 'donor'}</span>
              <form action="/auth/signout" method="post" className="ml-1">
                <button className="rounded-full border bg-white px-3.5 py-2 font-medium hover:bg-slate-50 dark:border-white/15 dark:bg-white/10 dark:text-white dark:hover:bg-white/15">Sign out</button>
              </form>
            </>
          ) : (
            <>
              <Link href="/auth/login" className="rounded-full px-3.5 py-2 font-medium text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-white/10">Login</Link>
              <Link href="/auth/signup" className="rounded-full bg-brand-600 px-5 py-2.5 font-extrabold text-white shadow-soft hover:bg-brand-700">Sign up</Link>
            </>
          )}
        </div>
      </nav>
    </header>
  );
}
