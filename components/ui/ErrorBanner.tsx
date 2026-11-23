'use client';

/** Inline error message with optional retry/dismiss. */
export default function ErrorBanner({
  message, onRetry, onDismiss,
}: { message: string; onRetry?: () => void; onDismiss?: () => void }) {
  if (!message) return null;
  return (
    <div role="alert" className="bg-error-container/40 border border-error/20 rounded-2xl p-3 flex items-start gap-3">
      <span className="material-symbols-outlined text-error text-xl mt-0.5" style={{ fontVariationSettings: "'FILL' 1" }}>error</span>
      <p className="flex-1 text-sm text-on-surface">{message}</p>
      {onRetry && (
        <button onClick={onRetry} className="text-xs font-bold text-primary whitespace-nowrap mt-0.5">Retry</button>
      )}
      {onDismiss && (
        <button onClick={onDismiss} aria-label="Dismiss" className="text-on-surface-variant mt-0.5">
          <span className="material-symbols-outlined text-lg">close</span>
        </button>
      )}
    </div>
  );
}

/** Human-readable message from an unknown thrown value. */
export function errorMessage(e: unknown, fallback = 'Something went wrong. Please try again.'): string {
  const code = (e as { code?: string })?.code;
  if (code === 'permission-denied') return 'You do not have permission to do that.';
  if (code === 'unavailable') return 'You appear to be offline. Check your connection and try again.';
  const msg = (e as { message?: string })?.message;
  return msg && msg.length < 200 ? msg : fallback;
}
