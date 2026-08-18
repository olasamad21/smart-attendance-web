'use client';
import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import TopAppBar from '@/components/layout/TopAppBar';
import { getCourseById, getEnrolledStudents } from '@/lib/firebase/courses.service';
import { getSessionsForCourse } from '@/lib/firebase/sessions.service';
import { getCourseAttendanceOverview } from '@/lib/firebase/attendance.service';
import { Course, Session, AttendanceRecord, UserProfile } from '@/types';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  ArcElement,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler
} from 'chart.js';
import { Bar, Doughnut } from 'react-chartjs-2';

ChartJS.register(CategoryScale, LinearScale, BarElement, ArcElement, PointElement, LineElement, Title, Tooltip, Legend, Filler);

export default function StatisticsPage() {
  const { courseId } = useParams<{ courseId: string }>();
  const [course, setCourse] = useState<Course | null>(null);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [students, setStudents] = useState<UserProfile[]>([]);
  const [allRecords, setAllRecords] = useState<AttendanceRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!courseId) return;
    const fetchData = async () => {
      try {
        const [courseData, sessionsData, studentsData, records] = await Promise.all([
          getCourseById(courseId),
          getSessionsForCourse(courseId),
          getEnrolledStudents(courseId),
          getCourseAttendanceOverview(courseId)
        ]);
        setCourse(courseData);
        // Sort sessions chronologically (oldest first for chart X-axis)
        const sorted = sessionsData
          .filter(s => s.status === 'ended')
          .sort((a, b) => {
            const dateA = (a.createdAt as any)?.seconds || 0;
            const dateB = (b.createdAt as any)?.seconds || 0;
            return dateA - dateB;
          });
        setSessions(sorted);
        setStudents(studentsData);
        setAllRecords(records);
      } catch (error) {
        console.error('Error fetching statistics:', error);
      } finally {
        setIsLoading(false);
      }
    };
    fetchData();
  }, [courseId]);

  if (isLoading) {
    return (
      <div className="bg-background min-h-screen">
        <TopAppBar title="Statistics" showBack={true} />
        <main className="px-5 pt-6 max-w-lg mx-auto flex justify-center mt-20">
          <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin" />
        </main>
      </div>
    );
  }

  // --- Calculations ---
  const totalEnrolled = students.length;
  const totalSessions = sessions.length;

  // Per-session attendance counts
  const sessionAttendanceCounts = sessions.map(s => {
    const sessionRecords = allRecords.filter(r => r.sessionId === s.sessionId && (r.phase1Score > 0 || r.phase2Score > 0));
    return sessionRecords.length;
  });

  // Overall attendance rate
  const totalPossibleAttendances = totalEnrolled * totalSessions;
  const totalActualAttendances = sessionAttendanceCounts.reduce((sum, c) => sum + c, 0);
  const avgAttendanceRate = totalPossibleAttendances > 0
    ? ((totalActualAttendances / totalPossibleAttendances) * 100).toFixed(1)
    : '0.0';

  // Phase completion breakdown (across all records)
  const bothPhases = allRecords.filter(r => r.phase1Score > 0 && r.phase2Score > 0).length;
  const phase1Only = allRecords.filter(r => r.phase1Score > 0 && r.phase2Score === 0).length; // Left early
  const phase2Only = allRecords.filter(r => r.phase1Score === 0 && r.phase2Score > 0).length; // Came late
  const totalAbsentSlots = totalPossibleAttendances - totalActualAttendances;

  // Average score per student
  const phase1Max = course?.phase1Marks ?? 3;
  const phase2Max = course?.phase2Marks ?? 2;
  const maxScorePerSession = phase1Max + phase2Max;
  const maxTotalScore = totalSessions * maxScorePerSession;

  const studentStats = students.map(student => {
    const recs = allRecords.filter(r => r.studentId === student.userId);
    const attended = recs.filter(r => r.phase1Score > 0 || r.phase2Score > 0).length;
    const totalScore = recs.reduce((sum, r) => sum + (r.phase1Score || 0) + (r.phase2Score || 0), 0);
    const percentage = totalSessions > 0 ? ((attended / totalSessions) * 100) : 0;
    return { ...student, attended, totalScore, percentage };
  }).sort((a, b) => a.name.localeCompare(b.name));

  const avgScore = studentStats.length > 0
    ? (studentStats.reduce((sum, s) => sum + s.totalScore, 0) / studentStats.length).toFixed(1)
    : '0.0';

  // At-risk students (bottom 5 by attendance %)
  const atRisk = [...studentStats].sort((a, b) => a.percentage - b.percentage).slice(0, 5);

  // --- Chart Data ---
  const sessionLabels = sessions.map(s => {
    const ts = (s.createdAt as any)?.seconds ? (s.createdAt as any).seconds * 1000 : s.createdAt;
    return new Date(ts).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  });

  const attendanceTrendData = {
    labels: sessionLabels,
    datasets: [
      {
        label: 'Students Present',
        data: sessionAttendanceCounts,
        backgroundColor: 'rgba(45, 106, 79, 0.6)',
        borderColor: 'rgba(45, 106, 79, 1)',
        borderWidth: 1,
        borderRadius: 8,
      },
      {
        label: 'Total Enrolled',
        data: sessions.map(() => totalEnrolled),
        backgroundColor: 'rgba(45, 106, 79, 0.1)',
        borderColor: 'rgba(45, 106, 79, 0.3)',
        borderWidth: 1,
        borderRadius: 8,
      }
    ]
  };

  const attendanceTrendOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: true, position: 'bottom' as const, labels: { font: { size: 10 }, usePointStyle: true, pointStyleWidth: 8 } },
      tooltip: { mode: 'index' as const, intersect: false }
    },
    scales: {
      y: {
        beginAtZero: true,
        max: Math.max(totalEnrolled + 2, 5),
        ticks: { font: { size: 10 }, stepSize: 1 },
        grid: { color: 'rgba(0,0,0,0.05)' }
      },
      x: {
        ticks: { font: { size: 9 } },
        grid: { display: false }
      }
    }
  };

  const phaseBreakdownData = {
    labels: ['Both Phases', 'Phase 1 Only', 'Phase 2 Only', 'Absent'],
    datasets: [{
      data: [bothPhases, phase1Only, phase2Only, totalAbsentSlots],
      backgroundColor: [
        'rgba(45, 106, 79, 0.8)',   // Both - Strong green
        'rgba(251, 191, 36, 0.8)',   // P1 only - Amber
        'rgba(96, 165, 250, 0.8)',   // P2 only - Blue
        'rgba(239, 68, 68, 0.3)',    // Absent - Faded red
      ],
      borderColor: [
        'rgba(45, 106, 79, 1)',
        'rgba(251, 191, 36, 1)',
        'rgba(96, 165, 250, 1)',
        'rgba(239, 68, 68, 0.5)',
      ],
      borderWidth: 1,
    }]
  };

  const phaseBreakdownOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: true, position: 'bottom' as const, labels: { font: { size: 10 }, usePointStyle: true, pointStyleWidth: 8, padding: 12 } },
    },
    cutout: '60%',
  };

  return (
    <div className="bg-background min-h-screen">
      <TopAppBar title="Statistics" showBack={true} />

      <main className="px-5 pt-6 max-w-lg mx-auto pb-8">
        {/* Course header */}
        {course && (
          <div className="mb-6">
            <h1 className="text-2xl font-bold text-on-surface">{course.courseCode}</h1>
            <p className="text-sm text-on-surface-variant">{course.courseTitle}</p>
          </div>
        )}

        {/* Key Metrics */}
        <div className="grid grid-cols-2 gap-3 mb-6">
          <div className="bg-surface-container-lowest rounded-2xl p-4 card-shadow text-center">
            <p className="text-3xl font-bold text-on-surface">{totalSessions}</p>
            <p className="text-[10px] text-on-surface-variant mt-1 uppercase tracking-wider font-semibold">Sessions</p>
          </div>
          <div className="bg-surface-container-lowest rounded-2xl p-4 card-shadow text-center">
            <p className="text-3xl font-bold text-on-surface">{totalEnrolled}</p>
            <p className="text-[10px] text-on-surface-variant mt-1 uppercase tracking-wider font-semibold">Students</p>
          </div>
          <div className="bg-primary-container/30 rounded-2xl p-4 card-shadow text-center">
            <p className="text-3xl font-bold text-on-surface">{avgAttendanceRate}%</p>
            <p className="text-[10px] text-on-surface-variant mt-1 uppercase tracking-wider font-semibold">Avg Attendance</p>
          </div>
          <div className="bg-primary-container/30 rounded-2xl p-4 card-shadow text-center">
            <p className="text-3xl font-bold text-on-surface">{avgScore}</p>
            <p className="text-[10px] text-on-surface-variant mt-1 uppercase tracking-wider font-semibold">Avg Score</p>
          </div>
        </div>

        {totalSessions === 0 ? (
          <div className="bg-surface-container-lowest rounded-2xl p-12 text-center card-shadow">
            <span className="material-symbols-outlined text-outline text-5xl mb-3 block">bar_chart</span>
            <p className="text-base font-semibold text-on-surface">No Data Yet</p>
            <p className="text-sm text-on-surface-variant mt-1">Statistics will appear after you complete your first session</p>
          </div>
        ) : (
          <>
            {/* Attendance Trend Chart */}
            <div className="bg-surface-container-lowest rounded-2xl p-5 card-shadow mb-6">
              <h2 className="font-bold text-on-surface text-sm mb-4">Attendance Trend</h2>
              <div className="h-52">
                <Bar data={attendanceTrendData} options={attendanceTrendOptions} />
              </div>
            </div>

            {/* Phase Completion Breakdown */}
            <div className="bg-surface-container-lowest rounded-2xl p-5 card-shadow mb-6">
              <h2 className="font-bold text-on-surface text-sm mb-4">Phase Completion Breakdown</h2>
              <div className="h-52 flex items-center justify-center">
                <Doughnut data={phaseBreakdownData} options={phaseBreakdownOptions} />
              </div>
            </div>

            {/* At-Risk Students */}
            {atRisk.length > 0 && (
              <div className="bg-surface-container-lowest rounded-2xl card-shadow overflow-hidden">
                <div className="flex items-center justify-between p-4 border-b border-surface-variant">
                  <div className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-error text-lg">warning</span>
                    <h3 className="text-sm font-bold text-on-surface">At-Risk Students</h3>
                  </div>
                  <span className="text-[10px] text-on-surface-variant">Lowest attendance</span>
                </div>
                <div className="divide-y divide-surface-variant/50">
                  {atRisk.map((s, i) => (
                    <div key={s.userId} className="flex items-center gap-3 px-4 py-3">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ${
                        s.percentage < 50 ? 'bg-error-container text-on-error-container' : 'bg-surface-container text-on-surface-variant'
                      }`}>
                        {i + 1}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-on-surface truncate">{s.name}</p>
                        <p className="text-[10px] text-on-surface-variant truncate">{s.matricNumber || '—'}</p>
                      </div>
                      <div className="text-right shrink-0">
                        <p className={`text-sm font-bold ${s.percentage < 50 ? 'text-error' : 'text-on-surface'}`}>
                          {s.percentage.toFixed(0)}%
                        </p>
                        <p className="text-[10px] text-on-surface-variant">{s.attended}/{totalSessions}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}
