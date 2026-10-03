import type { Metadata } from 'next';
import './globals.css';
import Navbar from '@/components/Navbar';
import ThemeProvider from '@/components/ThemeProvider';

export const metadata: Metadata = {
  title: 'Food4All — Bridging Waste & Hunger',
  description: 'Volunteer-driven food rescue: donors publish, NGOs claim, volunteers deliver. Built on a verified state machine.',
};

// FOUC-safe: set .dark before paint
const themeScript = `(function(){try{var s=localStorage.getItem('f4a-theme');var d=s? s==='dark' : window.matchMedia('(prefers-color-scheme: dark)').matches;document.documentElement.classList.toggle('dark', d);}catch(e){}})();`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className="premium-bg min-h-screen text-slate-900 antialiased dark:text-slate-100">
        <ThemeProvider>
          <Navbar />
          <main className="mx-auto max-w-6xl px-4 pb-16 pt-6 sm:px-6">{children}</main>
          <footer className="border-t border-slate-200 bg-white/70 backdrop-blur dark:border-white/10 dark:bg-slate-900/40">
            <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
              <div className="grid gap-8 md:grid-cols-3">
                <div>
                  <div className="flex items-center gap-2 font-extrabold tracking-tight">
                    <span className="grid h-8 w-8 place-items-center rounded-lg bg-brand-600 text-xs font-black text-white">F4A</span>
                    Food4All
                  </div>
                  <p className="mt-3 max-w-sm text-sm leading-relaxed text-slate-600 dark:text-slate-400">
                    Nonprofit, volunteer-driven food-rescue platform. We move surplus food from donors to NGOs — fast, fresh, and tracked.
                  </p>
                  <div className="mt-3 inline-flex items-center gap-2 rounded-full border bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-900 dark:border-amber-900/40 dark:bg-amber-950/40 dark:text-amber-200">
                    <span className="h-2 w-2 rounded-full bg-amber-500" /> Demo data is labelled as demo
                  </div>
                </div>
                <div className="text-sm">
                  <div className="font-bold">Explore</div>
                  <ul className="mt-3 space-y-2 text-slate-600 dark:text-slate-400">
                    <li><a href="/donations" className="hover:text-brand-700 hover:underline dark:hover:text-brand-300">Browse donations</a></li>
                    <li><a href="/donations/new" className="hover:text-brand-700 hover:underline dark:hover:text-brand-300">Donate food</a></li>
                    <li><a href="/dashboard" className="hover:text-brand-700 hover:underline dark:hover:text-brand-300">Dashboard</a></li>
                    <li><a href="/impact" className="hover:text-brand-700 hover:underline dark:hover:text-brand-300">Impact</a></li>
                  </ul>
                </div>
                <div className="text-sm">
                  <div className="font-bold">Built for your viva</div>
                  <ul className="mt-3 space-y-1 text-slate-600 dark:text-slate-400">
                    <li>Guarded state machine + RLS + trigger</li>
                    <li>Privacy-masked <code>donations_public</code> view</li>
                    <li>Haversine matching — no paid map API</li>
                    <li>Full audit trail in <code>donation_events</code></li>
                  </ul>
                </div>
              </div>
              <div className="mt-8 border-t border-slate-200 pt-6 text-center text-xs text-slate-500 dark:border-white/10 dark:text-slate-500">
                © {new Date().getFullYear()} Food4All · Crafted for campus pilot → city rollout.
              </div>
            </div>
          </footer>
        </ThemeProvider>
      </body>
    </html>
  );
}
