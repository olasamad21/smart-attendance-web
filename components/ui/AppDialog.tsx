'use client';
import { useEffect, useRef } from 'react';

interface AppDialogProps {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  icon?: string;
  variant?: 'info' | 'warning' | 'destructive';
  confirmLabel?: string;
  cancelLabel?: string;
  onConfirm?: () => void;
}

const variantStyles = {
  info: {
    iconBg: 'bg-primary/10',
    iconColor: 'text-primary',
    confirmBg: 'bg-primary-container text-on-primary-container',
  },
  warning: {
    iconBg: 'bg-amber-100 dark:bg-amber-900/30',
    iconColor: 'text-amber-600 dark:text-amber-400',
    confirmBg: 'bg-primary-container text-on-primary-container',
  },
  destructive: {
    iconBg: 'bg-error-container/40',
    iconColor: 'text-error',
    confirmBg: 'bg-error text-on-error',
  },
};

export default function AppDialog({
  open,
  onClose,
  title,
  description,
  icon,
  variant = 'info',
  confirmLabel,
  cancelLabel = 'Cancel',
  onConfirm,
}: AppDialogProps) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const styles = variantStyles[variant];

  // Close on Escape key
  useEffect(() => {
    if (!open) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [open, onClose]);

  // Trap focus
  useEffect(() => {
    if (open && dialogRef.current) {
      const focusable = dialogRef.current.querySelector<HTMLElement>('button');
      focusable?.focus();
    }
  }, [open]);

  if (!open) return null;

  const isAlert = !onConfirm;

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center p-5 bg-black/50 backdrop-blur-sm animate-in fade-in duration-150"
      onClick={onClose}
    >
      <div
        ref={dialogRef}
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="dialog-title"
        aria-describedby={description ? 'dialog-desc' : undefined}
        className="bg-surface-container-lowest rounded-3xl p-6 w-full max-w-[320px] card-shadow animate-in zoom-in-95 fade-in duration-200"
        onClick={e => e.stopPropagation()}
      >
        {/* Icon */}
        {icon && (
          <div className={`w-12 h-12 rounded-full ${styles.iconBg} flex items-center justify-center mx-auto mb-4`}>
            <span
              className={`material-symbols-outlined text-2xl ${styles.iconColor}`}
              style={{ fontVariationSettings: "'FILL' 1" }}
            >
              {icon}
            </span>
          </div>
        )}

        {/* Title */}
        <h3 id="dialog-title" className="text-lg font-bold text-on-surface text-center">
          {title}
        </h3>

        {/* Description */}
        {description && (
          <p id="dialog-desc" className="text-sm text-on-surface-variant text-center mt-2 leading-relaxed">
            {description}
          </p>
        )}

        {/* Actions */}
        <div className={`mt-6 flex gap-3 ${isAlert ? 'justify-center' : ''}`}>
          {isAlert ? (
            <button
              onClick={onClose}
              className="flex-1 h-11 rounded-full bg-primary-container text-on-primary-container text-sm font-semibold active:scale-95 transition-all"
            >
              OK
            </button>
          ) : (
            <>
              <button
                onClick={onClose}
                className="flex-1 h-11 rounded-full border border-outline-variant text-on-surface-variant text-sm font-semibold active:scale-95 transition-all"
              >
                {cancelLabel}
              </button>
              <button
                onClick={() => {
                  onConfirm();
                  onClose();
                }}
                className={`flex-1 h-11 rounded-full text-sm font-semibold active:scale-95 transition-all ${styles.confirmBg}`}
              >
                {confirmLabel || 'Confirm'}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
