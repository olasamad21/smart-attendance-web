'use client';
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { getPhaseInfo, formatCountdown, toDate } from '@/lib/utils/session.utils';
import ProgressRing from '@/components/ui/ProgressRing';
import Badge from '@/components/ui/Badge';
import Icon from '@/components/ui/Icon';
import type { AttendanceRecord, Session, UserProfile } from '@/types';

const GPS_FLAG_LABELS: Record<string, string> = {
  accuracy_missing: 'device did not report GPS accuracy',
  accuracy_too_precise: 'GPS accuracy unrealistically precise (common with fake-location apps)',
  coordinates_too_round: 'coordinates suspiciously rounded',
  impossible_travel: 'moved impossibly fast since the previous check-in',
};

export function gpsFlags(r: AttendanceRecord): string[] {
  return Array.from(new Set([...(r.gpsFlags ?? []), ...(r.phase2GpsFlags ?? [])])).filter(f => f !== 'low_accuracy');
}

/** Most recent check-in/out time of a record, in ms. */
function lastActivity(r: AttendanceRecord): number {
  const t = [r.phase2Time, r.phase1Time].filter(Boolean).map(v => toDate(v).getTime());
  return t.length ? Math.max(...t) : 0;
}

function timeAgo(ms: number, now: number): string {
  const s = Math.max(0, Math.round((now - ms) / 1000));
  if (s < 10) return 'just now';
  if (s < 60) return `${s}s ago`;
  const m = Math.round(s / 60);
  return m < 60 ? `${m} min ago` : toDateLabel(ms);
}
function toDateLabel(ms: number) {
  return new Date(ms).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function useNow(intervalMs = 1000) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);
  return now;
}

interface Props {
  session: Session;
  attendees: AttendanceRecord[];
  absent: UserProfile[];
  enrolledCount: number;
  canOverride: boolean;
  ending: boolean;
  onRowClick: (s: UserProfile | AttendanceRecord) => void;
  onStartCheckout: () => void;
  onEnd: () => void;
}

/** Lecturer's live session screen: countdown, progress, live check-in feed, not-yet list. */
export default function LiveSessionView({
  session, attendees, absent, enrolledCount, canOverride, ending, onRowClick, onStartCheckout, onEnd,
}: Props) {
  const now = useNow();
  const [projector, setProjector] = useState(false);
  const info = getPhaseInfo(session);
  const checkedIn = attendees.filter(a => a.phase1Score > 0).length;
  const checkedOut = attendees.filter(a => a.phase2Score > 0).length;
  const present = attendees.filter(a => a.phase1Score > 0 || a.phase2Score > 0).length;
  const flagged = attendees.filter(a => gpsFlags(a).length > 0).length;
  const feed = useMemo(() => [...attendees].sort((a, b) => lastActivity(b) - lastActivity(a)), [attendees]);
  const urgent = info.status !== 'waiting' && info.remaining < 2 * 60_000;

  return (
    <div className="grid lg:grid-cols-[1fr_1.1fr] gap-4 items-start">
      {/* Left: status + controls */}
      <div className="flex flex-col gap-4 lg:sticky lg:top-20">
        <section className="rounded-3xl bg-primary-container text-on-primary-container p-5 sm:p-6 shadow-raised">
          <div className="flex items-center justify-between gap-2">
            <Badge tone="live">{info.label}</Badge>
            <span className="text-xs font-medium opacity-80 flex items-center gap-1">
              <Icon name="location_on" className="text-[14px]" />{session.classroomName} · {session.classroomRadius}m
            </span>
          </div>
          <div className="mt-5 flex items-center justify-between gap-4">
            <div>
              <p className={`text-5xl sm:text-6xl font-extrabold tracking-tight tabular-nums ${urgent ? 'text-warning' : ''}`}>
                {formatCountdown(info.remaining)}
              </p>
              <p className="text-sm opacity-80 mt-1">
                {info.status === 'waiting' ? 'until check-out opens' : 'remaining in this phase'}
              </p>
            </div>
            <ProgressRing value={enrolledCount ? present / enrolledCount : 0} size={104} stroke={9} tone="onPrimary"
              label={`${present} of ${enrolledCount} students present`}>
              <span className="text-2xl font-extrabold tabular-nums leading-none">{present}</span>
              <span className="text-[11px] opacity-75 mt-1">of {enrolledCount}</span>
            </ProgressRing>
          </div>
          <div className="mt-6 grid grid-cols-2 gap-2">
            <button onClick={() => setProjector(true)}
              className="h-11 rounded-full bg-on-primary-container text-primary-container text-sm font-bold flex items-center justify-center gap-2 active:scale-[0.98]">
              <Icon name="present_to_all" className="text-lg" />Projector
            </button>
            {info.status === 'waiting' ? (
              <button onClick={onStartCheckout}
                className="h-11 rounded-full bg-on-primary-container/15 text-on-primary-container text-sm font-bold flex items-center justify-center gap-2 active:scale-[0.98]">
                <Icon name="fast_forward" className="text-lg" />Open check-out
              </button>
            ) : (
              <button onClick={onEnd} disabled={ending}
                className="h-11 rounded-full bg-on-primary-container/15 text-on-primary-container text-sm font-bold flex items-center justify-center gap-2 active:scale-[0.98] disabled:opacity-50">
                <Icon name="stop_circle" className="text-lg" />End session
              </button>
            )}
          </div>
        </section>

        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-2 gap-3">
          <MiniStat icon="how_to_reg" label="Checked in" value={checkedIn} tone="success" />
          <MiniStat icon="logout" label="Checked out" value={checkedOut} tone="primary" />
          <MiniStat icon="hourglass_empty" label="Not yet" value={absent.length} tone="neutral" />
          <MiniStat icon="location_off" label="Location flags" value={flagged} tone={flagged ? 'error' : 'neutral'} />
        </div>
      </div>

      {/* Right: lists */}
      <div className="flex flex-col gap-4">
        <ListCard title="Live check-ins" count={attendees.length}
          hint={canOverride ? 'Tap a student to adjust their record' : undefined}>
          {feed.length === 0 ? (
            <div className="py-12 text-center">
              <Icon name="sensors" className="text-4xl text-outline animate-pulse" />
              <p className="mt-2 text-sm font-semibold text-on-surface">Waiting for the first check-in</p>
              <p className="text-xs text-on-surface-variant mt-1">Students check in from their dashboard.</p>
            </div>
          ) : feed.map(a => {
            const flags = gpsFlags(a);
            const manual = a.phase1VerificationMethod === 'manual_override' || a.phase2VerificationMethod === 'manual_override';
            const last = lastActivity(a);
            const fresh = now - last < 15_000;
            return (
              <Row key={a.attendanceId} onClick={canOverride ? () => onRowClick(a) : undefined} highlight={fresh}>
                <Avatar name={a.studentName} tone="success" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-on-surface truncate">{a.studentName}</p>
                  <p className="text-xs text-on-surface-variant truncate">
                    {a.matricNumber || '—'}{last ? ` · ${timeAgo(last, now)}` : ''}
                  </p>
                  {flags.length > 0 && (
                    <span className="inline-flex items-center gap-0.5 text-[11px] font-semibold text-error mt-0.5"
                      title={`Location check: ${flags.map(f => GPS_FLAG_LABELS[f] ?? f).join('; ')}`}>
                      <Icon name="location_off" filled className="text-[13px]" />Review location
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-1.5">
                  {manual && <Icon name="edit_note" className="text-warning text-lg" label="Manual override" />}
                  <PhasePill on={a.phase1Score > 0}>In</PhasePill>
                  {!!session.phase2Duration && <PhasePill on={a.phase2Score > 0}>Out</PhasePill>}
                </div>
              </Row>
            );
          })}
        </ListCard>

        {absent.length > 0 && (
          <ListCard title="Not checked in" count={absent.length}
            hint={canOverride ? 'Tap to check a student in manually' : undefined}>
            {absent.map(s => (
              <Row key={s.userId} onClick={canOverride ? () => onRowClick(s) : undefined}>
                <Avatar name={s.name} tone="neutral" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-on-surface truncate">{s.name}</p>
                  <p className="text-xs text-on-surface-variant truncate">{s.matricNumber || '—'}</p>
                </div>
                {canOverride && <Icon name="add_circle" className="text-primary text-xl" />}
              </Row>
            ))}
          </ListCard>
        )}
      </div>

      {projector && (
        <ProjectorMode session={session} present={present} enrolled={enrolledCount}
          recent={feed.slice(0, 8).map(a => a.studentName)} onClose={() => setProjector(false)} />
      )}
    </div>
  );
}

/** Full-screen display for the classroom projector. */
function ProjectorMode({
  session, present, enrolled, recent, onClose,
}: { session: Session; present: number; enrolled: number; recent: string[]; onClose: () => void }) {
  useNow();
  const info = getPhaseInfo(session);

  useEffect(() => {
    const el = document.documentElement;
    el.requestFullscreen?.().catch(() => {});
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('keydown', onKey);
      if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
    };
  }, [onClose]);

  const open = info.status === 'phase1_open' || info.status === 'phase2_open';
  return (
    <div className="fixed inset-0 z-[150] bg-primary-container text-on-primary-container flex flex-col p-6 sm:p-12 animate-fade-up" role="dialog" aria-label="Projector view">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xl sm:text-3xl font-bold opacity-80">{session.courseCode}</p>
          <p className="text-3xl sm:text-5xl font-extrabold tracking-tight">{session.courseTitle}</p>
        </div>
        <button onClick={onClose} aria-label="Close projector view"
          className="w-12 h-12 rounded-full bg-on-primary-container/10 flex items-center justify-center hover:bg-on-primary-container/20">
          <Icon name="close" className="text-2xl" />
        </button>
      </div>

      <div className="flex-1 grid md:grid-cols-2 gap-8 items-center">
        <div className="text-center md:text-left">
          <Badge tone="live" className="!h-9 !px-4 !text-base">{info.label}</Badge>
          <p className="mt-4 text-[22vw] md:text-[11vw] font-extrabold tabular-nums leading-none tracking-tighter">
            {formatCountdown(info.remaining)}
          </p>
          <p className="mt-4 text-xl sm:text-2xl font-semibold opacity-90">
            {open ? 'Open EduVerify on your phone and tap Check in' : info.status === 'waiting' ? 'Check-out opens soon' : 'Attendance is closed'}
          </p>
        </div>
        <div className="flex flex-col items-center gap-6">
          <ProgressRing value={enrolled ? present / enrolled : 0} size={280} stroke={18} tone="onPrimary"
            label={`${present} of ${enrolled} present`}>
            <span className="text-7xl font-extrabold tabular-nums leading-none">{present}</span>
            <span className="text-xl opacity-80 mt-2">of {enrolled} checked in</span>
          </ProgressRing>
          {recent.length > 0 && (
            <div className="flex flex-wrap justify-center gap-2 max-w-xl">
              {recent.map(n => (
                <span key={n} className="px-4 h-10 rounded-full bg-on-primary-container/10 text-lg font-semibold flex items-center gap-2 animate-scale-in">
                  <Icon name="check_circle" filled className="text-xl" />{n.split(' ')[0]}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>
      <p className="text-center text-sm opacity-60">Press Esc to exit</p>
    </div>
  );
}

function MiniStat({ icon, label, value, tone }: { icon: string; label: string; value: number; tone: 'success' | 'primary' | 'neutral' | 'error' }) {
  const toneClass = {
    success: 'bg-success-container text-on-success-container',
    primary: 'bg-primary/10 text-primary',
    neutral: 'bg-surface-container text-on-surface-variant',
    error: 'bg-error-container text-on-error-container',
  }[tone];
  return (
    <div className="bg-surface-container-lowest rounded-2xl border border-outline-variant/30 shadow-card p-3 flex items-center gap-3">
      <span className={`w-9 h-9 rounded-xl flex items-center justify-center ${toneClass}`}>
        <Icon name={icon} filled className="text-[20px]" />
      </span>
      <div>
        <p className="text-xl font-bold tabular-nums leading-tight text-on-surface">{value}</p>
        <p className="text-[11px] text-on-surface-variant">{label}</p>
      </div>
    </div>
  );
}

function ListCard({ title, count, hint, children }: { title: string; count: number; hint?: string; children: ReactNode }) {
  return (
    <section className="bg-surface-container-lowest rounded-2xl border border-outline-variant/30 shadow-card overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b border-outline-variant/30">
        <div>
          <h3 className="text-sm font-semibold text-on-surface">{title}</h3>
          {hint && <p className="text-[11px] text-on-surface-variant">{hint}</p>}
        </div>
        <span className="min-w-7 h-7 px-2 rounded-full bg-surface-container text-on-surface text-xs font-bold flex items-center justify-center tabular-nums">{count}</span>
      </div>
      <div className="divide-y divide-outline-variant/20 max-h-[28rem] overflow-y-auto">{children}</div>
    </section>
  );
}

function Row({ children, onClick, highlight }: { children: ReactNode; onClick?: () => void; highlight?: boolean }) {
  const cls = `w-full flex items-center gap-3 px-4 py-3 text-left transition-colors ${highlight ? 'bg-success-container/30 animate-fade-up' : ''}`;
  return onClick
    ? <button type="button" onClick={onClick} className={`${cls} hover:bg-surface-container-low`}>{children}</button>
    : <div className={cls}>{children}</div>;
}

function Avatar({ name, tone }: { name: string; tone: 'success' | 'neutral' }) {
  const initials = name.split(' ').filter(Boolean).slice(0, 2).map(p => p[0]?.toUpperCase()).join('') || '?';
  return (
    <span className={`w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${tone === 'success' ? 'bg-success-container text-on-success-container' : 'bg-surface-container text-on-surface-variant'}`}>
      {initials}
    </span>
  );
}

function PhasePill({ on, children }: { on: boolean; children: ReactNode }) {
  return (
    <span className={`h-6 px-2 rounded-full text-[11px] font-bold flex items-center gap-0.5 ${on ? 'bg-success-container text-on-success-container' : 'bg-surface-container text-on-surface-variant/70'}`}>
      {on && <Icon name="check" className="text-[13px]" />}{children}
    </span>
  );
}

/** Review-only warning when the server flagged a student's location. */
export function GpsFlagBadge({ record }: { record: AttendanceRecord }) {
  const flags = gpsFlags(record);
  if (flags.length === 0) return null;
  return (
    <span className="inline-flex items-center gap-0.5 text-[11px] font-semibold text-error mt-0.5"
      title={`Location check: ${flags.map(f => GPS_FLAG_LABELS[f] ?? f).join('; ')}`}>
      <Icon name="location_off" filled className="text-[13px]" />Review location
    </span>
  );
}
