'use client';
import { useTheme } from '@/components/ThemeProvider';

export default function ThemeToggle({ compact = false }: { compact?: boolean }) {
  const { theme, toggle } = useTheme();
  const isDark = theme === 'dark';
  return (
    <button
      onClick={toggle}
      aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
      title={isDark ? 'Light mode' : 'Dark mode'}
      className={`inline-flex items-center gap-2 rounded-full border font-bold shadow-soft transition ${
        compact ? 'h-9 w-9 justify-center p-0' : 'px-3.5 py-2 text-sm'
      } ${
        isDark
          ? 'border-white/15 bg-white/10 text-white hover:bg-white/15'
          : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
      }`}
    >
      <span className="text-base leading-none">{isDark ? '☀️' : '🌙'}</span>
      {!compact && <span className="hidden sm:inline">{isDark ? 'Light' : 'Dark'}</span>}
    </button>
  );
}
