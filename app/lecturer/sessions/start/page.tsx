'use client';
import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuthStore } from '@/store/auth.store';
import TopAppBar from '@/components/layout/TopAppBar';
import { getCourseById } from '@/lib/firebase/courses.service';
import { getClassrooms } from '@/lib/firebase/classrooms.service';
import { startSession } from '@/lib/firebase/sessions.service';
import { Course, Classroom } from '@/types';

export default function StartSessionPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const courseId = searchParams.get('courseId') || '';
  const { user } = useAuthStore();
  const [course, setCourse] = useState<Course | null>(null);
  const [classrooms, setClassrooms] = useState<Classroom[]>([]);
  const [selectedClassroom, setSelectedClassroom] = useState<Classroom | null>(null);
  const [totalDuration, setTotalDuration] = useState(60);
  const [phase1Duration, setPhase1Duration] = useState(15);
  const [phase2Duration, setPhase2Duration] = useState(15);
  const [starting, setStarting] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    Promise.all([getCourseById(courseId), getClassrooms()])
      .then(([c, cl]) => { 
        setCourse(c); 
        setClassrooms(cl); 
        if (c?.defaultDuration) setTotalDuration(c.defaultDuration);
      })
      .catch(console.error)
      .finally(() => setIsLoading(false));
  }, [courseId]);

  const handleStart = async () => {
    if (!selectedClassroom) { setError('Please select a classroom'); return; }
    if (phase1Duration + phase2Duration >= totalDuration) {
      setError('Total class duration must be larger than Phase 1 + Phase 2 durations combined to allow for a waiting period.');
      return;
    }
    if (!course || !user) return;
    setStarting(true); setError('');
    try {
      const session = await startSession({
        courseId: course.courseId,
        courseTitle: course.courseTitle,
        courseCode: course.courseCode,
        lecturerId: user.userId,
        classroomId: selectedClassroom.classroomId,
        classroomName: selectedClassroom.name,
        classroomLat: selectedClassroom.latitude,
        classroomLng: selectedClassroom.longitude,
        classroomRadius: selectedClassroom.radius,
        totalDuration,
        phase1Duration,
        phase2Duration,
      });
      router.push(`/lecturer/sessions/${session.sessionId}`);
    } catch (e: any) { setError(e.message || 'Failed to start session'); }
    finally { setStarting(false); }
  };

  if (isLoading) return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin" />
    </div>
  );

  const durations = [5, 10, 15, 20, 30, 45, 60];

  return (
    <div className="bg-background">
      <TopAppBar title="Start Session" showBack />
      <main className="px-5 pt-6 max-w-lg mx-auto pb-8">

        {course && (
          <div className="bg-primary-container/20 rounded-2xl p-4 mb-6 border border-primary/20">
            <p className="text-xs font-bold text-primary uppercase tracking-wider mb-1">{course.courseCode}</p>
            <h2 className="text-lg font-bold text-on-surface">{course.courseTitle}</h2>
          </div>
        )}

        {error && <div className="mb-4 p-3 bg-error-container rounded-lg text-sm text-on-error-container">{error}</div>}

        <section className="mb-6">
          <h3 className="text-sm font-semibold text-on-surface-variant uppercase tracking-wider mb-3">Select Classroom</h3>
          {classrooms.length === 0 ? (
            <div className="bg-surface-container-lowest rounded-2xl p-6 text-center card-shadow">
              <span className="material-symbols-outlined text-outline text-3xl mb-2 block">location_off</span>
              <p className="text-sm text-on-surface-variant">No classrooms set up yet</p>
              <button onClick={() => router.push('/lecturer/classrooms')}
                className="text-sm text-primary font-semibold mt-2">Add a classroom →</button>
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              {classrooms.map(room => (
                <button key={room.classroomId}
                  onClick={() => setSelectedClassroom(room)}
                  className={`w-full p-4 rounded-2xl border-2 text-left transition-all active:scale-95 ${selectedClassroom?.classroomId === room.classroomId ? 'border-primary bg-primary/5' : 'border-outline-variant bg-surface-container-lowest'}`}>
                  <div className="flex items-center gap-3">
                    <span className="material-symbols-outlined text-primary" style={{fontVariationSettings: selectedClassroom?.classroomId === room.classroomId ? "'FILL' 1" : "'FILL' 0"}}>location_on</span>
                    <div>
                      <p className="text-sm font-semibold text-on-surface">{room.name}</p>
                      <p className="text-xs text-on-surface-variant">{room.radius}m radius</p>
                    </div>
                    {selectedClassroom?.classroomId === room.classroomId && (
                      <span className="material-symbols-outlined text-primary ml-auto" style={{fontVariationSettings:"'FILL' 1"}}>check_circle</span>
                    )}
                  </div>
                </button>
              ))}
            </div>
          )}
        </section>

        <section className="mb-6">
          <h3 className="text-sm font-semibold text-on-surface-variant uppercase tracking-wider mb-3">Total Class Duration</h3>
          <div className="flex gap-2 flex-wrap">
            {[15, 30, 45, 60, 90, 120].map(d => (
              <button key={`total-${d}`} onClick={() => setTotalDuration(d)}
                className={`px-4 h-9 rounded-full text-xs font-semibold border transition-all active:scale-95 ${totalDuration === d ? 'bg-primary-container text-on-primary-container border-primary-container' : 'bg-surface-container-low text-on-surface-variant border-outline-variant'}`}>
                {d} min
              </button>
            ))}
          </div>
        </section>

        <section className="mb-6">
          <h3 className="text-sm font-semibold text-on-surface-variant uppercase tracking-wider mb-3">Phase 1 Duration (Check-in)</h3>
          <div className="flex gap-2 flex-wrap">
            {durations.map(d => (
              <button key={d} onClick={() => setPhase1Duration(d)}
                className={`px-4 h-9 rounded-full text-xs font-semibold border transition-all active:scale-95 ${phase1Duration === d ? 'bg-primary-container text-on-primary-container border-primary-container' : 'bg-surface-container-low text-on-surface-variant border-outline-variant'}`}>
                {d} min
              </button>
            ))}
          </div>
        </section>

        <section className="mb-8">
          <h3 className="text-sm font-semibold text-on-surface-variant uppercase tracking-wider mb-3">Phase 2 Duration (Check-out)</h3>
          <div className="flex gap-2 flex-wrap">
            {durations.map(d => (
              <button key={d} onClick={() => setPhase2Duration(d)}
                className={`px-4 h-9 rounded-full text-xs font-semibold border transition-all active:scale-95 ${phase2Duration === d ? 'bg-primary-container text-on-primary-container border-primary-container' : 'bg-surface-container-low text-on-surface-variant border-outline-variant'}`}>
                {d} min
              </button>
            ))}
          </div>
        </section>

        <button onClick={handleStart} disabled={starting || !selectedClassroom}
          className="w-full h-14 bg-primary-container text-on-primary-container rounded-full text-base font-semibold disabled:opacity-60 active:scale-95 transition-all flex items-center justify-center gap-2">
          {starting ? (
            <><div className="w-5 h-5 border-2 border-on-primary-container border-t-transparent rounded-full animate-spin" />Starting session...</>
          ) : (
            <><span className="material-symbols-outlined" style={{fontVariationSettings:"'FILL' 1"}}>play_arrow</span>Start Attendance Session</>
          )}
        </button>
      </main>
    </div>
  );
}
