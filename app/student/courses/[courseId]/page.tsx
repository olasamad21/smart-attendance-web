'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import TopAppBar from '@/components/layout/TopAppBar';
import { useAuthStore } from '@/store/auth.store';
import { getStudentAttendanceHistory } from '@/lib/firebase/attendance.service';
import { getCourseById } from '@/lib/firebase/courses.service';
import { getSessionsForCourse } from '@/lib/firebase/sessions.service';
import { toDate } from '@/lib/utils/session.utils';
import { AttendanceRecord, Course, Session } from '@/types';

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
      <TopAppBar title="Course History" showBack />
      <main className="px-5 pt-6 max-w-lg mx-auto pb-8">
        {loading ? (
          <div className="flex justify-center items-center mt-20">
            <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-primary"></div>
          </div>
        ) : (
          <>
            {course && (
              <div className="mb-6">
                <h2 className="text-xl font-bold text-on-surface">{course.courseCode}</h2>
                <p className="text-sm text-on-surface-variant">{course.courseTitle}</p>
              </div>
            )}
            
            <div className="flex gap-3 mb-6">
              <div className="flex-1 bg-surface-container-lowest rounded-2xl p-3 card-shadow text-center flex flex-col items-center justify-center">
                <span className="material-symbols-outlined text-primary mb-1 text-xl">event_available</span>
                <p className="text-xl font-bold text-on-surface">{timeline.length}</p>
                <p className="text-[10px] uppercase tracking-wider text-on-surface-variant font-medium mt-0.5">Sessions</p>
              </div>
              <div className="flex-1 bg-surface-container-lowest rounded-2xl p-3 card-shadow text-center flex flex-col items-center justify-center">
                <span className="material-symbols-outlined text-primary mb-1 text-xl">stars</span>
                <p className="text-xl font-bold text-on-surface">{totalScore}</p>
                <p className="text-[10px] uppercase tracking-wider text-on-surface-variant font-medium mt-0.5">Score</p>
              </div>
              <div className="flex-1 bg-surface-container-lowest rounded-2xl p-3 card-shadow text-center flex flex-col items-center justify-center">
                <span className="material-symbols-outlined text-primary mb-1 text-xl">analytics</span>
                <p className="text-xl font-bold text-on-surface">{attendanceRate}%</p>
                <p className="text-[10px] uppercase tracking-wider text-on-surface-variant font-medium mt-0.5">Attendance</p>
              </div>
            </div>

            {timeline.length === 0 ? (
               <div className="bg-surface-container-lowest rounded-2xl p-12 text-center card-shadow mt-4">
                 <p className="text-base font-semibold text-on-surface">No sessions yet</p>
                 <p className="text-sm text-on-surface-variant mt-1">This course does not have any sessions.</p>
               </div>
            ) : (
              <div className="flex flex-col gap-4">
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
                  
                  let remarkColor = 'bg-surface-container text-on-surface-variant';
                  if (remark === 'Present') {
                    remarkColor = 'bg-secondary-container/30 text-on-secondary-container';
                  } else if (remark === 'Absent' || remark === 'Failed') {
                    remarkColor = 'bg-error-container text-on-error-container';
                  }

                  const p1Score = record?.phase1Score || 0;
                  const p2Score = record?.phase2Score || 0;
                  const total = record?.totalScore || 0;

                  return (
                    <div key={item.session.sessionId} className="bg-surface-container-lowest rounded-2xl p-4 card-shadow flex flex-col gap-3">
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
                          P1
                        </span>
                        <span className={`text-xs px-2 py-1 rounded-md font-medium ${
                          p2Score > 0 
                            ? 'bg-secondary-container/30 text-on-secondary-container' 
                            : 'bg-surface-container text-on-surface-variant'
                        }`}>
                          P2
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
