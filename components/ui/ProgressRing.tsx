import type { ReactNode } from 'react';

type Tone = 'primary' | 'success' | 'warning' | 'error' | 'onPrimary';
const STROKE: Record<Tone, string> = {
  primary: 'stroke-primary',
  success: 'stroke-success',
  warning: 'stroke-warning',
  error: 'stroke-error',
  onPrimary: 'stroke-on-primary-container',
};

/** Circular progress (0–1) with optional centred content. */
export default function ProgressRing({
  value, size = 96, stroke = 8, tone = 'primary', label, children,
}: { value: number; size?: number; stroke?: number; tone?: Tone; label?: string; children?: ReactNode }) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const v = Math.min(1, Math.max(0, Number.isFinite(value) ? value : 0));
  return (
    <div className="relative inline-flex items-center justify-center shrink-0" style={{ width: size, height: size }}
      role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(v * 100)} aria-label={label}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" strokeWidth={stroke} className="stroke-current opacity-15" />
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" strokeWidth={stroke} strokeLinecap="round"
          strokeDasharray={c} strokeDashoffset={c * (1 - v)}
          className={`${STROKE[tone]} transition-[stroke-dashoffset] duration-700 ease-out`} />
      </svg>
      {children && <div className="absolute inset-0 flex flex-col items-center justify-center text-center">{children}</div>}
    </div>
  );
}
