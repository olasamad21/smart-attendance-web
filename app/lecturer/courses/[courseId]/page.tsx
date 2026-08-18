'use client';
import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Users, Clock, Play, BarChart2, FileText, Trash2, Edit2 } from 'lucide-react';
import { useAuthStore } from '@/store/auth.store';
import { getCourseById, getEnrolledStudents, deleteCourse, updateCourseSettingsWithRetroactiveScoring } from '@/lib/firebase/courses.service';
import { getSessionsForCourse } from '@/lib/firebase/sessions.service';
import { getSessionAttendance } from '@/lib/firebase/attendance.service';
import { downloadCSV } from '@/lib/utils/csv.utils';
import { Course, UserProfile, Session } from '@/types';
import TopAppBar from '@/components/layout/TopAppBar';

export default function CourseDetailPage() {
  const { courseId } = useParams<{ courseId: string }>();
  const router = useRouter();
  const { user } = useAuthStore();
  const [course, setCourse] = useState<Course | null>(null);
  const [students, setStudents] = useState<UserProfile[]>([]);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [editingCourse, setEditingCourse] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [editData, setEditData] = useState({ courseTitle: '', courseCode: '', defaultDuration: 60, phase1Marks: 3, phase2Marks: 2 });

  useEffect(() => {
    if (!courseId) return;
    setIsLoading(true);
    
    Promise.all([
      getCourseById(courseId).catch(() => null),
      getEnrolledStudents(courseId).catch(() => []),
    ]).then(([courseData, studentData]) => {
      setCourse(courseData);
      setStudents(studentData as any);
      if (courseData) {
        setEditData({
          courseTitle: courseData.courseTitle || '',
          courseCode: courseData.courseCode || '',
          defaultDuration: courseData.defaultDuration || 60,
          phase1Marks: courseData.phase1Marks ?? 3,
          phase2Marks: courseData.phase2Marks ?? 2
        });
      }
    }).finally(() => setIsLoading(false));

    // Load sessions separately so index error doesn't break the page
    getSessionsForCourse(courseId)
      .then(setSessions)
      .catch(e => console.warn('Sessions not loaded:', e));
      
  }, [courseId]);

  const handleStartSession = () => {
    if (!course) return;
    router.push(`/lecturer/sessions/start?courseId=${course.courseId}`);
  };

  const handleUpdateCourseSettings = async () => {
    if (!course) return;
    try {
      await updateCourseSettingsWithRetroactiveScoring(course.courseId, editData, !course.marksEdited);
      setCourse({ ...course, ...editData, marksEdited: course.marksEdited || !course.marksEdited });
      setEditingCourse(false);
    } catch (err) {
      console.error(err);
    }
  };

  const handleDelete = async () => {
    if (!course) return;
    if (!confirm(`Delete "${course.courseTitle}"? This cannot be undone.`)) return;
    try {
      await deleteCourse(course.courseId);
      router.push('/lecturer/courses');
    } catch (err) {
      console.error(err);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-96">
        <div className="w-10 h-10 border-4 border-[#2D6A4F] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!course) {
    return (
      <div className="text-center py-20">
        <p className="text-gray-500">Course not found</p>
        <Link href="/lecturer/courses" className="text-[#2D6A4F] mt-2 inline-block">Go back</Link>
      </div>
    );
  }

  const durations = [30, 45, 60, 90, 120];

  return (
    <div className="bg-background pb-8">
      <TopAppBar 
        title={course.courseCode} 
        showBack={true} 
      />
      
      <main className="px-5 pt-6 max-w-lg mx-auto">
        {/* Course Info Card */}
        <div className="bg-surface-container-lowest rounded-2xl p-6 card-shadow mb-6">
          <div className="flex justify-between items-start mb-4">
            <div>
              <h1 className="text-2xl font-bold text-on-surface">{course.courseTitle}</h1>
              <p className="text-sm text-on-surface-variant mt-1">Lecturer: {course.lecturerName}</p>
            </div>
            <button onClick={handleDelete} className="text-error hover:bg-error-container/50 p-2 rounded-full transition-all">
              <span className="material-symbols-outlined text-[20px]">delete</span>
            </button>
          </div>

          {course.enrollmentKey && (
            <div className={`mb-4 bg-secondary-container/20 border border-secondary-container/50 rounded-xl px-3 flex items-center justify-between transition-all duration-300 ${showPassword ? 'py-3' : 'py-2'}`}>
              <div className="flex-1 overflow-hidden flex flex-col justify-center">
                <div className="flex items-center gap-2">
                  <p className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider">Course Password</p>
                  <button 
                    onClick={() => setShowPassword(!showPassword)}
                    className="text-on-surface-variant hover:text-on-surface active:scale-95 transition-all flex items-center justify-center"
                  >
                    <span className="material-symbols-outlined text-[16px]">{showPassword ? 'visibility_off' : 'visibility'}</span>
                  </button>
                </div>
                {showPassword && (
                  <p className="text-lg font-mono font-bold text-on-surface tracking-widest mt-0.5 animate-in fade-in slide-in-from-top-1 duration-200">{course.enrollmentKey}</p>
                )}
              </div>
              <button 
                onClick={() => {
                  navigator.clipboard.writeText(course.enrollmentKey || '');
                  alert('Password copied to clipboard!');
                }}
                className="w-10 h-10 rounded-full bg-secondary-container text-on-secondary-container flex items-center justify-center hover:brightness-95 active:scale-95 transition-all shrink-0"
                title="Copy Password"
              >
                <span className="material-symbols-outlined text-[18px]">content_copy</span>
              </button>
            </div>
          )}
          
          <div className="flex flex-wrap gap-2">
            <Link href={`/lecturer/courses/${course.courseId}/students`} className="bg-primary-container px-4 py-1.5 rounded-full flex items-center gap-2 border border-primary/20 hover:brightness-95 transition-all active:scale-95">
              <span className="material-symbols-outlined text-[16px] text-on-primary-container">group</span>
              <span className="text-xs font-bold text-on-primary-container">{students.length} Students</span>
            </Link>
            <div className="bg-surface-container-low px-3 py-1.5 rounded-full flex items-center gap-1.5 border border-outline-variant/30">
              <span className="material-symbols-outlined text-[16px] text-on-surface-variant">schedule</span>
              <span className="text-xs font-medium text-on-surface">{course.defaultDuration} min</span>
            </div>
            <div className="bg-surface-container-low px-3 py-1.5 rounded-full flex items-center gap-1.5 border border-outline-variant/30">
              <span className="material-symbols-outlined text-[16px] text-on-surface-variant">assignment</span>
              <span className="text-xs font-medium text-on-surface">{sessions.length} Sessions</span>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <button
          onClick={handleStartSession}
          className="w-full h-14 bg-primary-container text-on-primary-container rounded-2xl font-semibold flex items-center justify-center gap-2 mb-4 active:scale-95 transition-all"
        >
          <span className="material-symbols-outlined">play_arrow</span>
          Start Attendance Session
        </button>

        <div className="grid grid-cols-3 gap-3 mb-8">
          <Link
            href={`/lecturer/courses/${course.courseId}/reports`}
            className="h-14 bg-surface-container-lowest border border-outline-variant rounded-2xl p-3 flex items-center justify-center gap-1.5 text-on-surface active:scale-95 transition-all card-shadow"
          >
            <span className="material-symbols-outlined text-lg">description</span>
            <span className="text-xs font-semibold">Reports</span>
          </Link>
          <Link
            href={`/lecturer/courses/${course.courseId}/statistics`}
            className="h-14 bg-surface-container-lowest border border-outline-variant rounded-2xl p-3 flex items-center justify-center gap-1.5 text-on-surface active:scale-95 transition-all card-shadow"
          >
            <span className="material-symbols-outlined text-lg">bar_chart</span>
            <span className="text-xs font-semibold">Statistics</span>
          </Link>
          <button
            onClick={() => setEditingCourse(true)}
            className="h-14 bg-surface-container-lowest border border-outline-variant rounded-2xl p-3 flex items-center justify-center gap-1.5 text-on-surface active:scale-95 transition-all card-shadow"
          >
            <span className="material-symbols-outlined text-lg">edit</span>
            <span className="text-xs font-semibold">Settings</span>
          </button>
        </div>



        {/* Recent Sessions */}
        {sessions.length > 0 && (
          <div className="bg-surface-container-lowest rounded-2xl p-6 card-shadow">
            <h2 className="font-bold text-on-surface mb-4">Recent Sessions</h2>
            <div className="flex flex-col gap-3">
              {sessions.slice(0, 3).map(s => (
                <div key={s.sessionId} className="flex items-center gap-2 border border-outline-variant/30 rounded-xl hover:border-primary/50 transition-all">
                  <Link href={`/lecturer/sessions/${s.sessionId}`} className="flex-1 p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium text-on-surface text-sm">
                          {s.createdAt ? new Date((s.createdAt as any).seconds ? (s.createdAt as any).seconds * 1000 : s.createdAt).toLocaleDateString() : 'Unknown Date'}
                        </p>
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
                    <button
                      onClick={async (e) => {
                        e.stopPropagation();
                        try {
                          const records = await getSessionAttendance(s.sessionId);
                          const enrolled = students;
                          const attendedIds = new Set(records.filter(r => r.phase1Score > 0 || r.phase2Score > 0).map(r => r.studentId));
                          const attended = records.filter(r => attendedIds.has(r.studentId)).sort((a, b) => a.studentName.localeCompare(b.studentName));
                          const absent = enrolled.filter(st => !attendedIds.has(st.userId)).sort((a, b) => a.name.localeCompare(b.name));
                          const headers = ['S/N', 'Student Name', 'Matric No', 'Phase 1', 'Phase 2', 'Total', 'Status'];
                          const rows: (string | number)[][] = [];
                          let sn = 1;
                          attended.forEach(a => rows.push([sn++, a.studentName, a.matricNumber, a.phase1Score, a.phase2Score, a.totalScore, 'Present']));
                          absent.forEach(st => rows.push([sn++, st.name, st.matricNumber || '', 0, 0, 0, 'Absent']));
                          const date = s.createdAt ? new Date((s.createdAt as any).seconds ? (s.createdAt as any).seconds * 1000 : s.createdAt).toLocaleDateString().replace(/\//g, '-') : 'session';
                          downloadCSV(`${course.courseCode}_${date}_Full.csv`, headers, rows);
                        } catch (err) { console.error('Download failed:', err); }
                      }}
                      className="w-10 h-10 rounded-full flex items-center justify-center text-primary hover:bg-primary-container/30 active:scale-95 transition-all mr-2 shrink-0"
                      title="Quick Download Report"
                    >
                      <span className="material-symbols-outlined text-lg">download</span>
                    </button>
                  )}
                </div>
              ))}
            </div>
            {sessions.length > 3 && (
              <div className="mt-4 text-center">
                <Link href={`/lecturer/courses/${course.courseId}/reports`} className="text-sm font-medium text-primary hover:underline">
                  View All Sessions
                </Link>
              </div>
            )}
          </div>
        )}
      </main>

      {/* Edit Course Settings modal */}
      {editingCourse && (
        <div 
          className="fixed inset-0 bg-black/50 z-[100] flex items-end justify-center"
          onClick={() => setEditingCourse(false)}
        >
          <div 
            className="bg-surface-container-lowest rounded-t-3xl w-full max-w-lg flex flex-col" 
            style={{maxHeight: '90vh'}}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex-shrink-0 pt-3 pb-2 flex justify-center">
              <div className="w-12 h-1 bg-outline-variant rounded-full" />
            </div>
            <div className="overflow-y-auto px-6 pb-10">
              <h3 className="font-bold text-on-surface mb-4 text-xl">Edit Course Settings</h3>
              
              <div className="mb-4">
                <label className="block text-xs font-medium text-on-surface-variant mb-1">Course Title</label>
                <input
                  type="text"
                  value={editData.courseTitle}
                  onChange={(e) => setEditData({...editData, courseTitle: e.target.value})}
                  className="w-full h-12 bg-surface-container-low border border-outline-variant rounded-xl px-4 text-on-surface text-sm focus:border-primary focus:outline-none transition-all"
                />
              </div>

              <div className="mb-4">
                <label className="block text-xs font-medium text-on-surface-variant mb-1">Course Code</label>
                <input
                  type="text"
                  value={editData.courseCode}
                  onChange={(e) => setEditData({...editData, courseCode: e.target.value})}
                  className="w-full h-12 bg-surface-container-low border border-outline-variant rounded-xl px-4 text-on-surface text-sm focus:border-primary focus:outline-none transition-all"
                />
              </div>

              <label className="block text-xs font-medium text-on-surface-variant mb-2">Default Duration</label>
              <div className="flex gap-2 flex-wrap mb-6">
                {durations.map((d) => (
                  <button
                    key={d}
                    onClick={() => setEditData({...editData, defaultDuration: d})}
                    className={`px-4 h-10 rounded-full text-sm font-semibold border transition-all active:scale-95 ${
                      editData.defaultDuration === d ? 'bg-primary-container text-on-primary-container border-primary-container' : 'bg-surface-container-low text-on-surface-variant border-outline-variant'
                    }`}
                  >
                    {d} min
                  </button>
                ))}
              </div>

              <div className="grid grid-cols-2 gap-4 mb-2">
                <div>
                  <label className="block text-xs font-medium text-on-surface-variant mb-1">Phase 1 Marks</label>
                  <input
                    type="number"
                    min="0"
                    step="0.5"
                    disabled={course.marksEdited}
                    value={editData.phase1Marks}
                    onChange={(e) => setEditData({...editData, phase1Marks: Number(e.target.value)})}
                    className="w-full h-12 bg-surface-container-low border border-outline-variant rounded-xl px-4 text-on-surface text-sm focus:border-primary focus:outline-none transition-all disabled:opacity-50"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-on-surface-variant mb-1">Phase 2 Marks</label>
                  <input
                    type="number"
                    min="0"
                    step="0.5"
                    disabled={course.marksEdited}
                    value={editData.phase2Marks}
                    onChange={(e) => setEditData({...editData, phase2Marks: Number(e.target.value)})}
                    className="w-full h-12 bg-surface-container-low border border-outline-variant rounded-xl px-4 text-on-surface text-sm focus:border-primary focus:outline-none transition-all disabled:opacity-50"
                  />
                </div>
              </div>
              {course.marksEdited ? (
                <p className="text-error text-xs mb-6">Marks can only be changed once to preserve fairness.</p>
              ) : (
                <div className="mb-6" />
              )}

              <div className="flex gap-3">
                <button onClick={() => setEditingCourse(false)} className="flex-1 h-12 border border-outline-variant rounded-full text-on-surface-variant text-sm font-medium active:scale-95">Cancel</button>
                <button onClick={handleUpdateCourseSettings} className="flex-1 h-12 bg-primary-container text-on-primary-container rounded-full text-sm font-bold active:scale-95">Save</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
