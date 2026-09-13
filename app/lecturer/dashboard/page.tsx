'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useAuthStore } from '@/store/auth.store';
import { getLecturerCourses } from '@/lib/firebase/courses.service';
import { subscribeToActiveSessionForCourse } from '@/lib/firebase/sessions.service';
import TopAppBar from '@/components/layout/TopAppBar';
import { Course, Session } from '@/types';
import EmptyState from '@/components/ui/EmptyState';

function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}

export default function LecturerDashboard() {
  const { user } = useAuthStore();
  const [courses, setCourses] = useState<Course[]>([]);
  const [activeSessions, setActiveSessions] = useState<Record<string, Session | null>>({});
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!user?.userId) return;
    let isMounted = true;
    const sessionUnsubs: (() => void)[] = [];

    getLecturerCourses(user.userId)
      .then(async (courseData) => {
        if (!isMounted) return;
        setCourses(courseData);

        // Set up real-time listener for each course
        courseData.forEach(course => {
          const unsub = subscribeToActiveSessionForCourse(course.courseId, (session) => {
            if (!isMounted) return;
            setActiveSessions(prev => ({ ...prev, [course.courseId]: session }));
          });
          sessionUnsubs.push(unsub);
        });
      })
      .catch(console.error)
      .finally(() => setIsLoading(false));

    return () => {
      isMounted = false;
      sessionUnsubs.forEach(unsub => unsub());
    };
  }, [user?.userId]);

  const firstName = user?.name || 'there';
  
  // Pick the first non-ended session
  const activeSession = Object.values(activeSessions).find(s => s && s.status !== 'ended');

  return (
    <div className="bg-background">
      <TopAppBar title="Dashboard" />
      <main className="px-5 pt-5 max-w-lg mx-auto flex flex-col gap-5 pb-8">

        {/* Greeting */}
        <section>
          <h2 className="text-2xl font-bold text-on-surface">{getGreeting()}, {firstName}</h2>
        </section>

        {/* Bento Stats Grid */}
        <section className="grid grid-cols-2 gap-3">
          {/* Active session card spans full width */}
          {activeSession ? (
            <Link href={`/lecturer/sessions/${activeSession.sessionId}`} className="col-span-2 bg-primary-container rounded-2xl p-4 card-shadow flex flex-col justify-between relative overflow-hidden min-h-[100px] active:scale-[0.98] transition-all block cursor-pointer">
              <div className="absolute right-3 top-3 opacity-10 pointer-events-none">
                <span className="material-symbols-outlined text-[80px]" style={{fontVariationSettings: "'FILL' 1"}}>radar</span>
              </div>
              <div className="flex items-start justify-between relative z-10">
                <div>
                  <span className="text-xs font-bold text-on-primary-container opacity-80 uppercase tracking-wider">Active Session</span>
                  <p className="text-lg font-bold text-on-primary-container mt-1">
                    {activeSession.courseCode} Live
                  </p>
                </div>
                <div className="bg-primary text-on-primary px-3 py-1 rounded-full flex items-center gap-1.5 shadow-sm">
                  <span className="w-2 h-2 bg-secondary-fixed rounded-full animate-pulse inline-block" />
                  <span className="text-xs font-bold">Live</span>
                </div>
              </div>
            </Link>
          ) : (
            <div className="col-span-2 bg-primary-container rounded-2xl p-4 card-shadow flex flex-col justify-between relative overflow-hidden min-h-[100px]">
              <div className="absolute right-3 top-3 opacity-10 pointer-events-none">
                <span className="material-symbols-outlined text-[80px]" style={{fontVariationSettings: "'FILL' 1"}}>radar</span>
              </div>
              <div className="flex items-start justify-between relative z-10">
                <div>
                  <span className="text-xs font-bold text-on-primary-container opacity-80 uppercase tracking-wider">Active Session</span>
                  <p className="text-lg font-bold text-on-primary-container mt-1">
                    None running
                  </p>
                </div>
                <div className="bg-on-primary-container/10 px-3 py-1 rounded-full flex items-center gap-1">
                  <span className="material-symbols-outlined text-on-primary-container" style={{fontSize: '16px'}}>radio_button_checked</span>
                  <span className="text-xs text-on-primary-container font-medium">Idle</span>
                </div>
              </div>
            </div>
          )}

          {/* Total Courses */}
          <div className="bg-surface-container-lowest rounded-2xl p-4 card-shadow border border-outline-variant/20 flex flex-col justify-between border-l-4 border-l-primary">
            <span className="material-symbols-outlined text-outline text-xl mb-2 block">menu_book</span>
            <div>
              <p className="text-2xl font-bold text-on-surface">{courses.length}</p>
              <p className="text-xs text-on-surface-variant mt-0.5">Total Courses</p>
            </div>
          </div>

          {/* Total Students */}
          <div className="bg-surface-container-lowest rounded-2xl p-4 card-shadow border border-outline-variant/20 flex flex-col justify-between border-l-4 border-l-secondary-container">
            <span className="material-symbols-outlined text-outline text-xl mb-2 block">groups</span>
            <div>
              <p className="text-2xl font-bold text-on-surface">0</p>
              <p className="text-xs text-on-surface-variant mt-0.5">Total Students</p>
            </div>
          </div>
        </section>

        {/* Your Courses */}
        <section>
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-base font-semibold text-on-surface">Your Courses</h3>
            <Link href="/lecturer/courses" className="text-xs font-bold text-primary uppercase tracking-wider">View All</Link>
          </div>
          
          {isLoading ? (
            <div className="flex justify-center py-8">
              <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
            </div>
          ) : courses.length === 0 ? (
            <EmptyState
              icon="school"
              title="No courses yet"
              description="Go to Courses to create your first course and start managing sessions."
            />
          ) : (
            <div className="flex flex-col gap-3">
              {courses.slice(0, 4).map((course) => (
                <div key={course.courseId} className="bg-surface-container-lowest rounded-2xl p-4 card-shadow border border-outline-variant/20 relative overflow-hidden flex items-center justify-between gap-4">
                  <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-primary" />
                  <div className="pl-3 flex flex-col gap-1 flex-1">
                    <span className="text-[10px] font-bold text-primary bg-primary/10 px-2 py-0.5 rounded-full w-fit">{course.courseCode}</span>
                    <h4 className="text-sm font-semibold text-on-surface">{course.courseTitle}</h4>
                  </div>
                  {activeSession?.courseId === course.courseId ? (
                    <Link
                      href={`/lecturer/sessions/${activeSession.sessionId}`}
                      className="bg-error-container text-on-error-container h-10 px-4 rounded-full text-xs flex items-center gap-1 shrink-0 active:scale-95 transition-all font-bold shadow-sm"
                    >
                      <span className="material-symbols-outlined animate-pulse text-base">radio_button_checked</span>
                      Live
                    </Link>
                  ) : (
                    <Link
                      href={`/lecturer/courses/${course.courseId}`}
                      className="bg-primary-container text-on-primary-container h-10 px-4 rounded-full text-xs font-semibold flex items-center gap-1 shrink-0 active:scale-95 transition-all"
                    >
                      <span className="material-symbols-outlined text-base">play_arrow</span>
                      Start
                    </Link>
                  )}
                </div>
              ))}
            </div>
          )}
        </section>

      </main>
    </div>
  );
}
