'use client';
import { createContext, useContext, useEffect, useState } from 'react';

type Theme = 'light' | 'dark';
const Ctx = createContext<{ theme: Theme; toggle: () => void; set: (t: Theme) => void }>({
  theme: 'light', toggle() {}, set() {},
});

export function useTheme() { return useContext(Ctx); }

export default function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setTheme] = useState<Theme>('light');

  useEffect(() => {
    const saved = (localStorage.getItem('f4a-theme') as Theme | null);
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    const initial: Theme = saved ?? (prefersDark ? 'dark' : 'light');
    setTheme(initial);
    document.documentElement.classList.toggle('dark', initial === 'dark');
  }, []);

  function set(t: Theme) {
    setTheme(t);
    localStorage.setItem('f4a-theme', t);
    document.documentElement.classList.toggle('dark', t === 'dark');
  }
  function toggle() { set(theme === 'dark' ? 'light' : 'dark'); }

  return <Ctx.Provider value={{ theme, toggle, set }}>{children}</Ctx.Provider>;
}
