'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/store/auth.store';
import { enrollFace, checkFaceEnrolled } from '@/lib/api/face.api';
import { useFaceTracker } from '@/hooks/useFaceTracker';
import { qualityIssues, ISSUE_HINTS, type FaceAnalysis } from '@/lib/face/analysis';
import FaceCamera, { type OvalTone } from '@/components/face/FaceCamera';

type EnrollState = 'intro' | 'camera' | 'processing' | 'success' | 'error' | 'already_enrolled';

/**
 * Guided multi-pose enrollment: blink once (liveness), then capture front / left / right /
 * front. Each shot is taken automatically once the pose is held and the photo passes the
 * quality checks. Turned-head samples make later matching robust to how students hold
 * their phones.
 */
interface Pose {
  instruction: string;
  matches: (a: FaceAnalysis) => boolean;
  frontal: boolean;
}
const POSES: Pose[] = [
  { instruction: 'Look straight at the camera', frontal: true, matches: () => true },
  // In the raw (unmirrored) frame, turning to the user's left gives positive yaw.
  { instruction: 'Turn your head slightly to your left', frontal: false, matches: a => a.yaw > 0.12 && a.yaw < 0.5 },
  { instruction: 'Turn your head slightly to your right', frontal: false, matches: a => a.yaw < -0.12 && a.yaw > -0.5 },
  { instruction: 'Look straight at the camera again', frontal: true, matches: () => true },
];
const HOLD_MS = 450;

export default function FaceEnrollPage() {
  const { user } = useAuthStore();
  const router = useRouter();
  const [state, setState] = useState<EnrollState>('intro');
  const [errorMsg, setErrorMsg] = useState('');
  const [isChecking, setIsChecking] = useState(true);
  const [needsReenroll, setNeedsReenroll] = useState(false);

  const [blinked, setBlinked] = useState(false);
  const [poseIndex, setPoseIndex] = useState(0);
  const [justCaptured, setJustCaptured] = useState(false);
  const shots = useRef<string[]>([]);
  const holdSince = useRef<number | null>(null);
  const eyesClosed = useRef(false);

  const tracker = useFaceTracker(state === 'camera');
  const { analysis, latest, capture, stop: stopTracker, status: trackerStatus } = tracker;

  useEffect(() => {
    if (!user?.userId) { setIsChecking(false); return; }
    checkFaceEnrolled()
      .then(res => {
        if (res.enrolled) setState('already_enrolled');
        setNeedsReenroll(!!res.needs_reenroll);
      })
      .finally(() => setIsChecking(false));
  }, [user?.userId]);

  useEffect(() => {
    if (tracker.status === 'error') {
      setErrorMsg(tracker.error);
      setState('error');
    }
  }, [tracker.status, tracker.error]);

  const startCamera = () => {
    shots.current = [];
    holdSince.current = null;
    eyesClosed.current = false;
    setBlinked(false);
    setPoseIndex(0);
    setJustCaptured(false);
    setState('camera');
  };

  const submit = useCallback(async (images: string[]) => {
    setState('processing');
    const result = await enrollFace(images);
    if (result.success) {
      setState('success');
    } else {
      setErrorMsg(result.error || 'Enrollment failed. Please try again.');
      setState('error');
    }
  }, []);

  // Drive the guided capture from the live face analysis.
  useEffect(() => {
    if (state !== 'camera' || trackerStatus !== 'ready' || justCaptured) return;
    const a = analysis;

    if (!blinked) {
      if (a.faceCount !== 1) return;
      if (a.blinkLeft > 0.45 && a.blinkRight > 0.45) eyesClosed.current = true;
      else if (eyesClosed.current && a.blinkLeft < 0.25 && a.blinkRight < 0.25) setBlinked(true);
      return;
    }

    const pose = POSES[poseIndex];
    const ok = qualityIssues(a, { requireFrontal: pose.frontal }).length === 0 && pose.matches(a);
    const now = performance.now();
    if (!ok) { holdSince.current = null; return; }
    holdSince.current ??= now;
    if (now - holdSince.current < HOLD_MS) return;

    const fresh = latest();
    if (qualityIssues(fresh, { requireFrontal: pose.frontal }).length > 0 || !pose.matches(fresh)) return;
    const image = capture();
    if (!image) return;
    holdSince.current = null;
    shots.current.push(image);
    if (navigator.vibrate) navigator.vibrate(40);

    if (poseIndex === POSES.length - 1) {
      stopTracker();
      submit(shots.current);
      return;
    }
    setJustCaptured(true);
    setTimeout(() => { setJustCaptured(false); setPoseIndex(i => i + 1); }, 700);
  }, [analysis, state, trackerStatus, stopTracker, blinked, poseIndex, justCaptured, latest, capture, submit]);

  if (isChecking) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (state === 'already_enrolled') {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center px-5 max-w-md mx-auto">
        <div className="w-20 h-20 rounded-full bg-secondary-container/30 flex items-center justify-center mb-6">
          <span className="material-symbols-outlined text-primary text-4xl" style={{fontVariationSettings:"'FILL' 1"}}>verified_user</span>
        </div>
        <h2 className="text-2xl font-bold text-on-surface mb-2 text-center">Face Already Enrolled</h2>
        <p className="text-sm text-on-surface-variant text-center mb-8">Your face is registered for attendance verification.</p>
        <div className="w-full flex flex-col gap-3">
          <button onClick={() => setState('intro')}
            className="w-full h-12 border border-outline-variant rounded-full text-sm text-on-surface-variant active:scale-95">
            Re-enroll Face
          </button>
          <button onClick={() => router.push('/student/dashboard')}
            className="w-full h-12 bg-primary-container text-on-primary-container rounded-full text-sm font-semibold active:scale-95">
            Back to Dashboard
          </button>
        </div>
      </div>
    );
  }

  if (state === 'intro') {
    return (
      <div className="min-h-screen bg-background flex flex-col max-w-md mx-auto">
        <header className="flex items-center px-5 h-12 sticky top-0 bg-background z-10">
          <button onClick={() => router.back()} aria-label="Back" className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-surface-container-low text-primary">
            <span className="material-symbols-outlined">arrow_back</span>
          </button>
        </header>
        <div className="flex-1 flex flex-col items-center justify-center px-5 pb-10">
          <div className="w-24 h-24 rounded-3xl bg-primary/10 flex items-center justify-center mb-8">
            <span className="material-symbols-outlined text-primary text-5xl" style={{fontVariationSettings:"'FILL' 1"}}>face</span>
          </div>
          <h2 className="text-2xl font-bold text-on-surface text-center mb-3">
            {needsReenroll ? 'Update face verification' : 'Set up face verification'}
          </h2>
          <p className="text-sm text-on-surface-variant text-center mb-2 leading-relaxed">
            {needsReenroll
              ? 'Face verification was upgraded for better accuracy. Set up your face again — it takes about 20 seconds.'
              : 'Your face is used to confirm your identity during attendance sessions. It takes about 20 seconds.'}
          </p>
          <p className="text-xs text-on-surface-variant text-center mb-10 leading-relaxed bg-surface-container-low rounded-xl p-4 border border-outline-variant/20">
            <span className="material-symbols-outlined text-sm align-middle mr-1" style={{fontVariationSettings:"'FILL' 1"}}>security</span>
            Only a secure mathematical encoding of your face is stored — not the photos.
          </p>
          <div className="w-full flex flex-col gap-3">
            <div className="flex flex-col gap-2 mb-4">
              {['Find even, bright light (face a window or lamp)', 'Blink once, then follow the head-turn prompts', 'Photos are taken automatically — just hold each pose'].map((tip, i) => (
                <div key={i} className="flex items-center gap-3">
                  <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                    <span className="text-xs font-bold text-primary">{i + 1}</span>
                  </div>
                  <p className="text-sm text-on-surface-variant">{tip}</p>
                </div>
              ))}
            </div>
            <button onClick={startCamera}
              className="w-full h-12 bg-primary-container text-on-primary-container rounded-full text-sm font-semibold active:scale-95 flex items-center justify-center gap-2">
              <span className="material-symbols-outlined text-lg">photo_camera</span>
              Start Enrollment
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (state === 'camera') {
    const pose = POSES[poseIndex];
    const issues = qualityIssues(analysis, { requireFrontal: pose.frontal });
    let instruction: string;
    let tone: OvalTone = 'neutral';
    if (justCaptured) {
      instruction = 'Got it ✓';
      tone = 'done';
    } else if (!blinked) {
      instruction = analysis.faceCount === 1 ? 'Blink once to begin' : ISSUE_HINTS.no_face;
      tone = analysis.faceCount === 1 ? 'good' : 'neutral';
    } else if (issues.length) {
      instruction = issues[0] === 'not_frontal' ? pose.instruction : ISSUE_HINTS[issues[0]];
      tone = 'guide';
    } else if (!pose.matches(analysis)) {
      instruction = pose.instruction;
      tone = 'guide';
    } else {
      instruction = 'Hold still…';
      tone = 'good';
    }
    return (
      <FaceCamera
        videoRef={tracker.videoRef}
        status={tracker.status}
        title="Face Enrollment"
        instruction={instruction}
        subtext={blinked ? `Photo ${Math.min(poseIndex + 1, POSES.length)} of ${POSES.length}` : 'Liveness check'}
        tone={tone}
        steps={{ done: blinked ? poseIndex + (justCaptured ? 1 : 0) : 0, total: POSES.length }}
        onBack={() => setState('intro')}
      />
    );
  }

  if (state === 'processing') {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center px-5 max-w-md mx-auto">
        <div className="w-20 h-20 border-4 border-primary border-t-transparent rounded-full animate-spin mb-6" />
        <h2 className="text-xl font-bold text-on-surface mb-2">Creating your face profile…</h2>
        <p className="text-sm text-on-surface-variant text-center">This takes a few seconds.</p>
      </div>
    );
  }

  if (state === 'success') {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center px-5 max-w-md mx-auto">
        <div className="w-24 h-24 rounded-full bg-secondary-container/30 flex items-center justify-center mb-6">
          <span className="material-symbols-outlined text-primary text-5xl" style={{fontVariationSettings:"'FILL' 1"}}>check_circle</span>
        </div>
        <h2 className="text-2xl font-bold text-on-surface text-center mb-2">Face Enrolled!</h2>
        <p className="text-sm text-on-surface-variant text-center mb-2">{POSES.length} photos from different angles were captured.</p>
        <p className="text-xs text-on-surface-variant text-center mb-10 bg-surface-container-low rounded-xl p-3 border border-outline-variant/20">
          The photos were processed and discarded. Only a secure face encoding is stored.
        </p>
        <button onClick={() => router.push('/student/dashboard')}
          className="w-full h-12 bg-primary-container text-on-primary-container rounded-full text-sm font-semibold active:scale-95">
          Go to Dashboard
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center px-5 max-w-md mx-auto">
      <div className="w-24 h-24 rounded-full bg-error-container flex items-center justify-center mb-6">
        <span className="material-symbols-outlined text-error text-5xl" style={{fontVariationSettings:"'FILL' 1"}}>error</span>
      </div>
      <h2 className="text-2xl font-bold text-on-surface text-center mb-2">Enrollment Failed</h2>
      <p className="text-sm text-on-surface-variant text-center mb-10">{errorMsg}</p>
      <div className="w-full flex flex-col gap-3">
        <button onClick={startCamera}
          className="w-full h-12 bg-primary-container text-on-primary-container rounded-full text-sm font-semibold active:scale-95">
          Try Again
        </button>
        <button onClick={() => router.push('/student/dashboard')}
          className="w-full h-12 border border-outline-variant rounded-full text-sm text-on-surface-variant active:scale-95">
          Back to Dashboard
        </button>
      </div>
    </div>
  );
}
