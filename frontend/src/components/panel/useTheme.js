import { useState, useEffect, useCallback } from 'react';

const STORAGE_KEY = 'panel-theme-pref';

/**
 * Auto-detects device dark/light mode, allows manual override.
 * Returns { theme: 'dark'|'light', toggleTheme, isDark }
 */
export default function useTheme() {
  const [theme, setTheme] = useState(() => {
    // 1. Check localStorage for user override
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === 'dark' || stored === 'light') return stored;
    // 2. Auto-detect from system
    if (window.matchMedia?.('(prefers-color-scheme: light)').matches) return 'light';
    return 'dark';
  });

  // Listen to OS-level changes (only if user hasn't overridden)
  useEffect(() => {
    const mql = window.matchMedia('(prefers-color-scheme: dark)');
    const handler = (e) => {
      if (!localStorage.getItem(STORAGE_KEY)) {
        setTheme(e.matches ? 'dark' : 'light');
      }
    };
    mql.addEventListener('change', handler);
    return () => mql.removeEventListener('change', handler);
  }, []);

  // Sync theme across browser tabs via storage event
  useEffect(() => {
    const handler = (e) => {
      if (e.key === STORAGE_KEY && (e.newValue === 'dark' || e.newValue === 'light')) {
        setTheme(e.newValue);
      }
    };
    window.addEventListener('storage', handler);
    return () => window.removeEventListener('storage', handler);
  }, []);

  const toggleTheme = useCallback(() => {
    setTheme(prev => {
      const next = prev === 'dark' ? 'light' : 'dark';
      localStorage.setItem(STORAGE_KEY, next);
      return next;
    });
  }, []);

  return { theme, toggleTheme, isDark: theme === 'dark' };
}
