'use client';
import { useEffect, useState } from 'react';
import { useAuthStore } from '@/store/auth.store';
import { getStudentCourses } from '@/lib/firebase/courses.service';
import { subscribeToActiveSessionForCourse, subscribeToStudentSessionAttendance } from '@/lib/firebase/sessions.service';
import { checkFaceEnrolled } from '@/lib/api/face.api';
import { getStudentOverallAttendance } from '@/lib/firebase/attendance.service';
import { resolveSessionPhase } from '@/lib/utils/session.utils';
import TopAppBar from '@/components/layout/TopAppBar';
import ErrorBanner, { errorMessage } from '@/components/ui/ErrorBanner';
import LiveSessionCard from '@/components/student/LiveSessionCard';
import Card, { CardLink, SectionHeader } from '@/components/ui/Card';
import { ButtonLink } from '@/components/ui/Button';
import Badge from '@/components/ui/Badge';
import Icon from '@/components/ui/Icon';
import ProgressRing from '@/components/ui/ProgressRing';
import Skeleton, { SkeletonCards } from '@/components/ui/Skeleton';
import Ticker from '@/components/ui/Ticker';
import { Course, Session, AttendanceRecord } from '@/types';
import { getGreeting, greetingName } from '@/lib/utils/date.utils';

/** Attendance below this is shown as "at risk" (common exam-eligibility rule). */
const ATTENDANCE_TARGET = 75;


export default function StudentDashboard() {
  const { user } = useAuthStore();
  const [courses, setCourses] = useState<Course[]>([]);
  const [activeSessions, setActiveSessions] = useState<Record<string, Session>>({});
  const [studentRecords, setStudentRecords] = useState<Record<string, AttendanceRecord>>({});
  const [faceEnrolled, setFaceEnrolled] = useState(true);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [overall, setOverall] = useState<{ attended: number; total: number; percentage: number | null } | null>(null);
  const firstName = greetingName(user?.name);

  useEffect(() => {
    if (!user?.userId) return;
    let isMounted = true;
    const sessionUnsubs: (() => void)[] = [];
    // One attendance listener per course, re-created when the course's live session changes.
    const recordSubs: Record<string, { sessionId: string; unsub: () => void }> = {};

    const dropRecord = (courseId: string) => {
      recordSubs[courseId]?.unsub();
      delete recordSubs[courseId];
      setStudentRecords(prev => { const next = { ...prev }; delete next[courseId]; return next; });
    };

    Promise.all([
      getStudentCourses(user.userId),
      checkFaceEnrolled().catch(() => ({ enrolled: false })),
    ]).then(async ([courseData, faceStatus]) => {
      if (!isMounted) return;
      setCourses(courseData);
      setFaceEnrolled(faceStatus.enrolled);
      getStudentOverallAttendance(user.userId, courseData.map(c => c.courseId))
        .then(res => { if (isMounted) setOverall(res); })
        .catch(() => { if (isMounted) setOverall({ attended: 0, total: 0, percentage: null }); });

      await Promise.all(courseData.map(course => new Promise<void>(resolve => {
        let first = true;
        sessionUnsubs.push(subscribeToActiveSessionForCourse(course.courseId, (session) => {
          if (!isMounted) return;
          if (session) {
            setActiveSessions(prev => ({ ...prev, [course.courseId]: session }));
            if (recordSubs[course.courseId]?.sessionId !== session.sessionId) {
              dropRecord(course.courseId);
              recordSubs[course.courseId] = {
                sessionId: session.sessionId,
                unsub: subscribeToStudentSessionAttendance(session.sessionId, user.userId, (record) => {
                  if (!isMounted) return;
                  setStudentRecords(prev => {
                    const next = { ...prev };
                    if (record) next[course.courseId] = record; else delete next[course.courseId];
                    return next;
                  });
                }),
              };
            }
          } else {
            setActiveSessions(prev => { const next = { ...prev }; delete next[course.courseId]; return next; });
            dropRecord(course.courseId);
          }
          if (first) { first = false; resolve(); }
        }));
      })));

      if (isMounted) setIsLoading(false);
    }).catch((e) => {
      if (!isMounted) return;
      setLoadError(errorMessage(e, 'Could not load your courses.'));
      setIsLoading(false);
    });

    return () => {
      isMounted = false;
      sessionUnsubs.forEach(unsub => unsub());
      Object.values(recordSubs).forEach(s => s.unsub());
    };
  }, [user?.userId]);

  const today = new Date().toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' });

  return (
    <div className="bg-background min-h-dvh">
      <TopAppBar title="Home" />
      <main className="px-4 sm:px-5 pt-5 max-w-lg mx-auto pb-8 flex flex-col gap-6">
        <header className="animate-fade-up">
          <p className="text-xs font-semibold text-on-surface-variant">{today}</p>
          <h2 className="text-2xl font-bold text-on-surface mt-0.5">{getGreeting()}, {firstName}</h2>
        </header>

        {loadError && <ErrorBanner message={loadError} onDismiss={() => setLoadError('')} />}

        {!faceEnrolled && !isLoading && (
          <Card className="flex items-start gap-3 border-warning/30 bg-warning-container/40">
            <span className="w-10 h-10 rounded-xl bg-warning-container text-on-warning-container flex items-center justify-center shrink-0">
              <Icon name="face" filled className="text-[22px]" />
            </span>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-on-surface">Set up face verification</p>
              <p className="text-xs text-on-surface-variant mt-0.5">You need it to check in. It takes about 20 seconds.</p>
              <ButtonLink href="/student/enroll" size="sm" className="mt-3" iconRight="arrow_forward">Set up now</ButtonLink>
            </div>
          </Card>
        )}

        {/* Live sessions */}
        <section aria-label="Live classes" className="flex flex-col gap-3">
          {isLoading ? (
            <Skeleton className="h-52 w-full rounded-3xl" />
          ) : (() => {
            const live = courses.filter(c => activeSessions[c.courseId]);
            if (live.length === 0) {
              return (
                <Card className="flex items-center gap-4">
                  <span className="w-11 h-11 rounded-2xl bg-surface-container text-on-surface-variant flex items-center justify-center shrink-0">
                    <Icon name="event_available" className="text-[24px]" />
                  </span>
                  <div>
                    <p className="text-sm font-semibold text-on-surface">No class is taking attendance</p>
                    <p className="text-xs text-on-surface-variant mt-0.5">When a lecturer opens a session, it appears here.</p>
                  </div>
                </Card>
              );
            }
            return live.map(course => (
              <LiveSessionCard key={course.courseId} course={course}
                session={activeSessions[course.courseId]} record={studentRecords[course.courseId] ?? null} />
            ));
          })()}
        </section>

        {/* Attendance summary */}
        <section aria-label="Attendance summary" className="grid grid-cols-[1fr_auto] gap-3">
          <AttendanceSummary overall={overall} />
          <Card className="flex flex-col justify-between min-w-[104px]">
            <span className="w-9 h-9 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
              <Icon name="school" filled className="text-[20px]" />
            </span>
            <div className="mt-3">
              {isLoading ? <Skeleton className="h-7 w-8" /> : <p className="text-2xl font-bold tabular-nums">{courses.length}</p>}
              <p className="text-xs text-on-surface-variant">Courses</p>
            </div>
          </Card>
        </section>

        {/* Courses */}
        <section>
          <SectionHeader title="My courses"
            action={<ButtonLink href="/student/courses" variant="ghost" size="sm">View all</ButtonLink>} />
          {isLoading ? (
            <SkeletonCards count={3} className="h-20" />
          ) : courses.length === 0 ? (
            <Card padding="lg" className="text-center">
              <span className="mx-auto w-14 h-14 rounded-2xl bg-primary/10 text-primary flex items-center justify-center">
                <Icon name="school" filled className="text-[28px]" />
              </span>
              <p className="mt-4 font-semibold text-on-surface">No courses yet</p>
              <p className="text-sm text-on-surface-variant mt-1">Join a course with the code and key from your lecturer.</p>
              <ButtonLink href="/student/courses" className="mt-5" icon="add">Join a course</ButtonLink>
            </Card>
          ) : (
            <div className="flex flex-col gap-2.5">
              {[...courses]
                .sort((a, b) => Number(!!activeSessions[b.courseId]) - Number(!!activeSessions[a.courseId])
                  || (a.courseTitle || '').localeCompare(b.courseTitle || ''))
                .map(course => {
                  const session = activeSessions[course.courseId];
                  return (
                    <CardLink key={course.courseId} href={`/student/courses/${course.courseId}`} className="flex items-center gap-3">
                      <span className={`w-11 h-11 rounded-xl flex items-center justify-center text-[11px] font-extrabold shrink-0 ${session ? 'bg-primary text-on-primary' : 'bg-primary/10 text-primary'}`}>
                        {(course.courseCode || '?').replace(/\s+/g, '').slice(0, 3)}
                      </span>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-semibold text-on-surface truncate">{course.courseTitle}</p>
                          {session && (
                            <Ticker intervalMs={15000}>
                              {() => resolveSessionPhase(session) !== 'ended' ? <Badge tone="live">Live</Badge> : null}
                            </Ticker>
                          )}
                        </div>
                        <p className="text-xs text-on-surface-variant truncate">{course.courseCode} · {course.lecturerName}</p>
                      </div>
                      <Icon name="chevron_right" className="text-outline text-xl" />
                    </CardLink>
                  );
                })}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}

function AttendanceSummary({ overall }: { overall: { attended: number; total: number; percentage: number | null } | null }) {
  if (overall === null) {
    return <Skeleton className="h-full min-h-[120px] w-full rounded-2xl" />;
  }
  const pct = overall.percentage;
  const onTrack = pct !== null && pct >= ATTENDANCE_TARGET;
  return (
    <Card className="flex items-center gap-4">
      <ProgressRing value={(pct ?? 0) / 100} size={76} stroke={7} tone={pct === null ? 'primary' : onTrack ? 'success' : 'warning'}
        label={pct === null ? 'No sessions yet' : `Overall attendance ${pct}%`}>
        <span className="text-lg font-bold tabular-nums">{pct === null ? '—' : `${pct}%`}</span>
      </ProgressRing>
      <div className="min-w-0">
        <p className="text-sm font-semibold text-on-surface">Overall attendance</p>
        {pct === null ? (
          <p className="text-xs text-on-surface-variant mt-0.5">No sessions held yet.</p>
        ) : (
          <>
            <p className="text-xs text-on-surface-variant mt-0.5 tabular-nums">{overall.attended} of {overall.total} sessions</p>
            <Badge tone={onTrack ? 'success' : 'warning'} icon={onTrack ? 'trending_up' : 'warning'} className="mt-2">
              {onTrack ? 'On track' : `Below ${ATTENDANCE_TARGET}%`}
            </Badge>
          </>
        )}
      </div>
    </Card>
  );
}
