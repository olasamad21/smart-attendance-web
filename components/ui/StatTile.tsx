import type { ReactNode } from 'react';
import Icon from './Icon';

type Tone = 'primary' | 'success' | 'warning' | 'error' | 'neutral';
const ICON_BG: Record<Tone, string> = {
  primary: 'bg-primary/10 text-primary',
  success: 'bg-success-container text-on-success-container',
  warning: 'bg-warning-container text-on-warning-container',
  error: 'bg-error-container text-on-error-container',
  neutral: 'bg-surface-container text-on-surface-variant',
};

/** Compact metric: icon, big value, label and optional hint. */
export default function StatTile({
  icon, label, value, hint, tone = 'primary', className = '',
}: { icon: string; label: string; value: ReactNode; hint?: ReactNode; tone?: Tone; className?: string }) {
  return (
    <div className={`bg-surface-container-lowest rounded-2xl border border-outline-variant/30 shadow-card p-4 ${className}`}>
      <div className={`w-9 h-9 rounded-xl flex items-center justify-center mb-3 ${ICON_BG[tone]}`}>
        <Icon name={icon} filled className="text-[20px]" />
      </div>
      <p className="text-2xl font-bold text-on-surface tabular-nums leading-tight">{value}</p>
      <p className="text-xs font-medium text-on-surface-variant mt-0.5">{label}</p>
      {hint && <p className="text-[11px] text-on-surface-variant/80 mt-1">{hint}</p>}
    </div>
  );
}
