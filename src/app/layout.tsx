import type { Metadata } from 'next';
import { Archivo, Darker_Grotesque } from 'next/font/google';
import './globals.css';
import Navbar from '@/components/Navbar';
import ThemeProvider from '@/components/ThemeProvider';

// Two faces, one job each.
//
// Archivo for everything you read: a grotesque with a large x-height and open
// apertures, so 13px metadata on a dark field stays legible — this app shows a
// lot of small numbers (quantities, distances, minutes left).
//
// Darker Grotesque for the headline only. It is unusually tall and narrow,
// which is exactly how hand-painted Indian shop signage and dabbawala tiffin
// codes are lettered — a lot of word in very little width. Its strokes get
// thin, so it is never used below ~2rem.
const archivo = Archivo({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-archivo',
});

const darker = Darker_Grotesque({
  subsets: ['latin'],
  weight: ['500', '700', '800'],
  display: 'swap',
  variable: '--font-darker',
});

export const metadata: Metadata = {
  title: 'Food4All India — surplus food, rescued before it spoils',
  description:
    'Food4All India connects lawns and vegetarian food donors with verified NGOs for direct collection, QR batch tracking and recorded distribution.',
};

// FOUC-safe: set .dark before paint
const themeScript = `(function(){try{var s=localStorage.getItem('f4a-theme');var d=s? s==='dark' : window.matchMedia('(prefers-color-scheme: dark)').matches;document.documentElement.classList.toggle('dark', d);}catch(e){}})();`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${archivo.variable} ${darker.variable}`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className="premium-bg min-h-screen text-slate-900 antialiased dark:text-slate-100">
        <ThemeProvider>
          <Navbar />
          <main className="mx-auto max-w-6xl px-4 pb-16 pt-6 sm:px-6">{children}</main>
          <footer className="food-footer border-t border-[#83925320]">
            <div className="mx-auto grid max-w-6xl gap-8 px-4 py-10 sm:grid-cols-[2fr_1fr_1fr] sm:px-6">
              <div><a href="/" className="text-2xl font-bold tracking-tight">food4all. <span className="text-xs tracking-[.15em]">INDIA</span></a><p className="mt-3 max-w-xs text-xs leading-7 opacity-75">Good food. Shared with care.<br />Connecting people who have a little extra with people who can help it reach further.</p></div>
              <div className="space-y-3 text-xs"><h2 className="mb-4 font-bold">Make a difference</h2><a className="block" href="/donations/new">Share food ↗</a><a className="block" href="/donations">Find food ↗</a><a className="block" href="/auth/signup">Join the community ↗</a></div>
              <div className="space-y-3 text-xs"><h2 className="mb-4 font-bold">Get to know us</h2><a className="block" href="/#how-it-works">How it works</a><a className="block" href="/impact">Our impact</a><a className="block" href="/dashboard">Your dashboard</a></div>
            </div><div className="mx-auto flex max-w-6xl flex-wrap justify-between gap-3 border-t border-[#83925330] px-4 py-5 text-[10px] opacity-70 sm:px-6"><span>© {new Date().getFullYear()} Food4All India</span><span>Built with care. Starting with our community.</span></div>
          </footer>
        </ThemeProvider>
      </body>
    </html>
  );
}
