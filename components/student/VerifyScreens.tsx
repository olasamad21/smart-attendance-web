'use client';
import type { ReactNode } from 'react';
import Icon from '@/components/ui/Icon';

const STEPS = ['Location', 'Face', 'Done'] as const;

/** Page frame for the check-in flow: back button, course/phase title and a 3-step progress bar. */
export function VerifyShell({
  current, title, subtitle, onBack, children,
}: { current: 0 | 1 | 2 | 3; title: string; subtitle?: string; onBack?: () => void; children: ReactNode }) {
  return (
    <div className="min-h-dvh bg-background flex flex-col max-w-md mx-auto px-4 sm:px-5">
      <header className="pt-3 pb-4">
        <div className="flex items-center gap-2 h-12">
          {onBack && (
            <button onClick={onBack} aria-label="Back"
              className="w-10 h-10 -ml-2 rounded-full flex items-center justify-center text-on-surface hover:bg-surface-container-low active:scale-95">
              <Icon name="arrow_back" />
            </button>
          )}
          <div className="min-w-0">
            <p className="text-sm font-bold text-on-surface truncate">{title}</p>
            {subtitle && <p className="text-xs text-on-surface-variant truncate">{subtitle}</p>}
          </div>
        </div>
        <ol className="mt-3 grid grid-cols-3 gap-2" aria-label="Check-in progress">
          {STEPS.map((label, i) => {
            const state = i < current ? 'done' : i === current ? 'current' : 'todo';
            return (
              <li key={label} aria-current={state === 'current' ? 'step' : undefined}>
                <div className={`h-1.5 rounded-full transition-colors duration-500 ${state === 'todo' ? 'bg-surface-container-high' : state === 'done' ? 'bg-success' : 'bg-primary'}`} />
                <p className={`mt-1.5 text-[11px] font-semibold flex items-center gap-1 ${state === 'todo' ? 'text-on-surface-variant/70' : 'text-on-surface'}`}>
                  {state === 'done' && <Icon name="check" className="text-[13px] text-success" />}
                  {label}
                </p>
              </li>
            );
          })}
        </ol>
      </header>
      <div className="flex-1 flex flex-col">{children}</div>
    </div>
  );
}

type Tone = 'primary' | 'success' | 'warning' | 'error' | 'neutral';
const HERO_TONE: Record<Tone, string> = {
  primary: 'bg-primary/10 text-primary',
  success: 'bg-success-container text-on-success-container',
  warning: 'bg-warning-container text-on-warning-container',
  error: 'bg-error-container text-on-error-container',
  neutral: 'bg-surface-container text-on-surface-variant',
};

/** Centred status block: big icon, title, body and actions pinned to the bottom. */
export function StatusHero({
  icon, tone = 'primary', title, pulse = false, children, actions, visual,
}: {
  icon?: string; tone?: Tone; title: string; pulse?: boolean;
  children?: ReactNode; actions?: ReactNode; visual?: ReactNode;
}) {
  return (
    <div className="flex-1 flex flex-col pb-6">
      <div className="flex-1 flex flex-col items-center justify-center text-center animate-fade-up">
        {visual ?? (
          <div className="relative mb-6">
            {pulse && <span aria-hidden className={`absolute inset-0 rounded-full animate-ping opacity-30 ${HERO_TONE[tone]}`} />}
            <div className={`relative w-24 h-24 rounded-full flex items-center justify-center animate-scale-in ${HERO_TONE[tone]}`}>
              <Icon name={icon ?? 'info'} filled className="text-5xl" />
            </div>
          </div>
        )}
        <h2 className="text-2xl font-bold text-on-surface">{title}</h2>
        <div className="mt-2 text-sm text-on-surface-variant max-w-xs">{children}</div>
      </div>
      {actions && <div className="flex flex-col gap-3">{actions}</div>}
    </div>
  );
}

/** Animated success tick. */
export function SuccessCheck() {
  return (
    <div className="relative mb-6 animate-scale-in">
      <span aria-hidden className="absolute -inset-3 rounded-full bg-success/15 animate-ping" style={{ animationIterationCount: 2 }} />
      <svg width="104" height="104" viewBox="0 0 104 104" className="relative" aria-hidden>
        <circle cx="52" cy="52" r="50" className="fill-success" />
        <path d="M32 54 l13 13 l27 -29" fill="none" strokeWidth="8" strokeLinecap="round" strokeLinejoin="round"
          className="stroke-on-success" strokeDasharray="70" strokeDashoffset="70"
          style={{ animation: 'draw-check 0.45s 0.2s ease-out forwards' }} />
      </svg>
    </div>
  );
}

/** Where the student is relative to the allowed radius. */
export function DistanceMeter({ distance, radius, accuracy }: { distance: number; radius: number; accuracy?: number | null }) {
  const max = Math.max(radius * 2, distance * 1.15, 1);
  const pct = (v: number) => `${Math.min(100, (v / max) * 100)}%`;
  const inside = distance <= radius;
  return (
    <div className="w-full max-w-xs mt-6 text-left" aria-label={`You are ${distance} metres away; allowed ${radius} metres`}>
      <div className="relative h-3 rounded-full bg-surface-container-high overflow-hidden">
        <div className="absolute inset-y-0 left-0 bg-success/40" style={{ width: pct(radius) }} />
      </div>
      <div className="relative h-6">
        <span className={`absolute top-1 -translate-x-1/2 text-[11px] font-bold flex flex-col items-center ${inside ? 'text-success' : 'text-error'}`}
          style={{ left: pct(distance) }}>
          <Icon name="arrow_drop_up" className="text-lg -mt-2" />You
        </span>
      </div>
      <div className="flex justify-between text-[11px] text-on-surface-variant mt-1">
        <span>Classroom</span>
        <span className="tabular-nums">allowed {radius}m · you {distance}m{accuracy ? ` (±${accuracy}m)` : ''}</span>
      </div>
    </div>
  );
}

/** Summary row on the success screen. */
export function DetailRow({ icon, label, value }: { icon: string; label: string; value: ReactNode }) {
  return (
    <div className="flex items-center gap-3 py-2.5">
      <Icon name={icon} className="text-on-surface-variant text-xl" />
      <span className="text-sm text-on-surface-variant flex-1">{label}</span>
      <span className="text-sm font-semibold text-on-surface tabular-nums">{value}</span>
    </div>
  );
}
