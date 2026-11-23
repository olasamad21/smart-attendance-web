'use client';
import type { ReactNode, RefObject } from 'react';
import type { TrackerStatus } from '@/hooks/useFaceTracker';

export type OvalTone = 'neutral' | 'guide' | 'good' | 'done';

const OVAL_TONE: Record<OvalTone, string> = {
  neutral: 'border-white/70',
  guide: 'border-amber-300',
  good: 'border-sky-300',
  done: 'border-emerald-400',
};

interface FaceCameraProps {
  videoRef: RefObject<HTMLVideoElement | null>;
  status: TrackerStatus;
  title: string;
  instruction: string;
  subtext?: string;
  tone?: OvalTone;
  /** Completed / total steps, shown as dots under the instruction. */
  steps?: { done: number; total: number };
  onBack?: () => void;
  badge?: ReactNode;
}

/** Full-height mirrored camera preview with an oval face guide and live instructions. */
export default function FaceCamera({
  videoRef, status, title, instruction, subtext, tone = 'neutral', steps, onBack, badge,
}: FaceCameraProps) {
  return (
    <div className="w-full overflow-hidden flex flex-col relative bg-black max-w-md mx-auto" style={{ height: '100dvh' }}>
      <video ref={videoRef} className="absolute inset-0 w-full h-full object-cover -scale-x-100" autoPlay muted playsInline />
      <div className="absolute inset-0 z-10 flex flex-col">
        <div className="flex items-center justify-between p-4">
          {onBack ? (
            <button onClick={onBack} aria-label="Back"
              className="w-10 h-10 rounded-full bg-black/40 backdrop-blur-sm flex items-center justify-center text-white active:scale-95">
              <span className="material-symbols-outlined">arrow_back</span>
            </button>
          ) : <span className="w-10" />}
          <h2 className="text-white font-bold drop-shadow-md">{title}</h2>
          <div className="min-w-10 flex justify-end">{badge}</div>
        </div>

        <div className="flex-1 flex flex-col items-center justify-center px-6">
          <div className={`w-64 h-80 sm:w-72 sm:h-[22rem] rounded-[50%] border-4 ${OVAL_TONE[tone]} shadow-[0_0_0_9999px_rgba(0,0,0,0.55)] transition-colors duration-300`} />
          <div className="mt-5 min-h-[72px] text-center" aria-live="polite">
            {status === 'starting' ? (
              <p className="text-white text-base font-semibold drop-shadow-md">Starting camera…</p>
            ) : (
              <>
                <p className="text-white text-base font-semibold drop-shadow-md">{instruction}</p>
                {subtext && <p className="text-white/70 text-xs mt-1 drop-shadow-md">{subtext}</p>}
              </>
            )}
          </div>
          {steps && (
            <div className="flex gap-2 mt-2" aria-label={`Step ${Math.min(steps.done + 1, steps.total)} of ${steps.total}`}>
              {Array.from({ length: steps.total }).map((_, i) => (
                <span key={i} className={`h-1.5 rounded-full transition-all duration-300 ${i < steps.done ? 'w-6 bg-emerald-400' : i === steps.done ? 'w-6 bg-white' : 'w-3 bg-white/40'}`} />
              ))}
            </div>
          )}
        </div>
        <div className="h-10" />
      </div>
    </div>
  );
}
