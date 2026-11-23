import type { ReactNode } from 'react';
import Icon from './Icon';

export type BadgeTone = 'neutral' | 'primary' | 'success' | 'warning' | 'error' | 'live';

const TONE: Record<BadgeTone, string> = {
  neutral: 'bg-surface-container text-on-surface-variant',
  primary: 'bg-primary/10 text-primary',
  success: 'bg-success-container text-on-success-container',
  warning: 'bg-warning-container text-on-warning-container',
  error: 'bg-error-container text-on-error-container',
  live: 'bg-primary text-on-primary',
};

export default function Badge({
  tone = 'neutral', icon, children, className = '',
}: { tone?: BadgeTone; icon?: string; children: ReactNode; className?: string }) {
  return (
    <span className={`inline-flex items-center gap-1 h-6 px-2.5 rounded-full text-[11px] font-bold tracking-wide whitespace-nowrap ${TONE[tone]} ${className}`}>
      {tone === 'live' && (
        <span className="relative flex w-1.5 h-1.5" aria-hidden>
          <span className="absolute inline-flex w-full h-full rounded-full bg-secondary-fixed opacity-75 animate-ping" />
          <span className="relative inline-flex w-1.5 h-1.5 rounded-full bg-secondary-fixed" />
        </span>
      )}
      {icon && <Icon name={icon} filled className="text-[13px]" />}
      {children}
    </span>
  );
}
