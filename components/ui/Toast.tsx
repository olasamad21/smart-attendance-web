'use client';
/**
 * Lightweight toast notifications.
 *   const toast = useToast();
 *   toast.success('Session started');  toast.error('Could not save');  toast.info('Copied');
 */
import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from 'react';
import Icon from './Icon';

type ToastKind = 'success' | 'error' | 'info';
interface ToastItem { id: number; kind: ToastKind; message: string }
interface ToastApi {
  success: (message: string) => void;
  error: (message: string) => void;
  info: (message: string) => void;
}

const ToastContext = createContext<ToastApi | null>(null);

const STYLE: Record<ToastKind, { icon: string; className: string }> = {
  success: { icon: 'check_circle', className: 'bg-success-container text-on-success-container' },
  error: { icon: 'error', className: 'bg-error-container text-on-error-container' },
  info: { icon: 'info', className: 'bg-inverse-surface text-inverse-on-surface' },
};

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const nextId = useRef(1);

  const dismiss = useCallback((id: number) => setItems(list => list.filter(t => t.id !== id)), []);

  const push = useCallback((kind: ToastKind, message: string) => {
    const id = nextId.current++;
    setItems(list => [...list.slice(-2), { id, kind, message }]);
    setTimeout(() => dismiss(id), kind === 'error' ? 6000 : 3500);
  }, [dismiss]);

  const api = useMemo<ToastApi>(() => ({
    success: m => push('success', m),
    error: m => push('error', m),
    info: m => push('info', m),
  }), [push]);

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div className="fixed top-3 inset-x-0 z-[200] flex flex-col items-center gap-2 px-4 pointer-events-none" aria-live="polite">
        {items.map(t => (
          <div key={t.id} role={t.kind === 'error' ? 'alert' : 'status'}
            className={`pointer-events-auto w-full max-w-sm flex items-start gap-3 rounded-2xl px-4 py-3 shadow-raised animate-toast-in ${STYLE[t.kind].className}`}>
            <Icon name={STYLE[t.kind].icon} filled className="text-xl mt-px" />
            <p className="flex-1 text-sm font-medium">{t.message}</p>
            <button onClick={() => dismiss(t.id)} aria-label="Dismiss" className="opacity-70 hover:opacity-100">
              <Icon name="close" className="text-lg" />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastApi {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used inside <ToastProvider>');
  return ctx;
}
