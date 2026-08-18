'use client';
import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import TopAppBar from '@/components/layout/TopAppBar';
import { getCourseById, getEnrolledStudents } from '@/lib/firebase/courses.service';
import { getSessionsForCourse } from '@/lib/firebase/sessions.service';
import { getSessionAttendance, getCourseAttendanceOverview } from '@/lib/firebase/attendance.service';
import { downloadCSV } from '@/lib/utils/csv.utils';
import { downloadPDF } from '@/lib/utils/pdf.utils';
import { Course, Session, AttendanceRecord, UserProfile } from '@/types';

export default function ReportsPage() {
  const { courseId } = useParams<{ courseId: string }>();
  const [course, setCourse] = useState<Course | null>(null);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [students, setStudents] = useState<UserProfile[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [downloading, setDownloading] = useState<string | null>(null);
  const [openDropdown, setOpenDropdown] = useState<string | null>(null);

  useEffect(() => {
    if (!courseId) return;
    const fetchData = async () => {
      try {
        const [courseData, sessionsData, studentsData] = await Promise.all([
          getCourseById(courseId),
          getSessionsForCourse(courseId),
          getEnrolledStudents(courseId)
        ]);
        setCourse(courseData);
        // Sort sessions by createdAt descending (newest first)
        const sorted = sessionsData.sort((a, b) => {
          const dateA = (a.createdAt as any)?.seconds ? (a.createdAt as any).seconds : 0;
          const dateB = (b.createdAt as any)?.seconds ? (b.createdAt as any).seconds : 0;
          return dateB - dateA;
        });
        setSessions(sorted);
        setStudents(studentsData);
      } catch (error) {
        console.error('Error fetching reports data:', error);
      } finally {
        setIsLoading(false);
      }
    };
    fetchData();
  }, [courseId]);

  const formatDate = (dateValue: any) => {
    const timestamp = dateValue?.seconds ? dateValue.seconds * 1000 : dateValue;
    return new Date(timestamp).toLocaleDateString('en-US', {
      weekday: 'short', month: 'short', day: 'numeric', year: 'numeric'
    });
  };

  // --- Combined Report ---
  const handleDownloadCombined = async () => {
    if (!course) return;
    setDownloading('combined');
    try {
      const allRecords = await getCourseAttendanceOverview(courseId);
      const endedSessions = sessions.filter(s => s.status === 'ended');
      const totalEndedSessions = endedSessions.length;
      const phase1Max = course.phase1Marks ?? 3;
      const phase2Max = course.phase2Marks ?? 2;
      const maxPossible = totalEndedSessions * (phase1Max + phase2Max);

      const reportData = students.map(student => {
        const studentRecords = allRecords.filter(r => r.studentId === student.userId && (r.phase1Score > 0 || r.phase2Score > 0));
        const attendedSessionIds = new Set(studentRecords.map(r => r.sessionId));
        const totalP1 = studentRecords.reduce((sum, r) => sum + (r.phase1Score || 0), 0);
        const totalP2 = studentRecords.reduce((sum, r) => sum + (r.phase2Score || 0), 0);
        const totalScore = totalP1 + totalP2;
        const percentage = maxPossible > 0 ? ((totalScore / maxPossible) * 100).toFixed(1) : '0.0';
        return {
          name: student.name,
          matricNumber: student.matricNumber || '',
          department: student.department || 'N/A',
          level: student.level || 'N/A',
          sessionsAttended: attendedSessionIds.size,
          totalSessions: totalEndedSessions,
          phase1Score: totalP1,
          phase2Score: totalP2,
          totalScore,
          maxPossible,
          percentage
        };
      });

      reportData.sort((a, b) => a.name.localeCompare(b.name));

      const headers = ['Student Name', 'Matric No', 'Department', 'Level', 'Sessions Attended', 'Total Sessions', 'Phase 1 Score', 'Phase 2 Score', 'Total Score', 'Max Possible', 'Percentage'];
      const rows = reportData.map(r => [
        r.name, r.matricNumber, r.department, r.level,
        r.sessionsAttended, r.totalSessions,
        r.phase1Score, r.phase2Score, r.totalScore, r.maxPossible, r.percentage
      ]);
      downloadCSV(`${course.courseCode}_Combined_Report.csv`, headers, rows);
    } catch (error) {
      console.error('Error generating combined report:', error);
    } finally {
      setDownloading(null);
    }
  };

  // --- Combined Report PDF ---
  const handleDownloadCombinedPDF = async () => {
    if (!course) return;
    setDownloading('combined_pdf');
    try {
      const allRecords = await getCourseAttendanceOverview(courseId);
      const endedSessions = sessions.filter(s => s.status === 'ended');
      const totalEndedSessions = endedSessions.length;
      const phase1Max = course.phase1Marks ?? 3;
      const phase2Max = course.phase2Marks ?? 2;
      const maxPossible = totalEndedSessions * (phase1Max + phase2Max);

      const reportData = students.map(student => {
        const studentRecords = allRecords.filter(r => r.studentId === student.userId && (r.phase1Score > 0 || r.phase2Score > 0));
        const attendedSessionIds = new Set(studentRecords.map(r => r.sessionId));
        const totalP1 = studentRecords.reduce((sum, r) => sum + (r.phase1Score || 0), 0);
        const totalP2 = studentRecords.reduce((sum, r) => sum + (r.phase2Score || 0), 0);
        const totalScore = totalP1 + totalP2;
        const percentage = maxPossible > 0 ? ((totalScore / maxPossible) * 100).toFixed(1) : '0.0';
        return {
          name: student.name,
          matricNumber: student.matricNumber || '',
          department: student.department || 'N/A',
          level: student.level || 'N/A',
          sessionsAttended: attendedSessionIds.size,
          totalSessions: totalEndedSessions,
          phase1Score: totalP1,
          phase2Score: totalP2,
          totalScore,
          maxPossible,
          percentage: percentage + '%'
        };
      });

      reportData.sort((a, b) => a.name.localeCompare(b.name));

      const headers = ['Student Name', 'Matric No', 'Dept', 'Level', 'Attended', 'Total', 'P1', 'P2', 'Score', 'Max', '%'];
      const rows = reportData.map(r => [
        r.name, r.matricNumber, r.department, r.level,
        r.sessionsAttended, r.totalSessions,
        r.phase1Score, r.phase2Score, r.totalScore, r.maxPossible, r.percentage
      ]);

      downloadPDF({
        title: 'Combined Semester Report',
        courseCode: course.courseCode,
        courseTitle: course.courseTitle,
        lecturerName: course.lecturerName,
        date: `${totalEndedSessions} sessions`,
        headers,
        rows,
        filename: `${course.courseCode}_Combined_Report.pdf`,
      });
    } catch (error) {
      console.error('Error generating combined PDF:', error);
    } finally {
      setDownloading(null);
    }
  };

  // --- Individual Session Quick Download ---
  const handleDownloadSession = async (e: React.MouseEvent, session: Session) => {
    e.preventDefault();
    e.stopPropagation();
    if (!course) return;
    setDownloading(session.sessionId);
    try {
      const records = await getSessionAttendance(session.sessionId);
      const attendedIds = new Set(records.filter(r => r.phase1Score > 0 || r.phase2Score > 0).map(r => r.studentId));
      const attended = records.filter(r => attendedIds.has(r.studentId)).sort((a, b) => a.studentName.localeCompare(b.studentName));
      const absent = students.filter(s => !attendedIds.has(s.userId)).sort((a, b) => a.name.localeCompare(b.name));

      const headers = ['S/N', 'Student Name', 'Matric No', 'Phase 1', 'Phase 2', 'Total', 'Status'];
      const rows: (string | number)[][] = [];
      let sn = 1;
      attended.forEach(a => rows.push([sn++, a.studentName, a.matricNumber, a.phase1Score, a.phase2Score, a.totalScore, 'Present']));
      absent.forEach(s => rows.push([sn++, s.name, s.matricNumber || '', 0, 0, 0, 'Absent']));

      const dateStr = formatDate(session.createdAt).replace(/,?\s+/g, '_');
      downloadCSV(`${course.courseCode}_Session_${dateStr}.csv`, headers, rows);
    } catch (error) {
      console.error('Error generating session report:', error);
    } finally {
      setDownloading(null);
    }
  };

  if (isLoading) {
    return (
      <div className="bg-background">
        <TopAppBar title="Reports" showBack={true} />
        <main className="px-5 pt-6 max-w-lg mx-auto flex justify-center mt-20">
          <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin" />
        </main>
      </div>
    );
  }

  return (
    <div className="bg-background">
      <TopAppBar title="Reports" showBack={true} />

      <main className="px-5 pt-6 max-w-lg mx-auto pb-8">
        {/* Course header */}
        {course && (
          <div className="mb-6">
            <h1 className="text-2xl font-bold text-on-surface">{course.courseCode}</h1>
            <p className="text-sm text-on-surface-variant">{course.courseTitle}</p>
          </div>
        )}

        {/* Combined Semester Report */}
        <div className="mb-8">
          <div className="flex items-center gap-2 mb-3">
            <span className="material-symbols-outlined text-lg text-primary">summarize</span>
            <h2 className="font-bold text-on-surface">Combined Semester Report</h2>
          </div>
          <p className="text-xs text-on-surface-variant mb-3">Download a single report covering all sessions for this course</p>
          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={handleDownloadCombined}
              disabled={downloading !== null || sessions.filter(s => s.status === 'ended').length === 0}
              className="h-14 bg-primary-container text-on-primary-container rounded-2xl font-semibold flex items-center justify-center gap-2 active:scale-95 transition-all disabled:opacity-50"
            >
              {downloading === 'combined' ? (
                <div className="w-5 h-5 border-2 border-on-primary-container border-t-transparent rounded-full animate-spin" />
              ) : (
                <span className="material-symbols-outlined text-lg">table_view</span>
              )}
              <span className="text-sm">CSV Report</span>
            </button>
            <button
              onClick={handleDownloadCombinedPDF}
              disabled={downloading !== null || sessions.filter(s => s.status === 'ended').length === 0}
              className="h-14 bg-error-container text-on-error-container rounded-2xl font-semibold flex items-center justify-center gap-2 active:scale-95 transition-all disabled:opacity-50"
            >
              {downloading === 'combined_pdf' ? (
                <div className="w-5 h-5 border-2 border-on-error-container border-t-transparent rounded-full animate-spin" />
              ) : (
                <span className="material-symbols-outlined text-lg">picture_as_pdf</span>
              )}
              <span className="text-sm">PDF Report</span>
            </button>
          </div>
        </div>

        {/* Sessions List */}
        <div>
          <h2 className="font-bold text-on-surface mb-4">Individual Sessions</h2>

          {sessions.length === 0 ? (
            <div className="bg-surface-container-lowest rounded-2xl p-12 text-center card-shadow">
              <span className="material-symbols-outlined text-outline text-5xl mb-3 block">assignment</span>
              <p className="text-sm text-on-surface-variant">No sessions yet</p>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {sessions.map(s => (
                <div key={s.sessionId} className="flex items-center gap-2 bg-surface-container-lowest rounded-2xl card-shadow border border-outline-variant/20 hover:border-primary/40 transition-all">
                  <Link href={`/lecturer/sessions/${s.sessionId}`} className="flex-1 p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium text-on-surface text-sm">{formatDate(s.createdAt)}</p>
                        <p className="text-xs text-on-surface-variant mt-1">{s.classroomName}</p>
                      </div>
                      <span className={`text-xs px-2.5 py-1 rounded-full font-semibold ${
                        s.status === 'ended' ? 'bg-surface-container-high text-on-surface-variant' : 'bg-primary-container text-on-primary-container'
                      }`}>
                        {s.status === 'ended' ? 'Ended' : 'Active'}
                      </span>
                    </div>
                  </Link>
                  {s.status === 'ended' && (
                    <div className="relative mr-2 shrink-0">
                      <button
                        onClick={(e) => { e.preventDefault(); e.stopPropagation(); setOpenDropdown(openDropdown === s.sessionId ? null : s.sessionId); }}
                        disabled={downloading !== null}
                        className="w-10 h-10 rounded-full flex items-center justify-center text-primary hover:bg-primary-container/30 active:scale-95 transition-all disabled:opacity-40"
                        title="Download Report"
                      >
                        {downloading === s.sessionId || downloading === s.sessionId + '_pdf' ? (
                          <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                        ) : (
                          <span className="material-symbols-outlined text-lg">download</span>
                        )}
                      </button>
                      {openDropdown === s.sessionId && (
                        <div className="absolute right-0 top-11 bg-surface-container-lowest rounded-xl shadow-lg border border-outline-variant/30 z-50 overflow-hidden w-40">
                          <button
                            onClick={(e) => { setOpenDropdown(null); handleDownloadSession(e, s); }}
                            className="w-full px-4 py-2.5 text-left text-sm text-on-surface hover:bg-surface-container-low flex items-center gap-2 transition-colors"
                          >
                            <span className="material-symbols-outlined text-base text-primary">table_view</span>
                            CSV
                          </button>
                          <div className="border-t border-outline-variant/20" />
                          <button
                            onClick={async (e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              setOpenDropdown(null);
                              if (!course) return;
                              setDownloading(s.sessionId + '_pdf');
                              try {
                                const records = await getSessionAttendance(s.sessionId);
                                const attendedIds = new Set(records.filter(r => r.phase1Score > 0 || r.phase2Score > 0).map(r => r.studentId));
                                const attended = records.filter(r => attendedIds.has(r.studentId)).sort((a, b) => a.studentName.localeCompare(b.studentName));
                                const absent = students.filter(st => !attendedIds.has(st.userId)).sort((a, b) => a.name.localeCompare(b.name));
                                const headers = ['S/N', 'Student Name', 'Matric No', 'Phase 1', 'Phase 2', 'Total', 'Status'];
                                const rows: (string | number)[][] = [];
                                let sn = 1;
                                attended.forEach(a => rows.push([sn++, a.studentName, a.matricNumber, a.phase1Score, a.phase2Score, a.totalScore, 'Present']));
                                absent.forEach(st => rows.push([sn++, st.name, st.matricNumber || '', 0, 0, 0, 'Absent']));
                                const dateStr = formatDate(s.createdAt).replace(/,?\s+/g, '_');
                                downloadPDF({
                                  title: 'Session Attendance Report — Full',
                                  courseCode: course.courseCode,
                                  courseTitle: course.courseTitle,
                                  date: formatDate(s.createdAt),
                                  headers,
                                  rows,
                                  filename: `${course.courseCode}_${dateStr}_Full.pdf`,
                                });
                              } catch (err) { console.error('PDF download failed:', err); }
                              finally { setDownloading(null); }
                            }}
                            className="w-full px-4 py-2.5 text-left text-sm text-on-surface hover:bg-surface-container-low flex items-center gap-2 transition-colors"
                          >
                            <span className="material-symbols-outlined text-base text-error">picture_as_pdf</span>
                            PDF
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </main>

      {/* Click-outside handler for dropdowns */}
      {openDropdown && (
        <div className="fixed inset-0 z-40" onClick={() => setOpenDropdown(null)} />
      )}
    </div>
  );
}
