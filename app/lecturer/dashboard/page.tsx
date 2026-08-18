'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useAuthStore } from '@/store/auth.store';
import { getLecturerCourses } from '@/lib/firebase/courses.service';
import { getActiveSessionWithSync } from '@/lib/firebase/sessions.service';
import TopAppBar from '@/components/layout/TopAppBar';
import { Course, Session } from '@/types';

function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}

export default function LecturerDashboard() {
  const { user } = useAuthStore();
  const [courses, setCourses] = useState<Course[]>([]);
  const [activeSession, setActiveSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!user?.userId) return;
    getLecturerCourses(user.userId)
      .then(async (courseData) => {
        setCourses(courseData);
        // Find if any of the lecturer's courses has an active session
        const activeArr = await Promise.all(
          courseData.map(c => getActiveSessionWithSync(c.courseId))
        );
        const runningSession = activeArr.find(s => s && s.status !== 'ended');
        setActiveSession(runningSession || null);
      })
      .catch(console.error)
      .finally(() => setIsLoading(false));
  }, [user?.userId]);

  const firstName = user?.name || 'there';

  return (
    <div className="bg-background">
      <TopAppBar />
      <main className="px-container-padding pt-6 max-w-lg mx-auto flex flex-col gap-section-margin pb-8">

        {/* Greeting */}
        <section>
          <h2 className="text-display font-bold text-on-surface">{getGreeting()}, {firstName}</h2>
        </section>

        {/* Bento Stats Grid */}
        <section className="grid grid-cols-2 gap-element-gap">
          {/* Active session card spans full width */}
          {activeSession ? (
            <Link href={`/lecturer/sessions/${activeSession.sessionId}`} className="col-span-2 bg-primary-container rounded-[16px] p-5 card-shadow flex flex-col justify-between relative overflow-hidden min-h-[100px] active:scale-95 transition-all block cursor-pointer">
              <div className="absolute right-0 top-0 opacity-10 pointer-events-none translate-x-4 -translate-y-4">
                <span className="material-symbols-outlined text-[120px]" style={{fontVariationSettings: "'FILL' 1"}}>radar</span>
              </div>
              <div className="flex items-start justify-between relative z-10">
                <div>
                  <span className="text-label-md text-on-primary-container opacity-80 uppercase tracking-wider">Active Session</span>
                  <p className="text-headline-md text-on-primary-container mt-1">
                    {activeSession.courseCode} Live
                  </p>
                </div>
                <div className="bg-error/10 px-3 py-1 rounded-full flex items-center gap-1 border border-error/20">
                  <span className="material-symbols-outlined text-error animate-pulse" style={{fontSize: '16px'}}>radio_button_checked</span>
                  <span className="text-label-sm text-error font-bold">Live</span>
                </div>
              </div>
            </Link>
          ) : (
            <div className="col-span-2 bg-primary-container rounded-[16px] p-5 card-shadow flex flex-col justify-between relative overflow-hidden min-h-[100px]">
              <div className="absolute right-0 top-0 opacity-10 pointer-events-none translate-x-4 -translate-y-4">
                <span className="material-symbols-outlined text-[120px]" style={{fontVariationSettings: "'FILL' 1"}}>radar</span>
              </div>
              <div className="flex items-start justify-between relative z-10">
                <div>
                  <span className="text-label-md text-on-primary-container opacity-80 uppercase tracking-wider">Active Session</span>
                  <p className="text-headline-md text-on-primary-container mt-1">
                    None running
                  </p>
                </div>
                <div className="bg-on-primary-container/10 px-3 py-1 rounded-full flex items-center gap-1">
                  <span className="material-symbols-outlined text-on-primary-container" style={{fontSize: '16px'}}>radio_button_checked</span>
                  <span className="text-label-sm text-on-primary-container">Idle</span>
                </div>
              </div>
            </div>
          )}

          {/* Total Courses */}
          <div className="bg-surface-container-lowest rounded-[16px] p-4 card-shadow border border-outline-variant/20 flex flex-col justify-between">
            <span className="material-symbols-outlined text-primary mb-2" style={{fontVariationSettings: "'FILL' 1"}}>menu_book</span>
            <div>
              <p className="text-display font-bold text-on-surface">{courses.length}</p>
              <p className="text-label-sm text-on-surface-variant">Total Courses</p>
            </div>
          </div>

          {/* Total Students */}
          <div className="bg-surface-container-lowest rounded-[16px] p-4 card-shadow border border-outline-variant/20 flex flex-col justify-between">
            <span className="material-symbols-outlined text-secondary mb-2" style={{fontVariationSettings: "'FILL' 1"}}>groups</span>
            <div>
              <p className="text-display font-bold text-on-surface">0</p>
              <p className="text-label-sm text-on-surface-variant">Total Students</p>
            </div>
          </div>
        </section>

        {/* Your Courses */}
        <section className="flex flex-col gap-stack-gap">
          <h3 className="text-headline-sm text-on-surface">Your Courses</h3>
          {isLoading ? (
            <div className="flex justify-center py-8">
              <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
            </div>
          ) : courses.length === 0 ? (
            <div className="bg-surface-container-lowest rounded-[16px] p-8 card-shadow text-center">
              <span className="material-symbols-outlined text-outline text-5xl mb-3 block">school</span>
              <p className="text-body-lg font-medium text-on-surface">No courses yet</p>
              <p className="text-body-md text-on-surface-variant mt-1">Go to Courses to create your first course</p>
            </div>
          ) : (
            <div className="flex flex-col gap-element-gap">
              {courses.slice(0, 4).map((course) => (
                <div key={course.courseId} className="bg-surface-container-lowest rounded-[16px] p-4 card-shadow border border-outline-variant/20 relative overflow-hidden flex items-center justify-between gap-4">
                  <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-primary" />
                  <div className="pl-3 flex flex-col gap-1 flex-1">
                    <span className="text-label-md text-primary bg-primary/10 px-2 py-0.5 rounded-full w-fit">{course.courseCode}</span>
                    <h4 className="text-headline-sm text-on-surface">{course.courseTitle}</h4>
                  </div>
                  {activeSession?.courseId === course.courseId ? (
                    <Link
                      href={`/lecturer/sessions/${activeSession.sessionId}`}
                      className="bg-error-container text-on-error-container h-touch-target px-4 rounded-full text-label-md flex items-center gap-1 shrink-0 active:scale-95 transition-all font-bold shadow-sm"
                    >
                      <span className="material-symbols-outlined animate-pulse" style={{fontSize: '16px'}}>radio_button_checked</span>
                      Live
                    </Link>
                  ) : (
                    <Link
                      href={`/lecturer/courses/${course.courseId}`}
                      className="bg-primary-container text-on-primary-container h-touch-target px-4 rounded-full text-label-md flex items-center gap-1 shrink-0 active:scale-95 transition-all"
                    >
                      <span className="material-symbols-outlined" style={{fontSize: '16px'}}>play_arrow</span>
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
