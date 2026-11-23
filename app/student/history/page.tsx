'use client';

import { useEffect, useState } from 'react';
import TopAppBar from '@/components/layout/TopAppBar';
import { useAuthStore } from '@/store/auth.store';
import { getStudentAttendanceHistory } from '@/lib/firebase/attendance.service';
import EmptyState from '@/components/ui/EmptyState';
import { getStudentCourses } from '@/lib/firebase/courses.service';
import { getSessionsForCourse } from '@/lib/firebase/sessions.service';
import { toDate } from '@/lib/utils/session.utils';
import { AttendanceRecord, Course } from '@/types';
import { SkeletonCards } from '@/components/ui/Skeleton';

type DisplayRecord = AttendanceRecord & { displayTitle: string };

export default function AttendanceHistoryPage() {
  const user = useAuthStore(state => state.user);
  const [records, setRecords] = useState<DisplayRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCourseId, setSelectedCourseId] = useState<string>('all');
  const [courses, setCourses] = useState<Course[]>([]);

  useEffect(() => {
    async function loadRecords() {
      if (!user?.userId) return;
      try {
        const [data, courseList] = await Promise.all([
          getStudentAttendanceHistory(user.userId),
          getStudentCourses(user.userId)
        ]);

        setCourses(courseList);

        const courseMap = courseList.reduce((acc, c) => {
          acc[c.courseId] = c;
          return acc;
        }, {} as Record<string, Course>);

        const sessionsMap: Record<string, string> = {}; // sessionId -> 'Session X'
        await Promise.all(courseList.map(async (c) => {
          try {
            const sessions = await getSessionsForCourse(c.courseId);
            // sessions are fetched desc (newest first), reverse to get chronological index
            sessions.reverse().forEach((s, index) => {
              sessionsMap[s.sessionId] = `Session ${index + 1}`;
            });
          } catch {
            // ignore
          }
        }));

        const computed = data.map(record => {
          const code = courseMap[record.courseId]?.courseCode || 'Unknown';
          const sessionName = sessionsMap[record.sessionId] || 'Session';
          return {
            ...record,
            displayTitle: `${code} ${sessionName}`
          };
        });

        setRecords(computed);
      } catch (error) {
        console.error('Failed to load attendance history', error);
      } finally {
        setLoading(false);
      }
    }
    
    if (user) {
      loadRecords();
    }
  }, [user]);

  const filteredRecords = selectedCourseId === 'all' 
    ? records 
    : records.filter(r => r.courseId === selectedCourseId);

  return (
    <div className="bg-background">
      <TopAppBar title="Attendance" />
      <main className="px-4 sm:px-6 pt-6 max-w-lg md:max-w-4xl mx-auto pb-8">
        <select 
          value={selectedCourseId} 
          onChange={(e) => setSelectedCourseId(e.target.value)}
          className="field-input mb-4 md:max-w-xs"
        >
          <option value="all">All Courses</option>
          {courses.map(c => (
            <option key={c.courseId} value={c.courseId}>{c.courseCode} - {c.courseTitle}</option>
          ))}
        </select>

        {loading ? (
          <SkeletonCards count={5} className="h-20" />
        ) : filteredRecords.length === 0 ? (
          <EmptyState
            icon="fact_check"
            title="No records yet"
            description="Your attendance history will appear here after you check into your first session."
          />
        ) : (
          <div className="grid md:grid-cols-2 gap-4 mt-4">
            {filteredRecords.map((record) => {
              const dateDisplay = toDate(record.timestamp).toLocaleDateString(undefined, {
                weekday: 'short',
                month: 'short',
                day: 'numeric',
                year: 'numeric'
              });

              let remarkColor = 'bg-warning-container text-on-warning-container';
              if (record.remark?.startsWith('Present')) {
                remarkColor = 'bg-success-container text-on-success-container';
              } else if (record.remark === 'Absent' || record.remark === 'Failed') {
                remarkColor = 'bg-error-container text-on-error-container';
              }

              return (
                <div key={record.attendanceId} className="bg-surface-container-lowest rounded-2xl p-4 shadow-card border border-outline-variant/30 flex flex-col gap-3">
                  <div className="flex justify-between items-start">
                    <div>
                      <h3 className="font-semibold text-on-surface text-base">{record.displayTitle}</h3>
                      <p className="text-sm text-on-surface-variant">{dateDisplay}</p>
                    </div>
                    <div className={`px-2.5 py-1 rounded-full text-xs font-medium ${remarkColor}`}>
                      {record.remark || 'Unknown'}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 mt-1">
                    <span className={`text-xs px-2 py-1 rounded-md font-medium ${
                      record.phase1Score > 0 
                        ? 'bg-success-container text-on-success-container' 
                        : 'bg-surface-container text-on-surface-variant'
                    }`}>
                      Check-in
                    </span>
                    <span className={`text-xs px-2 py-1 rounded-md font-medium ${
                      record.phase2Score > 0 
                        ? 'bg-success-container text-on-success-container' 
                        : 'bg-surface-container text-on-surface-variant'
                    }`}>
                      Check-out
                    </span>
                    <div className="flex-1"></div>
                    <span className="text-sm font-medium text-on-surface">
                      Score: {record.totalScore}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}
