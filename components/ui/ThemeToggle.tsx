'use client';
import { useEffect, useState } from 'react';
import { getThemePreference, setThemePreference, type ThemePreference } from '@/lib/theme';

const NEXT: Record<ThemePreference, ThemePreference> = { system: 'light', light: 'dark', dark: 'system' };
const ICON: Record<ThemePreference, string> = { system: 'brightness_auto', light: 'light_mode', dark: 'dark_mode' };
const LABEL: Record<ThemePreference, string> = {
  system: 'Theme: follows device', light: 'Theme: light', dark: 'Theme: dark',
};

/** Cycles system → light → dark. */
export default function ThemeToggle({ className = '' }: { className?: string }) {
  const [pref, setPref] = useState<ThemePreference>('system');

  useEffect(() => {
    setPref(getThemePreference());
    const onChange = (e: Event) => setPref((e as CustomEvent<ThemePreference>).detail);
    window.addEventListener('themechange', onChange);
    return () => window.removeEventListener('themechange', onChange);
  }, []);

  return (
    <button
      type="button"
      onClick={() => setThemePreference(NEXT[pref])}
      title={LABEL[pref]}
      aria-label={`${LABEL[pref]}. Change theme`}
      className={`w-9 h-9 flex items-center justify-center rounded-full text-on-surface-variant hover:bg-surface-container-low active:scale-95 transition-all ${className}`}
    >
      <span className="material-symbols-outlined text-[20px]">{ICON[pref]}</span>
    </button>
  );
}
