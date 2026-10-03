'use client';
import { useState } from 'react';

function qrUrl(target: string) {
  return `https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(target)}`;
}

export default function QRShareCard({ traceUrl, id }: { traceUrl: string; id: string }) {
  const [copied, setCopied] = useState(false);
  async function copy() {
    try { await navigator.clipboard.writeText(traceUrl); setCopied(true); setTimeout(() => setCopied(false), 1800); } catch {}
  }
  const wa = `https://wa.me/?text=${encodeURIComponent(`Track this Food4All donation — chain of custody: ${traceUrl}`)}`;
  return (
    <div className="rounded-[20px] border bg-white p-4 shadow-soft dark:border-white/10 dark:bg-slate-900/60">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-extrabold dark:text-white">Trace &amp; share — world-class</h3>
        <span className="rounded-full bg-slate-900 px-2.5 py-1 text-xs font-black text-white dark:bg-white dark:text-slate-900">Chain of custody</span>
      </div>
      <p className="mt-1 text-xs text-slate-600 dark:text-slate-400">Donor / NGO / volunteer can prove where the food went. Scan or share the public trace link.</p>
      <div className="mt-4 grid gap-4 sm:grid-cols-[auto_1fr]">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={qrUrl(traceUrl)} alt="QR for trace" width={132} height={132} className="rounded-2xl border bg-white p-2 dark:border-white/10" />
        <div className="space-y-2">
          <div className="rounded-2xl bg-slate-50 p-3 dark:bg-white/5">
            <div className="text-xs font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">Public trace link</div>
            <div className="mt-1 break-all font-mono text-xs dark:text-slate-200">{traceUrl}</div>
            <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">ID: <code>{id.slice(0, 8)}…</code> · no login needed to view trace</div>
          </div>
          <div className="flex flex-wrap gap-2">
            <button onClick={copy} className="rounded-full border bg-white px-4 py-2 text-xs font-bold shadow-soft hover:bg-slate-50 dark:border-white/10 dark:bg-white/5 dark:text-white dark:hover:bg-white/10">
              {copied ? 'Copied ✓' : 'Copy link'}
            </button>
            <a href={wa} target="_blank" rel="noreferrer" className="rounded-full bg-emerald-600 px-4 py-2 text-xs font-extrabold text-white hover:bg-emerald-700">Share on WhatsApp</a>
            <a href={traceUrl} target="_blank" rel="noreferrer" className="rounded-full border bg-white px-4 py-2 text-xs font-bold hover:bg-slate-50 dark:border-white/10 dark:bg-white/5 dark:text-white">Open trace →</a>
          </div>
        </div>
      </div>
    </div>
  );
}
