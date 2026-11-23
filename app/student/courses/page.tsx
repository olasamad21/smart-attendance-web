'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/store/auth.store';
import { getStudentCourses, enrollStudent, getCourseByCodeAndKey } from '@/lib/firebase/courses.service';
import { subscribeToActiveSessionForCourse, subscribeToStudentSessionAttendance } from '@/lib/firebase/sessions.service';
import { getPhaseInfo, formatCountdown } from '@/lib/utils/session.utils';
import Ticker from '@/components/ui/Ticker';
import TopAppBar from '@/components/layout/TopAppBar';
import { Course, Session, AttendanceRecord } from '@/types';
import EmptyState from '@/components/ui/EmptyState';
import ErrorBanner, { errorMessage } from '@/components/ui/ErrorBanner';
import { SkeletonCards } from '@/components/ui/Skeleton';
import { useToast } from '@/components/ui/Toast';

export default function StudentCoursesPage() {
  const router = useRouter();
  const { user } = useAuthStore();
  const toast = useToast();
  const [tab, setTab] = useState<'my' | 'join'>('my');
  const [courses, setCourses] = useState<Course[]>([]);
  const [activeSessions, setActiveSessions] = useState<Record<string, Session | null>>({});
  const [studentRecords, setStudentRecords] = useState<Record<string, AttendanceRecord | null>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [code, setCode] = useState('');
  const [enrollmentKey, setEnrollmentKey] = useState('');
  const [joining, setJoining] = useState(false);
  const [joinMsg, setJoinMsg] = useState<{type: 'success'|'error', text: string} | null>(null);

  const [reloadTrigger, setReloadTrigger] = useState(0);

  useEffect(() => {
    if (!user?.userId) return;
    let isMounted = true;
    const sessionUnsubs: (() => void)[] = [];
    const recordUnsubs: Record<string, () => void> = {};

    setIsLoading(true);

    getStudentCourses(user.userId).then(async (fetchedCourses) => {
      if (!isMounted) return;
      setCourses(fetchedCourses);

      if (fetchedCourses.length === 0) {
        setIsLoading(false);
        return;
      }

      await Promise.all(fetchedCourses.map(course => new Promise<void>(resolve => {
        let sessionInitialized = false;

        const sessionUnsub = subscribeToActiveSessionForCourse(course.courseId, (session) => {
          if (!isMounted) return;

          if (session) {
            setActiveSessions(prev => ({ ...prev, [course.courseId]: session }));
            
            if (!recordUnsubs[course.courseId]) {
              recordUnsubs[course.courseId] = subscribeToStudentSessionAttendance(session.sessionId, user.userId, (record) => {
                if (!isMounted) return;
                setStudentRecords(prev => {
                  if (record) {
                    return { ...prev, [course.courseId]: record };
                  } else {
                    const next = { ...prev };
                    delete next[course.courseId];
                    return next;
                  }
                });
              });
            }
          } else {
            setActiveSessions(prev => {
              const next = { ...prev };
              delete next[course.courseId];
              return next;
            });
            setStudentRecords(prev => {
              const next = { ...prev };
              delete next[course.courseId];
              return next;
            });
            if (recordUnsubs[course.courseId]) {
              recordUnsubs[course.courseId]();
              delete recordUnsubs[course.courseId];
            }
          }

          if (!sessionInitialized) {
            sessionInitialized = true;
            resolve();
          }
        });
        sessionUnsubs.push(sessionUnsub);
      })));

      if (isMounted) setIsLoading(false);
    }).catch(e => {
      if (isMounted) setLoadError(errorMessage(e, 'Could not load your courses.'));
      if (isMounted) setIsLoading(false);
    });

    return () => {
      isMounted = false;
      sessionUnsubs.forEach(unsub => unsub());
      Object.values(recordUnsubs).forEach(unsub => unsub());
    };
  }, [user?.userId, reloadTrigger]);

  const load = () => setReloadTrigger(t => t + 1);

  const handleJoin = async () => {
    if (!code || !enrollmentKey) { setJoinMsg({type: 'error', text: 'Enter both Course Code and Password'}); return; }
    if (!user) return;
    setJoining(true); setJoinMsg(null);
    try {
      const course = await getCourseByCodeAndKey(code, enrollmentKey);
      if (!course) { setJoinMsg({type: 'error', text: 'Course not found. Check the code and password and try again.'}); return; }
      await enrollStudent(course.courseId, user.userId);
      toast.success(`Joined ${course.courseCode} — ${course.courseTitle}`);
      setCode('');
      setEnrollmentKey('');
      load();
      setTab('my');
    } catch (e: any) {
      setJoinMsg({type: 'error', text: e.message || 'Failed to join course'});
    } finally { setJoining(false); }
  };

  return (
    <div className="bg-background">
      <TopAppBar title="Courses" />
      <main className="px-4 sm:px-6 pt-6 max-w-lg md:max-w-5xl mx-auto pb-8">
        {loadError && <div className="mb-4"><ErrorBanner message={loadError} onDismiss={() => setLoadError('')} /></div>}

        {/* Segmented control */}
        <div className="flex gap-1 bg-surface-container-high p-1 rounded-xl mb-6 md:max-w-md">
          {(['my', 'join'] as const).map(t => (
            <button key={t} onClick={() => setTab(t)}
              className={`flex-1 h-10 rounded-lg text-sm font-semibold transition-all active:scale-95 ${tab === t ? 'bg-surface-container-lowest text-on-surface shadow-sm' : 'text-on-surface-variant'}`}>
              {t === 'my' ? `My Courses (${courses.length})` : 'Join a Course'}
            </button>
          ))}
        </div>

        {tab === 'my' ? (
          isLoading ? (
            <SkeletonCards count={3} className="h-28" />
          ) : courses.length === 0 ? (
            <EmptyState
              icon="school"
              title="No courses enrolled yet"
              description="Join a course using the enrollment code from your lecturer."
              action={
                <button onClick={() => setTab('join')}
                  className="bg-primary-container text-on-primary-container text-sm font-bold px-6 h-12 rounded-full active:scale-95 transition-all">
                  Join a Course
                </button>
              }
            />
          ) : (
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-3">
              {courses.map(course => {
                const session = activeSessions[course.courseId];
                const record = studentRecords[course.courseId];
                
                // Re-evaluated every second inside <Ticker>, so only this button re-renders.
                const renderButton = () => {
                let buttonState = null;
                if (session) {
                  const phaseInfo = getPhaseInfo(session);
                  const isPhase1Done = record?.phase1Status === 'present';
                  const isPhase2Done = record?.phase2Status === 'present';

                  if (phaseInfo.status === 'phase1_open' && !isPhase1Done) {
                    buttonState = (
                      <button
                        onClick={() => router.push(`/student/verify?courseId=${course.courseId}`)}
                        className="mt-3 w-full h-10 bg-primary-container text-on-primary-container rounded-full text-xs font-semibold active:scale-95 flex items-center justify-center gap-1"
                      >
                        <span className="material-symbols-outlined text-base">how_to_reg</span>
                        Sign In · {formatCountdown(phaseInfo.remaining)}
                      </button>
                    );
                  } else if (phaseInfo.status === 'phase1_open' && isPhase1Done) {
                    buttonState = (
                      <button disabled className="mt-3 w-full h-10 bg-on-primary-container/10 border border-on-primary-container/20 text-on-primary-container disabled:opacity-80 rounded-full text-xs font-semibold flex items-center justify-center gap-1">
                        <span className="material-symbols-outlined text-base">hourglass_empty</span>
                        Signed In · Sign Out opens in {formatCountdown(phaseInfo.timeUntilPhase2 || 0)}
                      </button>
                    );
                  } else if (phaseInfo.status === 'waiting') {
                    buttonState = (
                      <button disabled className="mt-3 w-full h-10 bg-on-primary-container/10 border border-on-primary-container/20 text-on-primary-container disabled:opacity-80 rounded-full text-xs font-semibold flex items-center justify-center gap-1">
                        <span className="material-symbols-outlined text-base">hourglass_empty</span>
                        Waiting for Sign Out · {formatCountdown(phaseInfo.remaining)}
                      </button>
                    );
                  } else if (phaseInfo.status === 'phase2_open' && !isPhase2Done) {
                    buttonState = (
                      <button
                        onClick={() => router.push(`/student/verify?courseId=${course.courseId}`)}
                        className="mt-3 w-full h-10 bg-primary-container text-on-primary-container rounded-full text-xs font-semibold active:scale-95 flex items-center justify-center gap-1 hover:brightness-95"
                      >
                        <span className="material-symbols-outlined text-base">logout</span>
                        Sign Out · {formatCountdown(phaseInfo.remaining)}
                      </button>
                    );
                  } else if ((phaseInfo.status === 'phase2_open' && isPhase2Done) || (phaseInfo.status === 'ended' && (isPhase1Done || isPhase2Done))) {
                    buttonState = (
                      <button disabled className="mt-3 w-full h-10 bg-success-container text-on-success-container disabled:opacity-100 rounded-full text-xs font-semibold flex items-center justify-center gap-1">
                        <span className="material-symbols-outlined text-base">task_alt</span>
                        Attendance Completed
                      </button>
                    );
                  } else if (phaseInfo.status === 'ended') {
                    buttonState = (
                      <button disabled className="mt-3 w-full h-10 bg-surface-container text-on-surface-variant rounded-full text-xs font-semibold flex items-center justify-center gap-1 opacity-80">
                        <span className="material-symbols-outlined text-base">do_not_disturb_on</span>
                        Session Ended
                      </button>
                    );
                  }
                }
                return buttonState;
                };

                return (
                <div key={course.courseId} className="bg-surface-container-lowest rounded-2xl p-4 shadow-card border border-outline-variant/30 relative overflow-hidden">
                  <div className={`absolute left-0 top-0 bottom-0 w-1.5 ${session ? 'bg-primary' : 'bg-secondary-container'}`} />
                  <div className="pl-4">
                    <div className="flex items-center gap-2 flex-wrap w-full">
                      <span className="text-xs font-bold text-primary bg-primary/10 px-2 py-0.5 rounded-full">{course.courseCode}</span>
                      {session && (
                        <span className="text-xs font-bold text-on-primary bg-primary px-2 py-0.5 rounded-full flex items-center gap-1">
                          <span className="w-1.5 h-1.5 bg-secondary-fixed rounded-full animate-pulse inline-block" />
                          Live
                        </span>
                      )}
                      <a href={`/student/courses/${course.courseId}`} className="ml-auto text-xs font-bold text-primary active:scale-95 transition-all">
                        History
                      </a>
                    </div>
                    <h3 className="text-base font-semibold text-on-surface mt-1">{course.courseTitle}</h3>
                    <p className="text-xs text-on-surface-variant mt-0.5">{course.lecturerName}</p>
                    {session && <Ticker>{renderButton}</Ticker>}
                  </div>
                </div>
                );
              })}
            </div>
          )
        ) : (
          <div className="bg-surface-container-lowest rounded-2xl p-6 shadow-card border border-outline-variant/30 max-w-md mx-auto">
            <div className="w-14 h-14 bg-primary/10 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <span className="material-symbols-outlined text-primary text-3xl">search</span>
            </div>
            <h2 className="text-lg font-semibold text-on-surface text-center mb-1">Join a Course</h2>
            <p className="text-sm text-on-surface-variant text-center mb-6">Enter the course code and password from your lecturer</p>

            {joinMsg && (
              <div className={`mb-4 p-3 rounded-lg text-sm ${joinMsg.type === 'success' ? 'bg-success-container text-on-success-container' : 'bg-error-container text-on-error-container'}`}>
                {joinMsg.text}
              </div>
            )}

            <div className="flex flex-col gap-3 mb-4">
              <input value={code} onChange={e => setCode(e.target.value.toUpperCase())}
                placeholder="Course Code (e.g. CSC411)"
                className="field-input text-center font-bold"
              />
              <input value={enrollmentKey} onChange={e => setEnrollmentKey(e.target.value.toUpperCase().slice(0,8))}
                placeholder="Password (e.g. X7B9K2M4)"
                className="field-input text-center font-mono tracking-widest"
              />
            </div>
            <button onClick={handleJoin} disabled={joining || !code || enrollmentKey.length !== 8}
              className="w-full h-12 bg-primary-container text-on-primary-container rounded-full text-sm font-semibold disabled:opacity-60 active:scale-95 transition-all flex items-center justify-center gap-2">
              {joining ? <><div className="w-4 h-4 border-2 border-on-primary-container border-t-transparent rounded-full animate-spin" />Joining...</> : 'Join Course'}
            </button>
          </div>
        )}
      </main>
    </div>
  );
}
