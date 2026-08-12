'use client';
import { useEffect, useState, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { subscribeToSession, endSession, updateSessionStatus, syncSessionPhase } from '@/lib/firebase/sessions.service';
import { subscribeToSessionAttendance } from '@/lib/firebase/attendance.service';
import { Session, AttendanceRecord } from '@/types';
import { toDate, formatCountdown, getPhaseInfo } from '@/lib/utils/session.utils';

export default function LiveSessionPage() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const router = useRouter();
  const [session, setSession] = useState<Session | null>(null);
  const [attendees, setAttendees] = useState<AttendanceRecord[]>([]);
  const [timeLeft, setTimeLeft] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [ending, setEnding] = useState(false);

  useEffect(() => {
    if (!sessionId) return;
    const unsub1 = subscribeToSession(sessionId, (s) => {
      setSession(s);
      setIsLoading(false);
    });
    const unsub2 = subscribeToSessionAttendance(sessionId, setAttendees);
    return () => { unsub1(); unsub2(); };
  }, [sessionId]);

  // Countdown timer + auto phase transitions
  useEffect(() => {
    if (!session || session.status === 'ended') return;
    const timer = setInterval(async () => {
      // Self-healing: sync phase from timestamps
      const synced = await syncSessionPhase(session);
      if (synced.status !== session.status) {
        // Status was corrected — the Firestore subscription will update the session state
        return;
      }
      const info = getPhaseInfo(session);
      setTimeLeft(info.remaining);
    }, 1000);
    return () => clearInterval(timer);
  }, [session, sessionId]);

  const handleEnd = async () => {
    if (!confirm('End this session now? Students will no longer be able to verify.')) return;
    setEnding(true);
    try {
      await endSession(sessionId);
      router.push(`/lecturer/courses/${session?.courseId}`);
    } catch (e) { setEnding(false); }
  };

  const getStatusColor = () => {
    if (!session) return 'bg-surface-container';
    if (session.status === 'phase1_open') return 'bg-primary-container';
    if (session.status === 'waiting') return 'bg-secondary-container/50';
    if (session.status === 'phase2_open') return 'bg-primary-container/70';
    return 'bg-surface-container';
  };

  const getStatusLabel = () => {
    if (!session) return '';
    return getPhaseInfo(session).label;
  };

  if (isLoading) return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin" />
    </div>
  );

  return (
    <div className="bg-background min-h-screen pb-8">
      <header className="bg-surface sticky top-0 z-50 shadow-sm">
        <div className="flex items-center justify-between px-5 h-12 max-w-lg mx-auto">
          <Link href={`/lecturer/courses/${session?.courseId}`}
            className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-surface-container-low text-primary">
            <span className="material-symbols-outlined">arrow_back</span>
          </Link>
          <div className="text-center">
            <p className="text-sm font-bold text-on-surface">{session?.courseCode}</p>
            <p className="text-xs text-on-surface-variant">{session?.classroomName}</p>
          </div>
          <button onClick={handleEnd} disabled={ending || session?.status === 'ended'}
            className="text-xs font-semibold text-error px-3 h-8 rounded-full border border-error/30 hover:bg-error-container/30 active:scale-95 disabled:opacity-40">
            End
          </button>
        </div>
      </header>

      <main className="px-5 pt-6 max-w-lg mx-auto">
        {/* Status banner */}
        <div className={`${getStatusColor()} rounded-2xl p-6 flex flex-col items-center mb-6 relative overflow-hidden`}>
          <p className="text-xs font-bold text-on-primary-container uppercase tracking-widest mb-3 z-10">
            {getStatusLabel()}
          </p>
          <p className="text-5xl font-bold tracking-tighter tabular-nums text-on-primary-container z-10">
            {formatCountdown(timeLeft)}
          </p>
          <p className="text-xs text-on-primary-container/70 mt-1 z-10">remaining</p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 gap-3 mb-6">
          <div className="bg-surface-container-lowest rounded-2xl p-4 card-shadow text-center">
            <p className="text-3xl font-bold text-on-surface">
              {attendees.filter(a => a.phase1Score > 0).length}
            </p>
            <p className="text-xs text-on-surface-variant mt-1">Phase 1 checked in</p>
          </div>
          <div className="bg-surface-container-lowest rounded-2xl p-4 card-shadow text-center">
            <p className="text-3xl font-bold text-on-surface">
              {attendees.filter(a => a.phase2Score > 0).length}
            </p>
            <p className="text-xs text-on-surface-variant mt-1">Phase 2 checked out</p>
          </div>
        </div>

        {/* Live attendee list */}
        <div className="bg-surface-container-lowest rounded-2xl card-shadow overflow-hidden">
          <div className="flex items-center justify-between p-4 border-b border-surface-variant">
            <h3 className="text-sm font-semibold text-on-surface">Live Attendance</h3>
            <span className="bg-primary text-on-primary text-xs font-bold px-2 py-0.5 rounded-full">{attendees.length}</span>
          </div>
          {attendees.length === 0 ? (
            <div className="p-8 text-center">
              <span className="material-symbols-outlined text-outline text-3xl mb-2 block">groups</span>
              <p className="text-sm text-on-surface-variant">Waiting for students to verify...</p>
            </div>
          ) : (
            <div className="divide-y divide-surface-variant max-h-80 overflow-y-auto">
              {attendees.map((a, i) => (
                <div key={a.attendanceId} className="flex items-center gap-3 p-3">
                  <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center text-on-primary text-xs font-bold">
                    {i + 1}
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-medium text-on-surface">{a.studentName}</p>
                    <p className="text-xs text-on-surface-variant">{a.matricNumber}</p>
                  </div>
                  <div className="flex gap-1">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${a.phase1Score > 0 ? 'bg-secondary-container/30 text-on-secondary-container' : 'bg-surface-container text-on-surface-variant'}`}>P1</span>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${a.phase2Score > 0 ? 'bg-secondary-container/30 text-on-secondary-container' : 'bg-surface-container text-on-surface-variant'}`}>P2</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
