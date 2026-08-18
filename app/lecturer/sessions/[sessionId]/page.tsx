'use client';
import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { subscribeToSession, endSession, syncSessionPhase, startPhase2Early } from '@/lib/firebase/sessions.service';
import { subscribeToSessionAttendance, getSessionAttendance, awardFullMarksAndEnd } from '@/lib/firebase/attendance.service';
import { getEnrolledStudents } from '@/lib/firebase/courses.service';
import { Session, AttendanceRecord, UserProfile } from '@/types';
import { formatCountdown, getPhaseInfo } from '@/lib/utils/session.utils';
import { downloadCSV } from '@/lib/utils/csv.utils';
import { downloadPDF } from '@/lib/utils/pdf.utils';

export default function LiveSessionPage() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const router = useRouter();
  const [session, setSession] = useState<Session | null>(null);
  const [attendees, setAttendees] = useState<AttendanceRecord[]>([]);
  const [enrolledStudents, setEnrolledStudents] = useState<UserProfile[]>([]);
  const [timeLeft, setTimeLeft] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [ending, setEnding] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [showExportMenu, setShowExportMenu] = useState(false);
  
  // Emergency actions state
  const [showEndDialog, setShowEndDialog] = useState(false);
  const [showPhase2Dialog, setShowPhase2Dialog] = useState(false);
  const [phase2DurationInput, setPhase2DurationInput] = useState('2');

  useEffect(() => {
    if (!sessionId) return;
    const unsub1 = subscribeToSession(sessionId, (s) => {
      setSession(s);
      setIsLoading(false);
      // When session loads, fetch enrolled students for the absent list
      if (s?.courseId) {
        getEnrolledStudents(s.courseId).then(setEnrolledStudents).catch(console.error);
      }
    });
    const unsub2 = subscribeToSessionAttendance(sessionId, setAttendees);
    return () => { unsub1(); unsub2(); };
  }, [sessionId]);

  // Countdown timer + auto phase transitions
  useEffect(() => {
    if (!session || session.status === 'ended') return;
    const timer = setInterval(async () => {
      const synced = await syncSessionPhase(session);
      if (synced.status !== session.status) return;
      const info = getPhaseInfo(session);
      setTimeLeft(info.remaining);
    }, 1000);
    return () => clearInterval(timer);
  }, [session, sessionId]);

  const handleEnd = () => {
    setShowEndDialog(true);
  };

  const handleEndWithMarks = async () => {
    setEnding(true);
    setShowEndDialog(false);
    try {
      const phase2Max = session?.phase2Duration ? 2 : 2; // Assuming max Phase 2 score is 2 from course marks
      await awardFullMarksAndEnd(sessionId, phase2Max);
    } catch (e) { setEnding(false); }
  };

  const handleEndNormal = async () => {
    setEnding(true);
    setShowEndDialog(false);
    try {
      await endSession(sessionId);
    } catch (e) { setEnding(false); }
  };

  const handleStartPhase2Now = async () => {
    if (!phase2DurationInput || isNaN(Number(phase2DurationInput))) return;
    setEnding(true);
    setShowPhase2Dialog(false);
    try {
      await startPhase2Early(sessionId, Number(phase2DurationInput));
    } catch (e) { console.error(e); }
    finally { setEnding(false); }
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

  // --- Report helpers ---
  const getAttendedStudents = () => {
    return attendees
      .filter(a => a.phase1Score > 0 || a.phase2Score > 0)
      .sort((a, b) => a.studentName.localeCompare(b.studentName));
  };

  const getAbsentStudents = () => {
    const attendedIds = new Set(attendees.map(a => a.studentId));
    return enrolledStudents
      .filter(s => !attendedIds.has(s.userId))
      .sort((a, b) => a.name.localeCompare(b.name));
  };

  const sessionDate = session?.createdAt
    ? new Date((session.createdAt as any)?.seconds ? (session.createdAt as any).seconds * 1000 : session.createdAt).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })
    : 'Unknown Date';

  const handleExport = async (mode: 'attended' | 'full', format: 'csv' | 'pdf' = 'csv') => {
    if (!session) return;
    setDownloading(true);
    setShowExportMenu(false);
    try {
      const headers = ['S/N', 'Student Name', 'Matric No', 'Phase 1', 'Phase 2', 'Total', 'Status'];
      const attended = getAttendedStudents();
      const rows: (string | number)[][] = [];
      let sn = 1;

      attended.forEach(a => {
        rows.push([sn++, a.studentName, a.matricNumber, a.phase1Score, a.phase2Score, a.totalScore, 'Present']);
      });

      if (mode === 'full') {
        const absent = getAbsentStudents();
        absent.forEach(s => {
          rows.push([sn++, s.name, s.matricNumber || '', 0, 0, 0, 'Absent']);
        });
      }

      const label = mode === 'full' ? 'Full' : 'Attended';
      if (format === 'pdf') {
        downloadPDF({
          title: `Session Attendance Report — ${label}`,
          courseCode: session.courseCode,
          courseTitle: session.courseTitle,
          date: sessionDate,
          headers,
          rows,
          filename: `${session.courseCode}_${sessionDate.replace(/,?\s+/g, '_')}_${label}.pdf`,
        });
      } else {
        const filename = `${session.courseCode}_${sessionDate.replace(/,?\s+/g, '_')}_${label}.csv`;
        downloadCSV(filename, headers, rows);
      }
    } finally {
      setDownloading(false);
    }
  };

  if (isLoading) return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin" />
    </div>
  );

  const isEnded = session?.status === 'ended';
  const attended = getAttendedStudents();
  const absent = getAbsentStudents();

  return (
    <div className="bg-background pb-8">
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
          {!isEnded ? (
            <button onClick={handleEnd} disabled={ending}
              className="text-xs font-semibold text-error px-3 h-8 rounded-full border border-error/30 hover:bg-error-container/30 active:scale-95 disabled:opacity-40">
              End
            </button>
          ) : (
            <div className="relative">
              <button
                onClick={() => setShowExportMenu(!showExportMenu)}
                disabled={downloading}
                className="text-xs font-semibold text-primary px-3 h-8 rounded-full border border-primary/30 hover:bg-primary-container/30 active:scale-95 flex items-center gap-1 disabled:opacity-40"
              >
                <span className="material-symbols-outlined text-sm">download</span>
                Export
              </button>
              {showExportMenu && (
                <div className="absolute right-0 top-10 bg-surface-container-lowest rounded-xl shadow-lg border border-outline-variant/30 z-50 overflow-hidden w-52">
                  <div className="px-3 py-2 bg-surface-container-low/50">
                    <p className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider">CSV Export</p>
                  </div>
                  <button
                    onClick={() => handleExport('attended', 'csv')}
                    className="w-full px-4 py-2.5 text-left text-sm text-on-surface hover:bg-surface-container-low flex items-center gap-2 transition-colors"
                  >
                    <span className="material-symbols-outlined text-base text-primary">person_check</span>
                    Attended Only
                  </button>
                  <button
                    onClick={() => handleExport('full', 'csv')}
                    className="w-full px-4 py-2.5 text-left text-sm text-on-surface hover:bg-surface-container-low flex items-center gap-2 transition-colors"
                  >
                    <span className="material-symbols-outlined text-base text-primary">group</span>
                    Full Report
                  </button>
                  <div className="px-3 py-2 bg-surface-container-low/50 border-t border-outline-variant/20">
                    <p className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider">PDF Export</p>
                  </div>
                  <button
                    onClick={() => handleExport('attended', 'pdf')}
                    className="w-full px-4 py-2.5 text-left text-sm text-on-surface hover:bg-surface-container-low flex items-center gap-2 transition-colors"
                  >
                    <span className="material-symbols-outlined text-base text-error">picture_as_pdf</span>
                    Attended Only
                  </button>
                  <button
                    onClick={() => handleExport('full', 'pdf')}
                    className="w-full px-4 py-2.5 text-left text-sm text-on-surface hover:bg-surface-container-low flex items-center gap-2 transition-colors"
                  >
                    <span className="material-symbols-outlined text-base text-error">picture_as_pdf</span>
                    Full Report
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </header>

      <main className="px-5 pt-6 max-w-lg mx-auto">
        {/* Live Session View */}
        {!isEnded && (
          <>
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

            {/* Quick Actions */}
            {session?.status === 'waiting' && (
              <button
                onClick={() => setShowPhase2Dialog(true)}
                className="w-full mb-6 bg-secondary-container text-on-secondary-container rounded-xl h-12 font-semibold flex items-center justify-center gap-2 active:scale-95 transition-all"
              >
                <span className="material-symbols-outlined text-lg">fast_forward</span>
                Start Phase 2 Now
              </button>
            )}

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
          </>
        )}

        {/* Ended Session Report View */}
        {isEnded && (
          <>
            {/* Session summary banner */}
            <div className="bg-surface-container rounded-2xl p-6 flex flex-col items-center mb-6">
              <span className="material-symbols-outlined text-3xl text-on-surface-variant mb-2">event_available</span>
              <p className="text-xs font-bold text-on-surface-variant uppercase tracking-widest mb-1">Session Ended</p>
              <p className="text-sm text-on-surface-variant">{sessionDate}</p>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-3 gap-3 mb-6">
              <div className="bg-surface-container-lowest rounded-2xl p-4 card-shadow text-center">
                <p className="text-2xl font-bold text-on-surface">{attended.length}</p>
                <p className="text-[10px] text-on-surface-variant mt-1">Present</p>
              </div>
              <div className="bg-surface-container-lowest rounded-2xl p-4 card-shadow text-center">
                <p className="text-2xl font-bold text-on-surface">{absent.length}</p>
                <p className="text-[10px] text-on-surface-variant mt-1">Absent</p>
              </div>
              <div className="bg-surface-container-lowest rounded-2xl p-4 card-shadow text-center">
                <p className="text-2xl font-bold text-on-surface">{enrolledStudents.length}</p>
                <p className="text-[10px] text-on-surface-variant mt-1">Total</p>
              </div>
            </div>

            {/* Attendance Table */}
            <div className="bg-surface-container-lowest rounded-2xl card-shadow overflow-hidden mb-4">
              {/* Table header */}
              <div className="grid grid-cols-[2rem_1fr_3rem_3rem_3rem] gap-1 px-4 py-3 border-b border-surface-variant bg-surface-container-low/50">
                <span className="text-[10px] font-bold text-on-surface-variant">#</span>
                <span className="text-[10px] font-bold text-on-surface-variant">Student</span>
                <span className="text-[10px] font-bold text-on-surface-variant text-center">P1</span>
                <span className="text-[10px] font-bold text-on-surface-variant text-center">P2</span>
                <span className="text-[10px] font-bold text-on-surface-variant text-center">Total</span>
              </div>

              {/* Attended students */}
              {attended.length > 0 && (
                <div className="border-b border-surface-variant">
                  <div className="px-4 py-2 bg-secondary-container/10">
                    <span className="text-[10px] font-bold text-on-secondary-container uppercase tracking-wider">Present ({attended.length})</span>
                  </div>
                  <div className="divide-y divide-surface-variant/50">
                    {attended.map((a, i) => (
                      <div key={a.attendanceId} className="grid grid-cols-[2rem_1fr_3rem_3rem_3rem] gap-1 px-4 py-2.5 items-center">
                        <span className="text-xs text-on-surface-variant">{i + 1}</span>
                        <div className="min-w-0">
                          <p className="text-xs font-medium text-on-surface truncate">{a.studentName}</p>
                          <p className="text-[10px] text-on-surface-variant truncate">{a.matricNumber}</p>
                        </div>
                        <span className={`text-xs text-center font-semibold ${a.phase1Score > 0 ? 'text-on-secondary-container' : 'text-on-surface-variant'}`}>
                          {a.phase1Score}
                        </span>
                        <span className={`text-xs text-center font-semibold ${a.phase2Score > 0 ? 'text-on-secondary-container' : 'text-on-surface-variant'}`}>
                          {a.phase2Score}
                        </span>
                        <span className="text-xs text-center font-bold text-on-surface">{a.totalScore}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Absent students */}
              {absent.length > 0 && (
                <div>
                  <div className="px-4 py-2 bg-error-container/10">
                    <span className="text-[10px] font-bold text-error uppercase tracking-wider">Absent ({absent.length})</span>
                  </div>
                  <div className="divide-y divide-surface-variant/50">
                    {absent.map((s, i) => (
                      <div key={s.userId} className="grid grid-cols-[2rem_1fr_3rem_3rem_3rem] gap-1 px-4 py-2.5 items-center opacity-50">
                        <span className="text-xs text-on-surface-variant">{attended.length + i + 1}</span>
                        <div className="min-w-0">
                          <p className="text-xs font-medium text-on-surface truncate">{s.name}</p>
                          <p className="text-[10px] text-on-surface-variant truncate">{s.matricNumber || '—'}</p>
                        </div>
                        <span className="text-xs text-center text-on-surface-variant">0</span>
                        <span className="text-xs text-center text-on-surface-variant">0</span>
                        <span className="text-xs text-center text-on-surface-variant">0</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {attended.length === 0 && absent.length === 0 && (
                <div className="p-8 text-center">
                  <span className="material-symbols-outlined text-outline text-3xl mb-2 block">groups</span>
                  <p className="text-sm text-on-surface-variant">No students enrolled or attended</p>
                </div>
              )}
            </div>
          </>
        )}
      </main>

      {/* Click-outside handler for export menu */}
      {showExportMenu && (
        <div className="fixed inset-0 z-40" onClick={() => setShowExportMenu(false)} />
      )}

      {/* End Session Dialog */}
      {showEndDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-surface-container-lowest rounded-3xl p-6 w-full max-w-sm card-shadow relative animate-in fade-in zoom-in-95 duration-200">
            <h3 className="text-xl font-bold text-on-surface mb-2">End Session</h3>
            <p className="text-sm text-on-surface-variant mb-6">Are you sure you want to end this session?</p>
            
            <div className="flex flex-col gap-3">
              <button
                onClick={handleEndWithMarks}
                disabled={ending}
                className="w-full bg-primary-container text-on-primary-container rounded-xl h-12 font-semibold flex items-center justify-center gap-2 active:scale-95 transition-all disabled:opacity-50"
              >
                <span className="material-symbols-outlined">workspace_premium</span>
                End & Award Full Marks
              </button>
              <button
                onClick={handleEndNormal}
                disabled={ending}
                className="w-full bg-error-container text-on-error-container rounded-xl h-12 font-semibold flex items-center justify-center gap-2 active:scale-95 transition-all disabled:opacity-50"
              >
                <span className="material-symbols-outlined">stop_circle</span>
                End & Keep Current Scores
              </button>
              <button
                onClick={() => setShowEndDialog(false)}
                disabled={ending}
                className="w-full bg-transparent text-on-surface rounded-xl h-12 font-semibold active:scale-95 transition-all mt-2"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Start Phase 2 Dialog */}
      {showPhase2Dialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-surface-container-lowest rounded-3xl p-6 w-full max-w-sm card-shadow relative animate-in fade-in zoom-in-95 duration-200">
            <h3 className="text-xl font-bold text-on-surface mb-2">Start Phase 2</h3>
            <p className="text-sm text-on-surface-variant mb-6">Skip the waiting period and start Phase 2 immediately.</p>
            
            <div className="mb-6">
              <label className="text-xs font-bold text-on-surface-variant uppercase tracking-wider mb-2 block">Phase 2 Duration (minutes)</label>
              <div className="relative">
                <input
                  type="number"
                  value={phase2DurationInput}
                  onChange={(e) => setPhase2DurationInput(e.target.value)}
                  className="w-full bg-surface-container h-14 rounded-2xl px-4 text-on-surface focus:outline-none focus:ring-2 focus:ring-primary transition-all"
                  min="1"
                  max="60"
                />
                <span className="absolute right-4 top-4 text-on-surface-variant font-medium">min</span>
              </div>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setShowPhase2Dialog(false)}
                disabled={ending}
                className="flex-1 bg-surface-container text-on-surface rounded-xl h-12 font-semibold active:scale-95 transition-all"
              >
                Cancel
              </button>
              <button
                onClick={handleStartPhase2Now}
                disabled={ending || !phase2DurationInput || isNaN(Number(phase2DurationInput))}
                className="flex-[2] bg-primary text-on-primary rounded-xl h-12 font-semibold flex items-center justify-center gap-2 active:scale-95 transition-all disabled:opacity-50"
              >
                <span className="material-symbols-outlined">play_arrow</span>
                Start Now
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
