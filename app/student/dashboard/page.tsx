'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/store/auth.store';
import { getStudentCourses } from '@/lib/firebase/courses.service';
import { getActiveSessionWithSync, getStudentSessionAttendance } from '@/lib/firebase/sessions.service';
import { getPhaseInfo, formatCountdown } from '@/lib/utils/session.utils';
import { checkFaceEnrolled } from '@/lib/api/face.api';
import TopAppBar from '@/components/layout/TopAppBar';
import { Course, Session, AttendanceRecord } from '@/types';

function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}

export default function StudentDashboard() {
  const { user } = useAuthStore();
  const router = useRouter();
  const [courses, setCourses] = useState<Course[]>([]);
  const [activeSessions, setActiveSessions] = useState<Record<string, Session>>({});
  const [studentRecords, setStudentRecords] = useState<Record<string, AttendanceRecord>>({});
  const [faceEnrolled, setFaceEnrolled] = useState(true);
  const [isLoading, setIsLoading] = useState(true);
  const [tick, setTick] = useState(0);
  const firstName = user?.name || 'there';

  useEffect(() => {
    const timer = setInterval(() => setTick(t => t + 1), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!user?.userId) return;
    Promise.all([
      getStudentCourses(user.userId),
      checkFaceEnrolled(user.userId).catch(() => ({ enrolled: false })),
    ]).then(async ([courseData, faceStatus]) => {
      setCourses(courseData);
      setFaceEnrolled(faceStatus.enrolled);
      const sessionMap: Record<string, Session> = {};
      const recordMap: Record<string, AttendanceRecord> = {};
      await Promise.all(courseData.map(async (course) => {
        try {
          const session = await getActiveSessionWithSync(course.courseId);
          if (session) {
            sessionMap[course.courseId] = session;
            const record = await getStudentSessionAttendance(session.sessionId, user.userId);
            if (record) {
              recordMap[course.courseId] = record;
            }
          }
        } catch {
          // ignore
        }
      }));
      setActiveSessions(sessionMap);
      setStudentRecords(recordMap);
    }).catch(console.error)
      .finally(() => setIsLoading(false));
  }, [user?.userId]);

  const activeCourses = courses.filter(c => activeSessions[c.courseId] && activeSessions[c.courseId].status !== 'ended');

  function getButtonState(session: Session, record: AttendanceRecord | null): {
    text: string;
    icon: string;
    disabled: boolean;
    variant: 'active' | 'waiting' | 'completed' | 'ended';
  } {
    const info = getPhaseInfo(session);
    const countdown = formatCountdown(info.remaining);
    const hasP1 = record?.phase1Status === 'present';
    const hasP2 = record?.phase2Status === 'present';

    if (info.status === 'phase1_open') {
      if (!hasP1) {
        return { text: `Check In Now (${countdown})`, icon: 'how_to_reg', disabled: false, variant: 'active' };
      } else {
        return { text: `✓ Checked In · Phase 2 in ${countdown}`, icon: 'check_circle', disabled: true, variant: 'completed' };
      }
    }
    
    if (info.status === 'waiting') {
      if (!hasP1) {
        return { text: `Phase 1 closed · Phase 2 in ${countdown}`, icon: 'cancel', disabled: true, variant: 'ended' };
      }
      return { text: `Phase 2 opens in ${countdown}`, icon: 'hourglass_empty', disabled: true, variant: 'waiting' };
    }

    if (info.status === 'phase2_open') {
      if (hasP2) {
        return { text: '✓ Attendance Completed', icon: 'check_circle', disabled: true, variant: 'completed' };
      }
      if (!hasP1) {
        return { text: 'Session Ended', icon: 'block', disabled: true, variant: 'ended' };
      }
      return { text: `Check Out Now (${countdown})`, icon: 'logout', disabled: false, variant: 'active' };
    }

    return { text: 'Session Ended', icon: 'block', disabled: true, variant: 'ended' };
  }

  const renderSmartButton = (course: Course, isLarge: boolean) => {
    const session = activeSessions[course.courseId];
    if (!session) return null;
    const record = studentRecords[course.courseId] || null;
    const state = getButtonState(session, record);

    let className = isLarge
      ? "w-full h-11 rounded-full text-sm font-semibold flex items-center justify-center gap-2 transition-all disabled:opacity-100 "
      : "mt-3 w-full h-10 rounded-full text-xs font-semibold flex items-center justify-center gap-1 transition-all disabled:opacity-100 ";

    if (state.variant === 'active') {
      className += isLarge
        ? "bg-on-primary-container/20 border border-on-primary-container/30 text-on-primary-container active:scale-95 hover:bg-on-primary-container/30 "
        : "bg-primary-container text-on-primary-container active:scale-95 hover:brightness-95 ";
    } else if (state.variant === 'waiting') {
      className += isLarge
        ? "bg-on-primary-container/10 border border-on-primary-container/20 text-on-primary-container opacity-80 cursor-not-allowed "
        : "bg-surface-container-highest text-on-surface opacity-80 cursor-not-allowed ";
    } else if (state.variant === 'completed') {
      className += "bg-green-100 border border-green-300 text-green-800 dark:bg-green-900/40 dark:border-green-800 dark:text-green-300 ";
    } else if (state.variant === 'ended') {
      className += isLarge
        ? "bg-on-primary-container/10 border border-on-primary-container/20 text-on-primary-container/60 cursor-not-allowed "
        : "bg-surface-container-highest text-on-surface/60 cursor-not-allowed ";
    }

    return (
      <button
        disabled={state.disabled}
        onClick={() => router.push(`/student/verify?courseId=${course.courseId}`)}
        className={className}
      >
        <span className={`material-symbols-outlined ${isLarge ? 'text-lg' : 'text-base'}`} style={{fontVariationSettings:"'FILL' 1"}}>
          {state.icon}
        </span>
        <span className="truncate">{state.text}</span>
      </button>
    );
  };

  return (
    <div className="bg-background">
      <TopAppBar />
      <main className="px-5 pt-5 max-w-lg mx-auto pb-8 flex flex-col gap-5">

        {/* Greeting */}
        <div>
          <h2 className="text-2xl font-bold text-on-surface">{getGreeting()}, {firstName}</h2>
          <p className="text-sm text-on-surface-variant mt-1">Here is your verification summary for today.</p>
        </div>

        {/* Face enrollment warning */}
        {!faceEnrolled && (
          <div className="bg-error-container/30 border border-error/20 rounded-2xl p-4 flex items-start gap-3">
            <span className="material-symbols-outlined text-error mt-0.5 text-xl" style={{fontVariationSettings:"'FILL' 1"}}>warning</span>
            <div className="flex-1">
              <p className="text-sm font-semibold text-on-surface">Face verification not set up</p>
              <p className="text-xs text-on-surface-variant mt-0.5">You cannot mark attendance until you enroll your face.</p>
            </div>
            <a href="/student/enroll" className="text-xs font-bold text-primary whitespace-nowrap mt-0.5 shrink-0">Set up →</a>
          </div>
        )}

        {/* Live session alert */}
        {activeCourses.length > 0 && (
          <div className="bg-primary-container rounded-2xl p-4 relative overflow-hidden">
            <div className="absolute right-3 top-3 opacity-10">
              <span className="material-symbols-outlined text-[80px]" style={{fontVariationSettings:"'FILL' 1"}}>radar</span>
            </div>
            <div className="flex items-center gap-2 mb-3 relative z-10">
              <div className="w-2 h-2 bg-secondary-fixed rounded-full animate-pulse" />
              <span className="text-xs font-bold text-on-primary-container uppercase tracking-wider">Live Session</span>
            </div>
            {activeCourses.map(course => (
              <div key={course.courseId} className="relative z-10 mb-4 last:mb-0">
                <p className="text-lg font-bold text-on-primary-container">{course.courseTitle}</p>
                <p className="text-xs text-on-primary-container/70 mb-3">{course.courseCode}</p>
                {renderSmartButton(course, true)}
              </div>
            ))}
          </div>
        )}

        {/* Stats */}
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-surface-container-lowest rounded-2xl p-4 card-shadow border-l-4 border-primary">
            <span className="material-symbols-outlined text-outline text-xl mb-2 block">school</span>
            <p className="text-2xl font-bold text-on-surface">{courses.length}</p>
            <p className="text-xs text-on-surface-variant mt-0.5">Courses Enrolled</p>
          </div>
          <div className="bg-surface-container-lowest rounded-2xl p-4 card-shadow border-l-4 border-secondary-container">
            <span className="material-symbols-outlined text-outline text-xl mb-2 block">fact_check</span>
            <p className="text-2xl font-bold text-on-surface">0%</p>
            <p className="text-xs text-on-surface-variant mt-0.5">Overall Attendance</p>
          </div>
        </div>

        {/* Today's classes */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-base font-semibold text-on-surface">My Courses</h3>
            <a href="/student/courses" className="text-xs font-bold text-primary uppercase tracking-wider">View All</a>
          </div>
          {isLoading ? (
            <div className="flex justify-center py-8">
              <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
            </div>
          ) : courses.length === 0 ? (
            <div className="bg-surface-container-lowest rounded-2xl p-8 card-shadow text-center">
              <span className="material-symbols-outlined text-outline text-4xl mb-2 block">school</span>
              <p className="text-sm text-on-surface-variant">No courses enrolled yet</p>
              <a href="/student/courses" className="text-sm text-primary font-semibold mt-2 inline-block">Join a course →</a>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {courses.map(course => {
                const isActive = activeSessions[course.courseId] && activeSessions[course.courseId].status !== 'ended';
                return (
                  <div key={course.courseId}
                    className={`bg-surface-container-lowest rounded-2xl p-4 card-shadow border border-outline-variant/20 relative overflow-hidden ${isActive ? 'border-primary/30' : ''}`}>
                    <div className={`absolute left-0 top-0 bottom-0 w-1.5 ${isActive ? 'bg-primary' : 'bg-outline-variant'}`} />
                    <div className="pl-4">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <span className="text-xs font-bold text-primary bg-primary/10 px-2 py-0.5 rounded-full">{course.courseCode}</span>
                        {isActive && (
                          <span className="text-xs font-bold text-on-primary bg-primary px-2 py-0.5 rounded-full flex items-center gap-1">
                            <span className="w-1.5 h-1.5 bg-secondary-fixed rounded-full animate-pulse inline-block" />
                            Live
                          </span>
                        )}
                      </div>
                      <p className="text-sm font-semibold text-on-surface">{course.courseTitle}</p>
                      <p className="text-xs text-on-surface-variant mt-0.5">{course.lecturerName}</p>
                      {isActive && renderSmartButton(course, false)}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
