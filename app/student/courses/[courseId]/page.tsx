'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import TopAppBar from '@/components/layout/TopAppBar';
import { useAuthStore } from '@/store/auth.store';
import { getStudentAttendanceHistory } from '@/lib/firebase/attendance.service';
import { getCourseById } from '@/lib/firebase/courses.service';
import { getSessionsForCourse } from '@/lib/firebase/sessions.service';
import EmptyState from '@/components/ui/EmptyState';
import { toDate } from '@/lib/utils/session.utils';
import { AttendanceRecord, Course, Session } from '@/types';
import Skeleton, { SkeletonCards } from '@/components/ui/Skeleton';
import ProgressRing from '@/components/ui/ProgressRing';
import Badge from '@/components/ui/Badge';

type TimelineItem = {
  session: Session;
  record?: AttendanceRecord;
  displayTitle: string;
};

export default function CourseHistoryPage() {
  const { courseId } = useParams<{ courseId: string }>();
  const user = useAuthStore(state => state.user);
  
  const [course, setCourse] = useState<Course | null>(null);
  const [timeline, setTimeline] = useState<TimelineItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [totalScore, setTotalScore] = useState(0);
  const [attendanceRate, setAttendanceRate] = useState(0);

  useEffect(() => {
    async function loadData() {
      if (!user?.userId || !courseId) return;
      try {
        const [courseData, sessionsData, historyData] = await Promise.all([
          getCourseById(courseId),
          getSessionsForCourse(courseId),
          getStudentAttendanceHistory(user.userId)
        ]);

        setCourse(courseData);

        const courseRecords = historyData.filter(r => r.courseId === courseId);
        
        let scoreSum = 0;
        courseRecords.forEach(r => {
          scoreSum += r.totalScore;
        });
        setTotalScore(scoreSum);

        const recordsMap = courseRecords.reduce((acc, r) => {
          acc[r.sessionId] = r;
          return acc;
        }, {} as Record<string, AttendanceRecord>);

        const totalSessions = sessionsData.length;
        const attendedSessions = courseRecords.length;
        setAttendanceRate(totalSessions > 0 ? Math.round((attendedSessions / totalSessions) * 100) : 0);
        const timelineItems = sessionsData.map((session, i) => {
          const chronologicalIndex = totalSessions - i;
          return {
            session,
            record: recordsMap[session.sessionId],
            displayTitle: `Session ${chronologicalIndex}`
          };
        });

        setTimeline(timelineItems);
      } catch (error) {
        console.error('Failed to load course details', error);
      } finally {
        setLoading(false);
      }
    }

    if (user) {
      loadData();
    }
  }, [user, courseId]);

  return (
    <div className="bg-background">
      <TopAppBar title="Course" showBack />
      <main className="px-4 sm:px-6 pt-6 max-w-lg md:max-w-4xl mx-auto pb-8">
        {loading ? (
          <div className="flex flex-col gap-4"><Skeleton className="h-28 w-full rounded-2xl" /><SkeletonCards count={4} className="h-16" /></div>
        ) : (
          <>
            <div className="rounded-3xl bg-primary-container text-on-primary-container p-5 shadow-raised mb-6 animate-fade-up">
              {course && (
                <>
                  <p className="text-xs font-bold opacity-80">{course.courseCode}</p>
                  <h2 className="text-xl font-bold leading-tight">{course.courseTitle}</h2>
                  {course.lecturerName && <p className="text-xs opacity-75 mt-0.5">{course.lecturerName}</p>}
                </>
              )}
              <div className="mt-5 flex items-center gap-5">
                <ProgressRing value={attendanceRate / 100} size={92} stroke={8}
                  tone={timeline.length === 0 ? 'onPrimary' : attendanceRate >= 75 ? 'success' : 'warning'}
                  label={`Attendance ${attendanceRate}%`}>
                  <span className="text-xl font-extrabold tabular-nums">{timeline.length ? `${attendanceRate}%` : '—'}</span>
                </ProgressRing>
                <dl className="grid grid-cols-2 gap-x-6 gap-y-3">
                  <div>
                    <dt className="text-[11px] opacity-75">Attended</dt>
                    <dd className="text-lg font-bold tabular-nums">{timeline.filter(t => t.record).length}/{timeline.length}</dd>
                  </div>
                  <div>
                    <dt className="text-[11px] opacity-75">Total score</dt>
                    <dd className="text-lg font-bold tabular-nums">{totalScore}</dd>
                  </div>
                  <div className="col-span-2">
                    {timeline.length > 0 && (
                      <Badge tone={attendanceRate >= 75 ? 'success' : 'warning'} icon={attendanceRate >= 75 ? 'trending_up' : 'warning'}>
                        {attendanceRate >= 75 ? 'On track' : 'Below 75%'}
                      </Badge>
                    )}
                  </div>
                </dl>
              </div>
            </div>

            <h3 className="text-base font-semibold text-on-surface mb-3">Session history</h3>
            {timeline.length === 0 ? (
              <EmptyState
                icon="history"
                title="No sessions yet"
                description="Your attendance timeline will appear here once sessions begin."
              />
            ) : (
              <div className="grid md:grid-cols-2 gap-4">
                {timeline.map((item) => {
                  const record = item.record;
                  const timestamp = record?.timestamp || item.session.createdAt;
                  const dateDisplay = toDate(timestamp).toLocaleDateString(undefined, {
                    weekday: 'short',
                    month: 'short',
                    day: 'numeric',
                    year: 'numeric'
                  });

                  const isAbsent = !record;
                  const remark = isAbsent ? 'Absent' : (record.remark || 'Unknown');
                  
                  let remarkColor = 'bg-warning-container text-on-warning-container';
                  if (remark.startsWith('Present')) {
                    remarkColor = 'bg-success-container text-on-success-container';
                  } else if (remark === 'Absent' || remark === 'Failed') {
                    remarkColor = 'bg-error-container text-on-error-container';
                  }

                  const p1Score = record?.phase1Score || 0;
                  const p2Score = record?.phase2Score || 0;
                  const total = record?.totalScore || 0;

                  return (
                    <div key={item.session.sessionId} className="bg-surface-container-lowest rounded-2xl p-4 shadow-card border border-outline-variant/30 flex flex-col gap-3">
                      <div className="flex justify-between items-start">
                        <div>
                          <h3 className="font-semibold text-on-surface text-base">{item.displayTitle}</h3>
                          <p className="text-sm text-on-surface-variant">{dateDisplay}</p>
                        </div>
                        <div className={`px-2.5 py-1 rounded-full text-xs font-medium ${remarkColor}`}>
                          {remark}
                        </div>
                      </div>

                      <div className="flex items-center gap-2 mt-1">
                        <span className={`text-xs px-2 py-1 rounded-md font-medium ${
                          p1Score > 0 
                            ? 'bg-secondary-container/30 text-on-secondary-container' 
                            : 'bg-surface-container text-on-surface-variant'
                        }`}>
                          Check-in
                        </span>
                        <span className={`text-xs px-2 py-1 rounded-md font-medium ${
                          p2Score > 0 
                            ? 'bg-secondary-container/30 text-on-secondary-container' 
                            : 'bg-surface-container text-on-surface-variant'
                        }`}>
                          Check-out
                        </span>
                        <div className="flex-1"></div>
                        <span className="text-sm font-medium text-on-surface flex items-center gap-1">
                          <span className="material-symbols-outlined text-primary text-base">star</span>
                          {total}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}
