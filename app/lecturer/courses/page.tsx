'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useAuthStore } from '@/store/auth.store';
import { getLecturerCourses, deleteCourse, createCourse } from '@/lib/firebase/courses.service';
import TopAppBar from '@/components/layout/TopAppBar';
import { Course } from '@/types';

export default function LecturerCoursesPage() {
  const { user } = useAuthStore();
  const [courses, setCourses] = useState<Course[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [creating, setCreating] = useState(false);
  const [formError, setFormError] = useState('');
  const [form, setForm] = useState({ courseTitle: '', courseCode: '', defaultDuration: 60, phase1Marks: 3, phase2Marks: 2 });
  const durations = [30, 45, 60, 90, 120];

  const load = async () => {
    if (!user?.userId) return;
    setIsLoading(true);
    try { setCourses(await getLecturerCourses(user.userId)); }
    catch (e) { console.error(e); }
    finally { setIsLoading(false); }
  };

  useEffect(() => { load(); }, [user?.userId]);

  const handleCreate = async () => {
    if (!form.courseTitle.trim()) { setFormError('Course title is required'); return; }
    if (form.courseCode.length !== 6) { setFormError('Course code must be 6 characters'); return; }
    if (!user) return;
    setCreating(true); setFormError('');
    try {
      await createCourse({ courseTitle: form.courseTitle, courseCode: form.courseCode, lecturerId: user.userId, lecturerName: user.name, defaultDuration: form.defaultDuration, phase1Marks: form.phase1Marks, phase2Marks: form.phase2Marks });
      setShowModal(false);
      setForm({ courseTitle: '', courseCode: '', defaultDuration: 60, phase1Marks: 3, phase2Marks: 2 });
      await load();
    } catch (e: any) { setFormError(e.message || 'Failed to create course'); }
    finally { setCreating(false); }
  };

  return (
    <div className="bg-background">
      <TopAppBar title="My Courses" />
      <main className="px-5 pt-6 max-w-lg mx-auto pb-8">

        <div className="flex items-center justify-between mb-6">
          <p className="text-sm text-on-surface-variant">{courses.length} course{courses.length !== 1 ? 's' : ''}</p>
          <button onClick={() => setShowModal(true)}
            className="flex items-center gap-1 bg-primary-container text-on-primary-container text-xs font-semibold px-4 h-10 rounded-full active:scale-95 transition-all">
            <span className="material-symbols-outlined text-lg">add</span>
            New Course
          </button>
        </div>

        {isLoading ? (
          <div className="flex justify-center py-16"><div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" /></div>
        ) : courses.length === 0 ? (
          <div className="bg-surface-container-lowest rounded-2xl p-12 text-center card-shadow">
            <span className="material-symbols-outlined text-outline text-5xl mb-3 block">menu_book</span>
            <p className="text-base font-semibold text-on-surface">No courses yet</p>
            <p className="text-sm text-on-surface-variant mt-1 mb-4">Create your first course to start taking attendance</p>
            <button onClick={() => setShowModal(true)}
              className="bg-primary-container text-on-primary-container text-sm font-semibold px-6 h-10 rounded-full active:scale-95 transition-all">
              Create Course
            </button>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {courses.map((course) => (
              <div key={course.courseId} className="bg-surface-container-lowest rounded-2xl p-4 card-shadow border border-outline-variant/20 relative overflow-hidden">
                <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-primary" />
                <div className="pl-4 flex items-center justify-between gap-3">
                  <div className="flex-1">
                    <span className="text-xs font-bold text-primary bg-primary/10 px-2 py-0.5 rounded-full">{course.courseCode}</span>
                    <h3 className="text-base font-semibold text-on-surface mt-1">{course.courseTitle}</h3>
                    <p className="text-xs text-on-surface-variant mt-0.5 flex items-center gap-1">
                      <span className="material-symbols-outlined text-base">schedule</span>
                      {course.defaultDuration} min sessions
                    </p>
                  </div>
                  <Link href={`/lecturer/courses/${course.courseId}`}
                    className="flex items-center justify-center w-10 h-10 rounded-full bg-surface-container-high text-primary active:scale-95 transition-all">
                    <span className="material-symbols-outlined">chevron_right</span>
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      {/* Create Modal */}
      {showModal && (
        <div 
          className="fixed inset-0 bg-black/50 z-[100] flex items-end justify-center"
          onClick={() => setShowModal(false)}
        >
          <div 
            className="bg-surface-container-lowest rounded-t-3xl w-full max-w-lg flex flex-col" 
            style={{maxHeight: '90vh'}}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Handle bar */}
            <div className="flex-shrink-0 pt-3 pb-2 flex justify-center">
              <div className="w-12 h-1 bg-outline-variant rounded-full" />
            </div>
            {/* Scrollable content */}
            <div className="overflow-y-auto px-6 pb-24">
              <h2 className="text-xl font-bold text-on-surface mb-5">New Course</h2>
              {formError && <div className="mb-4 p-3 bg-error-container rounded-lg text-sm text-on-error-container">{formError}</div>}
              <div className="flex flex-col gap-4">
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-semibold text-on-surface-variant">Course Title</label>
                  <input value={form.courseTitle} onChange={e => setForm({...form, courseTitle: e.target.value})}
                    placeholder="e.g. Introduction to Computer Science"
                    className="w-full h-12 px-4 bg-surface-container-low border border-outline-variant rounded-lg text-sm text-on-surface placeholder:text-outline/50 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary"
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-semibold text-on-surface-variant">Course Code</label>
                  <input value={form.courseCode} onChange={e => setForm({...form, courseCode: e.target.value.toUpperCase()})}
                    placeholder="e.g. CSC411"
                    className="w-full h-12 px-4 bg-surface-container-low border border-outline-variant rounded-lg text-sm font-mono text-on-surface focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary"
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <label className="text-xs font-semibold text-on-surface-variant">Default Session Duration</label>
                  <div className="flex gap-2 flex-wrap">
                    {durations.map(d => (
                      <button key={d} onClick={() => setForm({...form, defaultDuration: d})}
                        className={`px-4 h-9 rounded-full text-xs font-semibold border transition-all active:scale-95 ${form.defaultDuration === d ? 'bg-primary-container text-on-primary-container border-primary-container' : 'bg-surface-container-low text-on-surface-variant border-outline-variant'}`}>
                        {d} min
                      </button>
                    ))}
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="flex flex-col gap-1">
                    <label className="text-xs font-semibold text-on-surface-variant">Phase 1 Marks</label>
                    <input type="number" min="0" step="0.5" value={form.phase1Marks} onChange={e => setForm({...form, phase1Marks: Number(e.target.value)})}
                      className="w-full h-12 px-4 bg-surface-container-low border border-outline-variant rounded-lg text-sm text-on-surface focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary"
                    />
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="text-xs font-semibold text-on-surface-variant">Phase 2 Marks</label>
                    <input type="number" min="0" step="0.5" value={form.phase2Marks} onChange={e => setForm({...form, phase2Marks: Number(e.target.value)})}
                      className="w-full h-12 px-4 bg-surface-container-low border border-outline-variant rounded-lg text-sm text-on-surface focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary"
                    />
                  </div>
                </div>
                <div className="flex gap-3 mt-2">
                  <button onClick={() => {setShowModal(false); setFormError('');}}
                    className="flex-1 h-12 border border-outline-variant rounded-full text-sm text-on-surface-variant active:scale-95">Cancel</button>
                  <button onClick={handleCreate} disabled={creating}
                    className="flex-1 h-12 bg-primary-container text-on-primary-container rounded-full text-sm font-semibold disabled:opacity-60 active:scale-95 flex items-center justify-center gap-2">
                    {creating ? <><div className="w-4 h-4 border-2 border-on-primary-container border-t-transparent rounded-full animate-spin" />Creating...</> : 'Create Course'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
