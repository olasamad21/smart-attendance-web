import { Session } from '@/types';

/**
 * Convert Firestore timestamp values to JS Date.
 * Handles: Firestore Timestamp objects, Date objects, plain objects with `seconds`, and raw values.
 */
export function toDate(val: any): Date {
  if (!val) return new Date();
  if (val instanceof Date) return val;
  if (typeof val.toDate === 'function') return val.toDate();
  if (val.seconds) return new Date(val.seconds * 1000);
  return new Date(val);
}

/**
 * Compute the real session phase from stored timestamps.
 * This makes the system self-healing — any client that calls this
 * will determine the correct phase regardless of whether the
 * lecturer's timer was running.
 */
export function resolveSessionPhase(session: Session): Session['status'] {
  if (session.status === 'ended') return 'ended';

  const now = new Date();
  const phase1End = toDate(session.phase1End);
  const phase2Start = toDate(session.phase2Start);
  const phase2End = toDate(session.phase2End);

  if (now >= phase2End) return 'ended';
  if (now >= phase2Start) return 'phase2_open';
  if (now >= phase1End) return 'waiting';
  return 'phase1_open';
}

export type PhaseInfo = {
  /** Current phase label for display */
  label: string;
  /** Milliseconds remaining in this phase (or until next phase) */
  remaining: number;
  /** The resolved session status */
  status: Session['status'];
  /** Human-readable description of what's happening */
  description: string;
};

/**
 * Get detailed info about the current phase, including remaining time.
 */
export function getPhaseInfo(session: Session): PhaseInfo {
  const status = resolveSessionPhase(session);
  const now = new Date();
  const phase1End = toDate(session.phase1End);
  const phase2Start = toDate(session.phase2Start);
  const phase2End = toDate(session.phase2End);

  switch (status) {
    case 'phase1_open':
      return {
        label: 'Phase 1 — Check In',
        remaining: Math.max(0, phase1End.getTime() - now.getTime()),
        status,
        description: 'Check-in window is open',
      };
    case 'waiting':
      return {
        label: 'Waiting Period',
        remaining: Math.max(0, phase2Start.getTime() - now.getTime()),
        status,
        description: 'Phase 2 opens soon',
      };
    case 'phase2_open':
      return {
        label: 'Phase 2 — Check Out',
        remaining: Math.max(0, phase2End.getTime() - now.getTime()),
        status,
        description: 'Check-out window is open',
      };
    case 'ended':
    default:
      return {
        label: 'Session Ended',
        remaining: 0,
        status: 'ended',
        description: 'This session has concluded',
      };
  }
}

/**
 * Format milliseconds into MM:SS countdown string.
 */
export function formatCountdown(ms: number): string {
  if (ms <= 0) return '00:00';
  const totalSecs = Math.floor(ms / 1000);
  const mins = Math.floor(totalSecs / 60);
  const secs = totalSecs % 60;
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}
