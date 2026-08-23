'use client';
import { useEffect, useState, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuthStore } from '@/store/auth.store';
import TopAppBar from '@/components/layout/TopAppBar';
import { getCourseById } from '@/lib/firebase/courses.service';
import { getClassrooms, createClassroom } from '@/lib/firebase/classrooms.service';
import { startSession } from '@/lib/firebase/sessions.service';
import { getCurrentPosition } from '@/lib/utils/gps.utils';
import { Course, Classroom } from '@/types';
import EmptyState from '@/components/ui/EmptyState';
import dynamic from 'next/dynamic';

const ClassroomMap = dynamic(() => import('@/components/map/ClassroomMap'), {
  ssr: false,
  loading: () => <div className="h-56 w-full bg-surface-container-low animate-pulse rounded-2xl flex items-center justify-center text-on-surface-variant text-sm">Loading Map...</div>
});

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
  const [customTotalH, setCustomTotalH] = useState('');
  const [customTotalM, setCustomTotalM] = useState('');
  const [customP1, setCustomP1] = useState('');
  const [customP2, setCustomP2] = useState('');
  const [starting, setStarting] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  // Classroom bottom sheet state
  const [showClassroomSheet, setShowClassroomSheet] = useState(false);

  // Add classroom modal state
  const [showAddClassroom, setShowAddClassroom] = useState(false);
  const [creating, setCreating] = useState(false);
  const [gettingLocation, setGettingLocation] = useState(false);
  const [classroomForm, setClassroomForm] = useState({ name: '', latitude: '', longitude: '', radius: '100' });
  const [classroomError, setClassroomError] = useState('');

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

  // Auto-fetch GPS when add classroom modal opens
  useEffect(() => {
    if (showAddClassroom && !classroomForm.latitude) {
      handleGetLocation();
    }
  }, [showAddClassroom]);

  // Compute the waiting period
  const waitingPeriod = totalDuration - phase1Duration - phase2Duration;

  const handleStart = async () => {
    if (!selectedClassroom) { setError('Please select a classroom'); return; }
    if (waitingPeriod < 1) {
      setError('Total class duration must be larger than Phase 1 + Phase 2 combined to allow a waiting period.');
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

  // Duration pill select with custom input support for phase durations
  const handleDurationSelect = (
    value: number,
    setter: (v: number) => void,
    customSetter: (v: string) => void
  ) => {
    setter(value);
    customSetter('');
  };

  const handleCustomDuration = (
    raw: string,
    setter: (v: number) => void,
    customSetter: (v: string) => void
  ) => {
    customSetter(raw);
    const num = parseInt(raw);
    if (!isNaN(num) && num > 0) {
      setter(num);
    }
  };

  // Special handlers for Total Duration (h/m format)
  const handleTotalPresetSelect = (val: number) => {
    setTotalDuration(val);
    setCustomTotalH('');
    setCustomTotalM('');
  };

  const handleCustomTotalChange = (type: 'h' | 'm', val: string) => {
    if (type === 'h') setCustomTotalH(val);
    if (type === 'm') setCustomTotalM(val);
    
    const hStr = type === 'h' ? val : customTotalH;
    const mStr = type === 'm' ? val : customTotalM;
    const h = parseInt(hStr) || 0;
    const m = parseInt(mStr) || 0;
    
    if (h > 0 || m > 0) {
      setTotalDuration((h * 60) + m);
    } else {
      setTotalDuration(0);
    }
  };

  const formatDuration = (mins: number) => {
    if (mins < 60) return `${mins}m`;
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    return m === 0 ? `${h}h` : `${h}h ${m}m`;
  };

  // Classroom creation
  async function handleGetLocation() {
    setGettingLocation(true);
    try {
      const pos = await getCurrentPosition();
      setClassroomForm(f => ({ ...f, latitude: pos.latitude.toFixed(6), longitude: pos.longitude.toFixed(6) }));
    } catch (e: any) {
      setClassroomError(e.message);
    } finally { setGettingLocation(false); }
  }

  const handleCreateClassroom = async () => {
    if (!classroomForm.name.trim()) { setClassroomError('Classroom name is required'); return; }
    if (!classroomForm.latitude || !classroomForm.longitude) { setClassroomError('Location is required'); return; }
    setCreating(true); setClassroomError('');
    try {
      const newRoom = await createClassroom({
        name: classroomForm.name,
        latitude: parseFloat(classroomForm.latitude),
        longitude: parseFloat(classroomForm.longitude),
        radius: parseInt(classroomForm.radius) || 100,
      });
      // Refresh classrooms list and auto-select the new one
      const updated = await getClassrooms();
      setClassrooms(updated);
      setSelectedClassroom(newRoom);
      setShowAddClassroom(false);
      setShowClassroomSheet(false);
      setClassroomForm({ name: '', latitude: '', longitude: '', radius: '100' });
    } catch (e: any) { setClassroomError(e.message); }
    finally { setCreating(false); }
  };

  if (isLoading) return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin" />
    </div>
  );

  const totalPresets = [15, 30, 45, 60, 90, 120];
  const phasePresets = [5, 10, 15, 20, 30, 45, 60];

  return (
    <div className="bg-background">
      <TopAppBar title="Start Session" showBack />
      <main className="px-5 pt-6 max-w-lg mx-auto pb-8">

        {/* Course Header */}
        {course && (
          <div className="bg-primary-container/20 rounded-2xl p-4 mb-6 border border-primary/20">
            <p className="text-xs font-bold text-primary uppercase tracking-wider mb-1">{course.courseCode}</p>
            <h2 className="text-lg font-bold text-on-surface">{course.courseTitle}</h2>
          </div>
        )}

        {error && <div className="mb-4 p-3 bg-error-container rounded-lg text-sm text-on-error-container">{error}</div>}

        {/* ── Classroom Selector ── */}
        <section className="mb-6">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-on-surface-variant uppercase tracking-wider">Classroom</h3>
          </div>

          {classrooms.length === 0 && !selectedClassroom ? (
            <div className="bg-surface-container-lowest rounded-2xl p-4 card-shadow border border-outline-variant/30">
              <EmptyState
                icon="location_off"
                title="No classrooms"
                description="Add a classroom to start."
                action={
                  <button onClick={() => { setShowAddClassroom(true); }}
                    className="text-sm text-primary font-semibold flex items-center gap-1 mx-auto active:scale-95">
                    <span className="material-symbols-outlined text-lg">add</span>
                    Add Classroom
                  </button>
                }
              />
            </div>
          ) : (
            <button
              onClick={() => setShowClassroomSheet(true)}
              className={`w-full p-4 rounded-2xl border-2 text-left transition-all active:scale-[0.98] flex items-center gap-3 ${
                selectedClassroom
                  ? 'border-primary bg-primary/5'
                  : 'border-outline-variant bg-surface-container-lowest'
              }`}
            >
              <span className="material-symbols-outlined text-primary text-2xl"
                style={{ fontVariationSettings: selectedClassroom ? "'FILL' 1" : "'FILL' 0" }}>
                location_on
              </span>
              <div className="flex-1 min-w-0">
                {selectedClassroom ? (
                  <>
                    <p className="text-sm font-semibold text-on-surface truncate">{selectedClassroom.name}</p>
                    <p className="text-xs text-on-surface-variant">{selectedClassroom.radius}m radius</p>
                  </>
                ) : (
                  <p className="text-sm text-on-surface-variant">Tap to select a classroom</p>
                )}
              </div>
              <span className="material-symbols-outlined text-on-surface-variant text-xl">
                {selectedClassroom ? 'swap_horiz' : 'expand_more'}
              </span>
            </button>
          )}
        </section>

        {/* ── Total Class Duration ── */}
        <section className="mb-6">
          <h3 className="text-sm font-semibold text-on-surface-variant uppercase tracking-wider mb-3">Total Class Duration</h3>
          <div className="flex gap-2 flex-wrap items-center">
            {totalPresets.map(d => (
              <button key={`total-${d}`} onClick={() => handleTotalPresetSelect(d)}
                className={`px-4 h-9 rounded-full text-xs font-semibold border transition-all active:scale-95 ${
                  totalDuration === d && !customTotalH && !customTotalM
                    ? 'bg-primary-container text-on-primary-container border-primary-container'
                    : 'bg-surface-container-low text-on-surface-variant border-outline-variant'
                }`}>
                {formatDuration(d)}
              </button>
            ))}
            
            {/* Custom Hours/Mins Input */}
            <div className={`flex items-center gap-1 border rounded-full px-3 h-9 focus-within:border-primary focus-within:ring-1 focus-within:ring-primary transition-all ${
              (customTotalH || customTotalM)
                ? 'bg-primary-container text-on-primary-container border-primary-container'
                : 'bg-surface-container-low text-on-surface-variant border-outline-variant'
            }`}>
              <input
                type="number" min="0" placeholder="0"
                value={customTotalH}
                onChange={e => handleCustomTotalChange('h', e.target.value)}
                className="w-6 text-xs font-semibold text-center bg-transparent focus:outline-none placeholder:text-current/50"
              />
              <span className="text-xs font-medium opacity-70">h</span>
              <input
                type="number" min="0" placeholder="0"
                value={customTotalM}
                onChange={e => handleCustomTotalChange('m', e.target.value)}
                className="w-6 text-xs font-semibold text-center bg-transparent focus:outline-none ml-1 placeholder:text-current/50"
              />
              <span className="text-xs font-medium opacity-70">m</span>
            </div>
          </div>
          <p className="text-xs text-on-surface-variant mt-2 flex items-center gap-1">
            <span className="material-symbols-outlined text-sm">schedule</span>
            {formatDuration(totalDuration)} total
          </p>
        </section>

        {/* ── Phase 1 Duration ── */}
        <section className="mb-6">
          <h3 className="text-sm font-semibold text-on-surface-variant uppercase tracking-wider mb-3">Phase 1 — Check-in Window</h3>
          <div className="flex gap-2 flex-wrap items-center">
            {phasePresets.map(d => (
              <button key={`p1-${d}`} onClick={() => handleDurationSelect(d, setPhase1Duration, setCustomP1)}
                className={`px-4 h-9 rounded-full text-xs font-semibold border transition-all active:scale-95 ${
                  phase1Duration === d && !customP1
                    ? 'bg-primary-container text-on-primary-container border-primary-container'
                    : 'bg-surface-container-low text-on-surface-variant border-outline-variant'
                }`}>
                {d} min
              </button>
            ))}
            <div className="relative">
              <input
                type="number"
                min="1"
                placeholder="Custom"
                value={customP1}
                onChange={(e) => handleCustomDuration(e.target.value, setPhase1Duration, setCustomP1)}
                className={`w-20 h-9 rounded-full text-xs font-semibold text-center border transition-all focus:outline-none focus:ring-1 focus:ring-primary ${
                  customP1
                    ? 'bg-primary-container text-on-primary-container border-primary-container'
                    : 'bg-surface-container-low text-on-surface-variant border-outline-variant'
                }`}
              />
            </div>
          </div>
        </section>

        {/* ── Phase 2 Duration ── */}
        <section className="mb-6">
          <h3 className="text-sm font-semibold text-on-surface-variant uppercase tracking-wider mb-3">Phase 2 — Check-out Window</h3>
          <div className="flex gap-2 flex-wrap items-center">
            {phasePresets.map(d => (
              <button key={`p2-${d}`} onClick={() => handleDurationSelect(d, setPhase2Duration, setCustomP2)}
                className={`px-4 h-9 rounded-full text-xs font-semibold border transition-all active:scale-95 ${
                  phase2Duration === d && !customP2
                    ? 'bg-primary-container text-on-primary-container border-primary-container'
                    : 'bg-surface-container-low text-on-surface-variant border-outline-variant'
                }`}>
                {d} min
              </button>
            ))}
            <div className="relative">
              <input
                type="number"
                min="1"
                placeholder="Custom"
                value={customP2}
                onChange={(e) => handleCustomDuration(e.target.value, setPhase2Duration, setCustomP2)}
                className={`w-20 h-9 rounded-full text-xs font-semibold text-center border transition-all focus:outline-none focus:ring-1 focus:ring-primary ${
                  customP2
                    ? 'bg-primary-container text-on-primary-container border-primary-container'
                    : 'bg-surface-container-low text-on-surface-variant border-outline-variant'
                }`}
              />
            </div>
          </div>
        </section>

        {/* ── Session Summary ── */}
        <section className="mb-8">
          <div className={`rounded-2xl p-4 border ${waitingPeriod >= 1 ? 'bg-surface-container-lowest border-outline-variant/30 card-shadow' : 'bg-error-container/30 border-error/30'}`}>
            <div className="flex items-center gap-2 mb-3">
              <span className="material-symbols-outlined text-on-surface-variant text-lg">summarize</span>
              <h4 className="text-xs font-bold text-on-surface-variant uppercase tracking-wider">Session Summary</h4>
            </div>
            <div className="grid grid-cols-3 gap-3 text-center">
              <div>
                <p className="text-lg font-bold text-on-surface">{phase1Duration}m</p>
                <p className="text-[10px] text-on-surface-variant uppercase font-semibold">Check-in</p>
              </div>
              <div>
                <p className={`text-lg font-bold ${waitingPeriod >= 1 ? 'text-on-surface' : 'text-error'}`}>{waitingPeriod}m</p>
                <p className="text-[10px] text-on-surface-variant uppercase font-semibold">Waiting</p>
              </div>
              <div>
                <p className="text-lg font-bold text-on-surface">{phase2Duration}m</p>
                <p className="text-[10px] text-on-surface-variant uppercase font-semibold">Check-out</p>
              </div>
            </div>
            {waitingPeriod < 1 && (
              <p className="text-xs text-error mt-3 text-center font-medium">
                ⚠ Invalid — increase total duration or decrease phase durations
              </p>
            )}
          </div>
        </section>

        {/* ── Start Button ── */}
        <button onClick={handleStart} disabled={starting || !selectedClassroom || waitingPeriod < 1}
          className="w-full h-14 bg-primary-container text-on-primary-container rounded-full text-base font-semibold disabled:opacity-60 active:scale-95 transition-all flex items-center justify-center gap-2">
          {starting ? (
            <><div className="w-5 h-5 border-2 border-on-primary-container border-t-transparent rounded-full animate-spin" />Starting session...</>
          ) : (
            <><span className="material-symbols-outlined" style={{fontVariationSettings:"'FILL' 1"}}>play_arrow</span>Start Attendance Session</>
          )}
        </button>
      </main>

      {/* ══════════ Classroom Bottom Sheet ══════════ */}
      {showClassroomSheet && (
        <div
          className="fixed inset-0 bg-black/50 z-[100] flex items-end justify-center"
          onClick={() => setShowClassroomSheet(false)}
        >
          <div
            className="bg-surface-container-lowest rounded-t-3xl w-full max-w-lg flex flex-col animate-in slide-in-from-bottom duration-300"
            style={{ maxHeight: '70vh' }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Drag handle */}
            <div className="flex-shrink-0 pt-3 pb-2 flex justify-center">
              <div className="w-12 h-1 bg-outline-variant rounded-full" />
            </div>

            {/* Header */}
            <div className="flex items-center justify-between px-6 pb-3">
              <h3 className="text-lg font-bold text-on-surface">Select Classroom</h3>
              <button
                onClick={() => { setShowClassroomSheet(false); setShowAddClassroom(true); }}
                className="flex items-center gap-1 text-xs font-semibold text-primary bg-primary/10 px-3 h-8 rounded-full active:scale-95 transition-all"
              >
                <span className="material-symbols-outlined text-base">add</span>
                New
              </button>
            </div>

            {/* Classroom list */}
            <div className="overflow-y-auto px-6 pb-8 flex flex-col gap-2">
              {classrooms.map(room => (
                <button
                  key={room.classroomId}
                  onClick={() => { setSelectedClassroom(room); setShowClassroomSheet(false); }}
                  className={`w-full p-4 rounded-2xl border-2 text-left transition-all active:scale-[0.98] flex items-center gap-3 ${
                    selectedClassroom?.classroomId === room.classroomId
                      ? 'border-primary bg-primary/5'
                      : 'border-outline-variant/50 bg-surface-container-lowest hover:border-outline-variant'
                  }`}
                >
                  <span className="material-symbols-outlined text-primary"
                    style={{ fontVariationSettings: selectedClassroom?.classroomId === room.classroomId ? "'FILL' 1" : "'FILL' 0" }}>
                    location_on
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-on-surface truncate">{room.name}</p>
                    <p className="text-xs text-on-surface-variant">{room.radius}m radius</p>
                  </div>
                  {selectedClassroom?.classroomId === room.classroomId && (
                    <span className="material-symbols-outlined text-primary" style={{ fontVariationSettings: "'FILL' 1" }}>check_circle</span>
                  )}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ══════════ Add Classroom Modal ══════════ */}
      {showAddClassroom && (
        <div
          className="fixed inset-0 bg-black/50 z-[110] flex items-end justify-center"
          onClick={() => { setShowAddClassroom(false); setClassroomError(''); }}
        >
          <div
            className="bg-surface-container-lowest rounded-t-3xl w-full max-w-lg flex flex-col animate-in slide-in-from-bottom duration-300"
            style={{ maxHeight: '90vh' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex-shrink-0 pt-3 pb-2 flex justify-center">
              <div className="w-12 h-1 bg-outline-variant rounded-full" />
            </div>
            <div className="overflow-y-auto px-6 pb-24">
              <h2 className="text-xl font-bold text-on-surface mb-5">Add Classroom</h2>
              {classroomError && (
                <div className="mb-4 p-3 bg-error-container rounded-lg text-sm text-on-error-container">
                  {classroomError}
                </div>
              )}
              <div className="flex flex-col gap-4">
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-semibold text-on-surface-variant">Classroom Name</label>
                  <input
                    value={classroomForm.name}
                    onChange={e => setClassroomForm({ ...classroomForm, name: e.target.value })}
                    placeholder="e.g. Lecture Hall 1"
                    className="w-full h-12 px-4 bg-surface-container-low border border-outline-variant rounded-lg text-sm text-on-surface focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary"
                  />
                </div>
                <button
                  onClick={handleGetLocation}
                  disabled={gettingLocation}
                  className="w-full h-12 border border-primary text-primary rounded-lg text-sm font-semibold active:scale-95 flex items-center justify-center gap-2 disabled:opacity-60"
                >
                  <span className="material-symbols-outlined text-lg">my_location</span>
                  {gettingLocation ? 'Getting location...' : 'Find My Location'}
                </button>

                <ClassroomMap
                  center={{ lat: parseFloat(classroomForm.latitude) || 0, lng: parseFloat(classroomForm.longitude) || 0 }}
                  radius={parseInt(classroomForm.radius) || 100}
                  onLocationChange={(lat, lng) => setClassroomForm(f => ({ ...f, latitude: lat.toFixed(6), longitude: lng.toFixed(6) }))}
                  onRadiusChange={(radius) => setClassroomForm(f => ({ ...f, radius: radius.toString() }))}
                />
                <div className="flex gap-3 mt-2">
                  <button
                    onClick={() => { setShowAddClassroom(false); setClassroomError(''); }}
                    className="flex-1 h-12 border border-outline-variant rounded-full text-sm text-on-surface-variant active:scale-95"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleCreateClassroom}
                    disabled={creating}
                    className="flex-1 h-12 bg-primary-container text-on-primary-container rounded-full text-sm font-semibold disabled:opacity-60 active:scale-95 flex items-center justify-center gap-2"
                  >
                    {creating ? (
                      <>
                        <div className="w-4 h-4 border-2 border-on-primary-container border-t-transparent rounded-full animate-spin" />
                        Adding...
                      </>
                    ) : 'Add Classroom'}
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
