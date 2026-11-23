'use client';
import { useEffect, useState } from 'react';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Icon from '@/components/ui/Icon';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

// The install prompt fires once, often before React mounts — capture it globally.
let deferredPrompt: BeforeInstallPromptEvent | null = null;
const listeners = new Set<() => void>();
if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e as BeforeInstallPromptEvent;
    listeners.forEach(l => l());
  });
  window.addEventListener('appinstalled', () => {
    deferredPrompt = null;
    listeners.forEach(l => l());
  });
}

export type InstallState = 'installed' | 'available' | 'ios' | 'unsupported';

/** Whether EduVerify can be installed here, and a function to trigger the install. */
export function usePwaInstall() {
  const [state, setState] = useState<InstallState>('unsupported');

  useEffect(() => {
    const compute = () => {
      const standalone = window.matchMedia('(display-mode: standalone)').matches
        || (navigator as Navigator & { standalone?: boolean }).standalone === true;
      const ios = /iphone|ipad|ipod/i.test(navigator.userAgent)
        || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
      setState(standalone ? 'installed' : deferredPrompt ? 'available' : ios ? 'ios' : 'unsupported');
    };
    compute();
    listeners.add(compute);
    return () => { listeners.delete(compute); };
  }, []);

  const install = async () => {
    if (!deferredPrompt) return false;
    await deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    deferredPrompt = null;
    listeners.forEach(l => l());
    return outcome === 'accepted';
  };

  return { state, install };
}

/** "Install the app" card: one-tap install on Chrome/Edge/Android, instructions on iOS. */
export default function InstallAppCard({ dismissKey }: { dismissKey?: string }) {
  const { state, install } = usePwaInstall();
  const [dismissed, setDismissed] = useState(true);

  useEffect(() => {
    if (!dismissKey) { setDismissed(false); return; }
    try { setDismissed(localStorage.getItem(dismissKey) === '1'); } catch { setDismissed(false); }
  }, [dismissKey]);

  if (dismissed || state === 'unsupported') return null;

  if (state === 'installed') {
    return dismissKey ? null : (
      <Card className="flex items-center gap-3">
        <span className="w-10 h-10 rounded-xl bg-success-container text-on-success-container flex items-center justify-center">
          <Icon name="install_mobile" filled className="text-[22px]" />
        </span>
        <p className="text-sm font-semibold text-on-surface">You&apos;re using the installed app</p>
      </Card>
    );
  }

  const dismiss = () => {
    setDismissed(true);
    try { if (dismissKey) localStorage.setItem(dismissKey, '1'); } catch { /* ignore */ }
  };

  return (
    <Card className="flex items-start gap-3 animate-fade-up">
      <img src="/icons/icon-192.png" alt="" width={44} height={44} className="rounded-xl shrink-0" />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-on-surface">Install EduVerify</p>
        {state === 'available' ? (
          <p className="text-xs text-on-surface-variant mt-0.5">Open it from your home screen like any app — full screen, one tap to check in.</p>
        ) : (
          <p className="text-xs text-on-surface-variant mt-0.5">
            In Safari, tap <Icon name="ios_share" className="text-[15px] align-text-bottom" /> Share, then
            <span className="font-semibold"> Add to Home Screen</span>.
          </p>
        )}
        {state === 'available' && (
          <Button size="sm" icon="download" className="mt-3" onClick={install}>Install app</Button>
        )}
      </div>
      {dismissKey && (
        <button onClick={dismiss} aria-label="Dismiss" className="text-on-surface-variant hover:text-on-surface">
          <Icon name="close" className="text-lg" />
        </button>
      )}
    </Card>
  );
}
