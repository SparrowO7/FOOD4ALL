'use client';

import Link from 'next/link';
import type { MouseEvent, ReactNode } from 'react';

/**
 * A link that knows where the pointer is inside it.
 *
 * The highlight itself lives in CSS (`.btn-cursor::after`); this component only
 * writes `--mx` / `--my`. That matters for performance: pointer position never
 * enters React state, so a mousemove costs two custom-property writes and one
 * composited paint instead of a re-render on every frame.
 */
export default function CursorLink({
  href,
  children,
  className = '',
  variant = 'light',
}: {
  href: string;
  children: ReactNode;
  className?: string;
  /** 'light' = white highlight (dark buttons) · 'dark' = darkening (marigold) */
  variant?: 'light' | 'dark';
}) {
  function track(e: MouseEvent<HTMLAnchorElement>) {
    const el = e.currentTarget;
    const r = el.getBoundingClientRect();
    el.style.setProperty('--mx', `${e.clientX - r.left}px`);
    el.style.setProperty('--my', `${e.clientY - r.top}px`);
  }

  return (
    <Link
      href={href}
      onMouseMove={track}
      className={`btn-cursor ${variant === 'dark' ? 'btn-cursor-dark' : ''} ${className}`}
    >
      {/* Sits above the ::after highlight so the label never dims. */}
      <span className="relative z-10">{children}</span>
    </Link>
  );
}
