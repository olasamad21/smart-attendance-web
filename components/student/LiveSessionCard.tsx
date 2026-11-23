'use client';
import Link from 'next/link';
import { getPhaseInfo, formatCountdown, toDate } from '@/lib/utils/session.utils';
import ProgressRing from '@/components/ui/ProgressRing';
import Badge from '@/components/ui/Badge';
import Icon from '@/components/ui/Icon';
import Ticker from '@/components/ui/Ticker';
import type { AttendanceRecord, Course, Session } from '@/types';

type Variant = 'action' | 'waiting' | 'done' | 'missed';

interface CardState {
  variant: Variant;
  headline: string;          // under the course title
  ringLabel: string;         // under the countdown
  remaining: number;         // ms shown in the ring
  fraction: number;          // 0–1 of the current window remaining
  cta: string;
  icon: string;
}

/** Fraction of [start, end] still remaining at `now`. */
function remainingFraction(start: Date, end: Date, now = Date.now()): number {
  const total = end.getTime() - start.getTime();
  return total > 0 ? Math.max(0, Math.min(1, (end.getTime() - now) / total)) : 0;
}

export function sessionCardState(session: Session, record: AttendanceRecord | null): CardState {
  const info = getPhaseInfo(session);
  const p1Start = toDate(session.phase1Start), p1End = toDate(session.phase1End);
  const p2Start = toDate(session.phase2Start), p2End = toDate(session.phase2End);
  const checkedIn = record?.phase1Status === 'present';
  const checkedOut = record?.phase2Status === 'present';

  if (info.status === 'phase1_open') {
    if (!checkedIn) {
      return { variant: 'action', headline: 'Check-in is open', ringLabel: 'left', remaining: info.remaining,
        fraction: remainingFraction(p1Start, p1End), cta: 'Check in now', icon: 'how_to_reg' };
    }
    return { variant: 'waiting', headline: 'You’re checked in', ringLabel: 'to check-out',
      remaining: info.timeUntilPhase2 ?? 0, fraction: remainingFraction(p1Start, p2Start),
      cta: 'Checked in · check-out opens later', icon: 'check_circle' };
  }
  if (info.status === 'waiting') {
    if (!checkedIn) {
      return { variant: 'missed', headline: 'Check-in closed', ringLabel: 'to check-out',
        remaining: info.remaining, fraction: remainingFraction(p1End, p2Start),
        cta: 'You missed check-in', icon: 'event_busy' };
    }
    return { variant: 'waiting', headline: 'You’re checked in', ringLabel: 'to check-out',
      remaining: info.remaining, fraction: remainingFraction(p1End, p2Start),
      cta: 'Check-out opens soon', icon: 'hourglass_top' };
  }
  if (info.status === 'phase2_open') {
    if (checkedOut) {
      return { variant: 'done', headline: 'Attendance complete', ringLabel: 'session ends',
        remaining: info.remaining, fraction: 1, cta: 'All done for this class', icon: 'task_alt' };
    }
    if (!checkedIn) {
      return { variant: 'missed', headline: 'Check-out only', ringLabel: 'left',
        remaining: info.remaining, fraction: remainingFraction(p2Start, p2End),
        cta: 'You missed check-in', icon: 'event_busy' };
    }
    return { variant: 'action', headline: 'Check-out is open', ringLabel: 'left', remaining: info.remaining,
      fraction: remainingFraction(p2Start, p2End), cta: 'Check out now', icon: 'logout' };
  }
  return { variant: checkedIn ? 'done' : 'missed', headline: 'Session ended', ringLabel: 'ended', remaining: 0,
    fraction: 0, cta: checkedIn ? 'Attendance recorded' : 'Session ended', icon: checkedIn ? 'task_alt' : 'block' };
}

const CTA_STYLE: Record<Variant, string> = {
  action: 'bg-on-primary-container text-primary-container shadow-card active:scale-[0.98] hover:brightness-110',
  waiting: 'bg-on-primary-container/15 text-on-primary-container',
  done: 'bg-success text-on-success',
  missed: 'bg-on-primary-container/10 text-on-primary-container/70',
};

/** Hero card for a course whose attendance session is live. Re-renders itself every second. */
export default function LiveSessionCard({
  course, session, record,
}: { course: Course; session: Session; record: AttendanceRecord | null }) {
  return (
    <Ticker>
      {() => {
        const s = sessionCardState(session, record);
        const urgent = s.variant === 'action' && s.remaining < 2 * 60_000;
        return (
          <div className="relative overflow-hidden rounded-3xl bg-primary-container text-on-primary-container p-5 shadow-raised animate-fade-up">
            <div aria-hidden className="absolute -right-10 -top-10 w-40 h-40 rounded-full bg-on-primary-container/5" />
            <div className="relative flex items-center justify-between gap-2">
              <Badge tone="live">Live</Badge>
              <span className="text-[11px] font-medium opacity-80 flex items-center gap-1 truncate">
                <Icon name="location_on" className="text-[14px]" />{session.classroomName}
                {session.totalDuration ? ` · ${session.totalDuration} min` : ''}
              </span>
            </div>

            <div className="relative mt-4 flex items-center gap-4">
              <ProgressRing value={s.fraction} size={84} stroke={7} tone={urgent ? 'warning' : 'onPrimary'}
                label={`${formatCountdown(s.remaining)} ${s.ringLabel}`}>
                <span className="text-base font-bold tabular-nums leading-none">{formatCountdown(s.remaining)}</span>
                <span className="text-[10px] opacity-75 mt-1">{s.ringLabel}</span>
              </ProgressRing>
              <div className="min-w-0">
                <p className="text-xs font-bold opacity-80">{course.courseCode}</p>
                <p className="text-lg font-bold leading-tight truncate">{course.courseTitle}</p>
                <p className="text-sm opacity-85 mt-0.5">{s.headline}</p>
              </div>
            </div>

            {s.variant === 'action' ? (
              <Link href={`/student/verify?courseId=${course.courseId}`}
                className={`relative mt-5 h-12 rounded-full text-sm font-bold flex items-center justify-center gap-2 transition-all ${CTA_STYLE.action}`}>
                <Icon name={s.icon} filled className="text-xl" />{s.cta}
              </Link>
            ) : (
              <div className={`relative mt-5 h-12 rounded-full text-sm font-semibold flex items-center justify-center gap-2 ${CTA_STYLE[s.variant]}`}>
                <Icon name={s.icon} filled className="text-xl" />{s.cta}
              </div>
            )}
          </div>
        );
      }}
    </Ticker>
  );
}
