'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useAuthStore } from '@/store/auth.store';
import { getLecturerCourses, getEnrollmentStats } from '@/lib/firebase/courses.service';
import { subscribeToActiveSessionForCourse } from '@/lib/firebase/sessions.service';
import { subscribeToSessionAttendance } from '@/lib/firebase/attendance.service';
import { getPhaseInfo, formatCountdown } from '@/lib/utils/session.utils';
import TopAppBar from '@/components/layout/TopAppBar';
import ErrorBanner, { errorMessage } from '@/components/ui/ErrorBanner';
import Card, { SectionHeader } from '@/components/ui/Card';
import { ButtonLink } from '@/components/ui/Button';
import Badge from '@/components/ui/Badge';
import Icon from '@/components/ui/Icon';
import ProgressRing from '@/components/ui/ProgressRing';
import StatTile from '@/components/ui/StatTile';
import Skeleton, { SkeletonCards } from '@/components/ui/Skeleton';
import Ticker from '@/components/ui/Ticker';
import { Course, Session, AttendanceRecord } from '@/types';
import { getGreeting, greetingName } from '@/lib/utils/date.utils';


export default function LecturerDashboard() {
  const { user } = useAuthStore();
  const [courses, setCourses] = useState<Course[]>([]);
  const [activeSessions, setActiveSessions] = useState<Record<string, Session | null>>({});
  const [enrollment, setEnrollment] = useState<{ uniqueStudents: number; perCourse: Record<string, number> } | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState('');

  useEffect(() => {
    if (!user?.userId) return;
    let isMounted = true;
    const sessionUnsubs: (() => void)[] = [];

    getLecturerCourses(user.userId)
      .then(courseData => {
        if (!isMounted) return;
        setCourses(courseData);
        getEnrollmentStats(courseData.map(c => c.courseId))
          .then(stats => { if (isMounted) setEnrollment(stats); })
          .catch(() => { if (isMounted) setEnrollment({ uniqueStudents: 0, perCourse: {} }); });
        courseData.forEach(course => {
          sessionUnsubs.push(subscribeToActiveSessionForCourse(course.courseId, session => {
            if (isMounted) setActiveSessions(prev => ({ ...prev, [course.courseId]: session }));
          }));
        });
      })
      .catch(e => { if (isMounted) setLoadError(errorMessage(e, 'Could not load your courses.')); })
      .finally(() => { if (isMounted) setIsLoading(false); });

    return () => {
      isMounted = false;
      sessionUnsubs.forEach(unsub => unsub());
    };
  }, [user?.userId]);

  const firstName = greetingName(user?.name);
  const live = Object.values(activeSessions).filter((s): s is Session => !!s && s.status !== 'ended');
  const today = new Date().toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' });

  return (
    <div className="bg-background min-h-dvh">
      <TopAppBar title="Home" />
      <main className="px-4 sm:px-6 pt-5 pb-10 max-w-5xl mx-auto flex flex-col gap-6">
        <header className="flex flex-wrap items-end justify-between gap-3 animate-fade-up">
          <div>
            <p className="text-xs font-semibold text-on-surface-variant">{today}</p>
            <h2 className="text-2xl font-bold text-on-surface mt-0.5">{getGreeting()}, {firstName}</h2>
          </div>
          <ButtonLink href="/lecturer/courses" variant="tonal" size="sm" icon="add">New course</ButtonLink>
        </header>

        {loadError && <ErrorBanner message={loadError} onDismiss={() => setLoadError('')} />}

        <div className="grid lg:grid-cols-[1.4fr_1fr] gap-4">
          {/* Live session hero */}
          <section aria-label="Live session">
            {isLoading ? (
              <Skeleton className="h-56 w-full rounded-3xl" />
            ) : live.length > 0 ? (
              <div className="flex flex-col gap-3">
                {live.map(s => (
                  <LiveSessionHero key={s.sessionId} session={s} enrolled={enrollment?.perCourse[s.courseId]} />
                ))}
              </div>
            ) : (
              <Card padding="lg" className="h-full flex flex-col justify-center">
                <span className="w-12 h-12 rounded-2xl bg-surface-container text-on-surface-variant flex items-center justify-center">
                  <Icon name="sensors_off" className="text-[26px]" />
                </span>
                <p className="mt-4 text-lg font-bold text-on-surface">No session running</p>
                <p className="text-sm text-on-surface-variant mt-1">Start an attendance session from one of your courses when class begins.</p>
              </Card>
            )}
          </section>

          {/* Stats */}
          <section aria-label="Overview" className="grid grid-cols-2 gap-3 content-start">
            <StatTile icon="menu_book" label="Courses" value={isLoading ? '…' : courses.length} />
            <StatTile icon="groups" label="Students" tone="success"
              value={enrollment === null ? '…' : enrollment.uniqueStudents}
              hint={enrollment && courses.length > 1 ? 'across all courses' : undefined} />
            <StatTile icon="sensors" label="Live now" tone={live.length ? 'warning' : 'neutral'} value={isLoading ? '…' : live.length} className="col-span-2 sm:col-span-1 lg:col-span-2" />
          </section>
        </div>

        {/* Courses */}
        <section>
          <SectionHeader title="Your courses"
            action={<ButtonLink href="/lecturer/courses" variant="ghost" size="sm">View all</ButtonLink>} />
          {isLoading ? (
            <SkeletonCards count={3} className="h-20" />
          ) : courses.length === 0 ? (
            <Card padding="lg" className="text-center">
              <span className="mx-auto w-14 h-14 rounded-2xl bg-primary/10 text-primary flex items-center justify-center">
                <Icon name="school" filled className="text-[28px]" />
              </span>
              <p className="mt-4 font-semibold text-on-surface">No courses yet</p>
              <p className="text-sm text-on-surface-variant mt-1">Create a course, share its code and key with students, then start a session.</p>
              <ButtonLink href="/lecturer/courses" className="mt-5" icon="add">Create a course</ButtonLink>
            </Card>
          ) : (
            <div className="grid sm:grid-cols-2 gap-3">
              {courses.map(course => {
                const session = activeSessions[course.courseId];
                const count = enrollment?.perCourse[course.courseId];
                return (
                  <Card key={course.courseId} className="flex items-center gap-3">
                    <Link href={`/lecturer/courses/${course.courseId}`} className="flex items-center gap-3 flex-1 min-w-0 group">
                      <span className={`w-11 h-11 rounded-xl flex items-center justify-center text-[11px] font-extrabold shrink-0 ${session ? 'bg-primary text-on-primary' : 'bg-primary/10 text-primary'}`}>
                        {(course.courseCode || '?').replace(/\s+/g, '').slice(0, 3)}
                      </span>
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-on-surface truncate group-hover:text-primary">{course.courseTitle}</p>
                        <p className="text-xs text-on-surface-variant truncate">
                          {course.courseCode}{count !== undefined ? ` · ${count} student${count === 1 ? '' : 's'}` : ''}
                        </p>
                      </div>
                    </Link>
                    {session ? (
                      <ButtonLink href={`/lecturer/sessions/${session.sessionId}`} size="sm" variant="danger" icon="sensors">Live</ButtonLink>
                    ) : (
                      <ButtonLink href={`/lecturer/sessions/start?courseId=${course.courseId}`} size="sm" variant="tonal" icon="play_arrow">Start</ButtonLink>
                    )}
                  </Card>
                );
              })}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}

/** Live session summary with countdown and check-in progress; links to the full live view. */
function LiveSessionHero({ session, enrolled }: { session: Session; enrolled?: number }) {
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  useEffect(() => subscribeToSessionAttendance(session.sessionId, setRecords), [session.sessionId]);
  const present = records.filter(r => r.phase1Score > 0 || r.phase2Score > 0).length;

  return (
    <Link href={`/lecturer/sessions/${session.sessionId}`}
      className="block rounded-3xl bg-primary-container text-on-primary-container p-5 shadow-raised transition-transform hover:-translate-y-0.5 active:scale-[0.99] animate-fade-up">
      <div className="flex items-center justify-between gap-2">
        <Badge tone="live">Live</Badge>
        <span className="text-xs font-medium opacity-80 flex items-center gap-1">
          <Icon name="location_on" className="text-[14px]" />{session.classroomName}
        </span>
      </div>
      <div className="mt-4 flex items-center gap-5">
        <ProgressRing value={enrolled ? present / enrolled : 0} size={96} stroke={8} tone="onPrimary"
          label={`${present} of ${enrolled ?? '?'} students present`}>
          <span className="text-2xl font-extrabold tabular-nums leading-none">{present}</span>
          <span className="text-[10px] opacity-75 mt-1">of {enrolled ?? '—'}</span>
        </ProgressRing>
        <div className="min-w-0">
          <p className="text-xs font-bold opacity-80">{session.courseCode}</p>
          <p className="text-lg font-bold leading-tight truncate">{session.courseTitle}</p>
          <Ticker>
            {() => {
              const info = getPhaseInfo(session);
              return (
                <p className="text-sm opacity-85 mt-1 tabular-nums">
                  {info.label} · {formatCountdown(info.remaining)}
                </p>
              );
            }}
          </Ticker>
        </div>
      </div>
      <div className="mt-5 h-11 rounded-full bg-on-primary-container text-primary-container text-sm font-bold flex items-center justify-center gap-2">
        Open live view <Icon name="arrow_forward" className="text-lg" />
      </div>
    </Link>
  );
}
