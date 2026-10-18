import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import ThemeToggle from '@/components/ThemeToggle';
export default async function Navbar() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  let role: string | null = null;
  if (user) { const { data } = await supabase.from('profiles').select('role').eq('id', user.id).single(); role = data?.role ?? null; }
  return <header className="food-nav sticky top-0 z-40 backdrop-blur-xl">
    <nav aria-label="Main navigation" className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-5 sm:px-6">
      <Link href="/" aria-label="Food4All India home" className="flex items-center gap-2.5"><span className="grid h-9 w-9 place-items-center rounded-full bg-[#294b35] text-2xl text-[#e7ebc8]" aria-hidden>✳</span><span className="text-xl font-bold tracking-[-.06em]">food<span className="text-[#839253]">4</span>all<span className="text-[#839253]">.</span><span className="block text-[9px] font-semibold leading-none tracking-[.15em]">INDIA</span></span></Link>
      <div className="hidden items-center gap-7 text-xs font-medium md:flex"><Link href="/donations">Find food</Link><Link href="/#how-it-works">How it works</Link><Link href="/impact">Our impact</Link>{user && <Link href="/dashboard">My dashboard</Link>}</div>
      <div className="flex items-center gap-3"><ThemeToggle compact />{user ? <Link href="/profile" className="text-xs font-semibold">My profile</Link> : <Link href="/auth/login" className="text-xs font-semibold">Log in</Link>}<Link href={user ? '/dashboard' : '/auth/signup'} className="rounded-lg bg-[#294b35] px-4 py-3 text-xs font-semibold text-white">{user ? 'My tasks' : 'Get involved'} <span aria-hidden>↗</span></Link></div>
    </nav>
    <nav aria-label="Mobile navigation" className="flex items-center gap-5 overflow-x-auto border-t border-[#83925320] px-4 py-3 text-xs font-medium md:hidden"><Link className="shrink-0" href="/donations">Find food</Link><Link className="shrink-0" href="/#how-it-works">How it works</Link>{(role === 'donor' || role === 'admin') && <Link className="shrink-0" href="/donations/new">Donate food</Link>}<Link className="shrink-0" href="/impact">Our impact</Link>{user && <form action="/auth/signout" method="post" className="shrink-0"><button>Sign out</button></form>}</nav>
    {user && <form action="/auth/signout" method="post" className="mx-auto hidden max-w-6xl px-6 pb-2 text-right text-xs md:block"><button className="text-slate-500 dark:text-slate-400">Sign out</button></form>}
  </header>;
}
