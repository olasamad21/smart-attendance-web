/**
 * Theme preference: 'system' (default) follows the device's light/dark setting;
 * 'light' / 'dark' override it. Stored in localStorage under 'theme'.
 * The inline script in app/layout.tsx applies it before first paint (no flash).
 */
export type ThemePreference = 'system' | 'light' | 'dark';

const KEY = 'theme';

export function getThemePreference(): ThemePreference {
  try {
    const v = localStorage.getItem(KEY);
    return v === 'light' || v === 'dark' ? v : 'system';
  } catch {
    return 'system';
  }
}

export function resolveTheme(pref: ThemePreference): 'light' | 'dark' {
  if (pref !== 'system') return pref;
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

export function applyTheme(pref: ThemePreference): void {
  document.documentElement.classList.toggle('dark', resolveTheme(pref) === 'dark');
}

export function setThemePreference(pref: ThemePreference): void {
  try {
    if (pref === 'system') localStorage.removeItem(KEY);
    else localStorage.setItem(KEY, pref);
  } catch {
    // storage unavailable (private mode) — still apply for this page view
  }
  applyTheme(pref);
  window.dispatchEvent(new CustomEvent('themechange', { detail: pref }));
}

/** Inline, dependency-free version for <head> (runs before React). */
export const THEME_INIT_SCRIPT = `
(function () {
  try {
    var pref = localStorage.getItem('${KEY}');
    var mq = window.matchMedia('(prefers-color-scheme: dark)');
    var apply = function () {
      var p = localStorage.getItem('${KEY}');
      var dark = p === 'dark' || (p !== 'light' && mq.matches);
      document.documentElement.classList.toggle('dark', dark);
    };
    apply();
    mq.addEventListener('change', apply);
  } catch (_) {}
})();
`;
