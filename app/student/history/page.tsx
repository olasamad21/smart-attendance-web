'use client';

import { useEffect, useState } from 'react';
import TopAppBar from '@/components/layout/TopAppBar';
import { useAuthStore } from '@/store/auth.store';
import { getStudentAttendanceHistory } from '@/lib/firebase/attendance.service';
import { getStudentCourses } from '@/lib/firebase/courses.service';
import { getSessionsForCourse } from '@/lib/firebase/sessions.service';
import { toDate } from '@/lib/utils/session.utils';
import { AttendanceRecord, Course } from '@/types';

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
      <main className="px-5 pt-6 max-w-lg mx-auto pb-8">
        <select 
          value={selectedCourseId} 
          onChange={(e) => setSelectedCourseId(e.target.value)}
          className="w-full h-12 px-4 bg-surface-container-low border border-outline-variant rounded-lg text-sm text-on-surface focus:outline-none focus:border-primary mb-4"
        >
          <option value="all">All Courses</option>
          {courses.map(c => (
            <option key={c.courseId} value={c.courseId}>{c.courseCode} - {c.courseTitle}</option>
          ))}
        </select>

        {loading ? (
          <div className="flex justify-center items-center mt-20">
            <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-primary"></div>
          </div>
        ) : filteredRecords.length === 0 ? (
          <div className="bg-surface-container-lowest rounded-2xl p-12 text-center card-shadow mt-4">
            <span className="material-symbols-outlined text-outline text-5xl mb-3 block">fact_check</span>
            <p className="text-base font-semibold text-on-surface">No attendance records yet</p>
            <p className="text-sm text-on-surface-variant mt-1">Your attendance history will appear here after you verify attendance</p>
          </div>
        ) : (
          <div className="flex flex-col gap-4 mt-4">
            {filteredRecords.map((record) => {
              const dateDisplay = toDate(record.timestamp).toLocaleDateString(undefined, {
                weekday: 'short',
                month: 'short',
                day: 'numeric',
                year: 'numeric'
              });

              let remarkColor = 'bg-surface-container text-on-surface-variant';
              if (record.remark === 'Present') {
                remarkColor = 'bg-secondary-container/30 text-on-secondary-container';
              } else if (record.remark === 'Absent' || record.remark === 'Failed') {
                remarkColor = 'bg-error-container text-on-error-container';
              }

              return (
                <div key={record.attendanceId} className="bg-surface-container-lowest rounded-2xl p-4 card-shadow flex flex-col gap-3">
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
                        ? 'bg-secondary-container/30 text-on-secondary-container' 
                        : 'bg-surface-container text-on-surface-variant'
                    }`}>
                      P1
                    </span>
                    <span className={`text-xs px-2 py-1 rounded-md font-medium ${
                      record.phase2Score > 0 
                        ? 'bg-secondary-container/30 text-on-secondary-container' 
                        : 'bg-surface-container text-on-surface-variant'
                    }`}>
                      P2
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
