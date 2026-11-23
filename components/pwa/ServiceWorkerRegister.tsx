'use client';
import { useEffect } from 'react';
// Imported for its side effect: captures the browser's install prompt on every page.
import '@/components/pwa/InstallApp';

/**
 * Registers /sw.js in production builds only — in development a service worker would
 * serve stale code during hot reloads.
 */
export default function ServiceWorkerRegister() {
  useEffect(() => {
    if (process.env.NODE_ENV !== 'production' || !('serviceWorker' in navigator)) return;
    navigator.serviceWorker.register('/sw.js', { scope: '/', updateViaCache: 'none' }).catch(() => {
      // Not fatal: the app works without it (e.g. private browsing).
    });
  }, []);
  return null;
}
