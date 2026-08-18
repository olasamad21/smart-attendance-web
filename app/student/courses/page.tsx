'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/store/auth.store';
import { getStudentCourses, enrollStudent, getCourseByCodeAndKey } from '@/lib/firebase/courses.service';
import { getActiveSessionWithSync, getStudentSessionAttendance } from '@/lib/firebase/sessions.service';
import { getPhaseInfo, formatCountdown } from '@/lib/utils/session.utils';
import TopAppBar from '@/components/layout/TopAppBar';
import { Course, Session, AttendanceRecord } from '@/types';

export default function StudentCoursesPage() {
  const router = useRouter();
  const { user } = useAuthStore();
  const [tab, setTab] = useState<'my' | 'join'>('my');
  const [courses, setCourses] = useState<Course[]>([]);
  const [activeSessions, setActiveSessions] = useState<Record<string, Session | null>>({});
  const [studentRecords, setStudentRecords] = useState<Record<string, AttendanceRecord | null>>({});
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => setTick(t => t + 1), 1000);
    return () => clearInterval(interval);
  }, []);
  const [isLoading, setIsLoading] = useState(true);
  const [code, setCode] = useState('');
  const [enrollmentKey, setEnrollmentKey] = useState('');
  const [joining, setJoining] = useState(false);
  const [joinMsg, setJoinMsg] = useState<{type: 'success'|'error', text: string} | null>(null);

  const load = async () => {
    if (!user?.userId) return;
    setIsLoading(true);
    try {
      const fetchedCourses = await getStudentCourses(user.userId);
      setCourses(fetchedCourses);
      
      const sessionMap: Record<string, Session | null> = {};
      const recordMap: Record<string, AttendanceRecord | null> = {};
      
      await Promise.all(
        fetchedCourses.map(async (course) => {
          try {
            const session = await getActiveSessionWithSync(course.courseId);
            sessionMap[course.courseId] = session;
            
            if (session) {
              const record = await getStudentSessionAttendance(session.sessionId, user.userId);
              recordMap[course.courseId] = record;
            }
          } catch {
            sessionMap[course.courseId] = null;
          }
        })
      );
      setActiveSessions(sessionMap);
      setStudentRecords(recordMap);
    }
    catch (e) { console.error(e); }
    finally { setIsLoading(false); }
  };

  useEffect(() => { load(); }, [user?.userId]);

  const handleJoin = async () => {
    if (!code || !enrollmentKey) { setJoinMsg({type: 'error', text: 'Enter both Course Code and Password'}); return; }
    if (!user) return;
    setJoining(true); setJoinMsg(null);
    try {
      const course = await getCourseByCodeAndKey(code, enrollmentKey);
      if (!course) { setJoinMsg({type: 'error', text: 'Course not found. Check the code and password and try again.'}); return; }
      await enrollStudent(course.courseId, user.userId);
      setJoinMsg({type: 'success', text: `Joined "${course.courseTitle}" successfully!`});
      setCode('');
      setEnrollmentKey('');
      await load();
      setTimeout(() => setTab('my'), 1500);
    } catch (e: any) {
      setJoinMsg({type: 'error', text: e.message || 'Failed to join course'});
    } finally { setJoining(false); }
  };

  return (
    <div className="bg-background">
      <TopAppBar title="Courses" />
      <main className="px-5 pt-6 max-w-lg mx-auto pb-8">

        {/* Segmented control */}
        <div className="flex gap-1 bg-surface-container-high p-1 rounded-xl mb-6">
          {(['my', 'join'] as const).map(t => (
            <button key={t} onClick={() => setTab(t)}
              className={`flex-1 h-10 rounded-lg text-sm font-semibold transition-all active:scale-95 ${tab === t ? 'bg-surface-container-lowest text-on-surface shadow-sm' : 'text-on-surface-variant'}`}>
              {t === 'my' ? `My Courses (${courses.length})` : 'Join a Course'}
            </button>
          ))}
        </div>

        {tab === 'my' ? (
          isLoading ? (
            <div className="flex justify-center py-16"><div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" /></div>
          ) : courses.length === 0 ? (
            <div className="bg-surface-container-lowest rounded-2xl p-12 text-center card-shadow">
              <span className="material-symbols-outlined text-outline text-5xl mb-3 block">school</span>
              <p className="text-base font-semibold text-on-surface">No courses enrolled yet</p>
              <p className="text-sm text-on-surface-variant mt-1 mb-4">Join a course using the code from your lecturer</p>
              <button onClick={() => setTab('join')}
                className="bg-primary-container text-on-primary-container text-sm font-semibold px-6 h-10 rounded-full active:scale-95 transition-all">
                Join a Course
              </button>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {courses.map(course => {
                const session = activeSessions[course.courseId];
                const record = studentRecords[course.courseId];
                
                let buttonState = null;
                if (session) {
                  const dummy = tick; // trigger re-render on tick
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
                        Check In (Phase 1) · {formatCountdown(phaseInfo.remaining)}
                      </button>
                    );
                  } else if (phaseInfo.status === 'phase1_open' && isPhase1Done) {
                    buttonState = (
                      <button disabled className="mt-3 w-full h-10 bg-green-100 border border-green-300 text-green-800 disabled:opacity-100 dark:bg-green-900/40 dark:border-green-800 dark:text-green-300 rounded-full text-xs font-semibold flex items-center justify-center gap-1">
                        <span className="material-symbols-outlined text-base">check_circle</span>
                        Checked In · Phase 2 in {formatCountdown(phaseInfo.remaining)}
                      </button>
                    );
                  } else if (phaseInfo.status === 'waiting') {
                    buttonState = (
                      <button disabled className="mt-3 w-full h-10 bg-on-primary-container/10 border border-on-primary-container/20 text-on-primary-container disabled:opacity-80 rounded-full text-xs font-semibold flex items-center justify-center gap-1">
                        <span className="material-symbols-outlined text-base">hourglass_empty</span>
                        Waiting for Phase 2 · {formatCountdown(phaseInfo.remaining)}
                      </button>
                    );
                  } else if (phaseInfo.status === 'phase2_open' && !isPhase2Done) {
                    buttonState = (
                      <button
                        onClick={() => router.push(`/student/verify?courseId=${course.courseId}`)}
                        className="mt-3 w-full h-10 bg-primary-container text-on-primary-container rounded-full text-xs font-semibold active:scale-95 flex items-center justify-center gap-1 hover:brightness-95"
                      >
                        <span className="material-symbols-outlined text-base">logout</span>
                        Check Out (Phase 2) · {formatCountdown(phaseInfo.remaining)}
                      </button>
                    );
                  } else if ((phaseInfo.status === 'phase2_open' && isPhase2Done) || (phaseInfo.status === 'ended' && (isPhase1Done || isPhase2Done))) {
                    buttonState = (
                      <button disabled className="mt-3 w-full h-10 bg-green-100 border border-green-300 text-green-800 disabled:opacity-100 dark:bg-green-900/40 dark:border-green-800 dark:text-green-300 rounded-full text-xs font-semibold flex items-center justify-center gap-1">
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

                return (
                <div key={course.courseId} className="bg-surface-container-lowest rounded-2xl p-4 card-shadow border border-outline-variant/20 relative overflow-hidden">
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
                    {buttonState}
                  </div>
                </div>
                );
              })}
            </div>
          )
        ) : (
          <div className="bg-surface-container-lowest rounded-2xl p-6 card-shadow">
            <div className="w-14 h-14 bg-primary/10 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <span className="material-symbols-outlined text-primary text-3xl">search</span>
            </div>
            <h2 className="text-lg font-semibold text-on-surface text-center mb-1">Join a Course</h2>
            <p className="text-sm text-on-surface-variant text-center mb-6">Enter the course code and password from your lecturer</p>

            {joinMsg && (
              <div className={`mb-4 p-3 rounded-lg text-sm ${joinMsg.type === 'success' ? 'bg-secondary-container/30 text-on-secondary-container' : 'bg-error-container text-on-error-container'}`}>
                {joinMsg.text}
              </div>
            )}

            <div className="flex flex-col gap-3 mb-4">
              <input value={code} onChange={e => setCode(e.target.value.toUpperCase())}
                placeholder="Course Code (e.g. CSC411)"
                className="w-full h-12 px-4 bg-surface-container-low border border-outline-variant rounded-lg text-center font-bold text-on-surface focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary"
              />
              <input value={enrollmentKey} onChange={e => setEnrollmentKey(e.target.value.toUpperCase().slice(0,8))}
                placeholder="Password (e.g. X7B9K2M4)"
                className="w-full h-12 px-4 bg-surface-container-low border border-outline-variant rounded-lg text-center font-mono tracking-widest text-on-surface focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary"
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
