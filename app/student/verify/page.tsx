'use client';
import { useEffect, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuthStore } from '@/store/auth.store';
import { getActiveSessionForCourse, getSessionsForCourse, subscribeToSession } from '@/lib/firebase/sessions.service';
import { markAttendance } from '@/lib/api/face.api';
import { getBestPosition, checkProximity } from '@/lib/utils/gps.utils';
import { resolveSessionPhase } from '@/lib/utils/session.utils';
import { Session } from '@/types';
import { useFaceTracker } from '@/hooks/useFaceTracker';
import { useLivenessCheck } from '@/hooks/useLivenessCheck';
import FaceCamera from '@/components/face/FaceCamera';

const GRACE_PERIOD_SECONDS = 45;

type VerifyStep = 'gps' | 'camera' | 'processing' | 'success' | 'failed' | 'already_recorded' | 'no_session';

export default function VerifyPage() {
  const { user } = useAuthStore();
  const router = useRouter();
  const searchParams = useSearchParams();
  const courseId = searchParams.get('courseId') || '';

  const [step, setStep] = useState<VerifyStep>('gps');
  const [session, setSession] = useState<Session | null>(null);
  const [gpsStatus, setGpsStatus] = useState<'checking' | 'confirmed' | 'failed'>('checking');
  const [gpsDistance, setGpsDistance] = useState(0);
  const [gpsError, setGpsError] = useState('');
  const [gpsAccuracy, setGpsAccuracy] = useState<number | null>(null);
  const positionRef = useRef<{ latitude: number; longitude: number; accuracy: number } | null>(null);
  const [attempts, setAttempts] = useState(0);
  const [confidence, setConfidence] = useState(0);
  const [awardedScore, setAwardedScore] = useState(0);
  const [errorMsg, setErrorMsg] = useState('');
  const [retryAction, setRetryAction] = useState<'camera' | 'gps' | null>(null);
  const [noSessionMsg, setNoSessionMsg] = useState('There is no active attendance session for this course right now.');
  const [phase, setPhase] = useState<'phase1' | 'phase2'>('phase1');
  
  const [cameraActive, setCameraActive] = useState(false);
  const tracker = useFaceTracker(cameraActive);
  const { analysis, latest, capture, stop: stopTracker } = tracker;
  const [sessionEnded, setSessionEnded] = useState(false);
  const graceTimerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (!courseId || !user) return;
    // Read-only: the phase is computed locally from the session timestamps.
    // (Students can no longer write to sessions; the server re-checks the phase on submit.)
    getActiveSessionForCourse(courseId).then(async s => {
      const resolved = s ? resolveSessionPhase(s) : 'ended';
      if (!s || resolved === 'ended') {
        const allSessions = await getSessionsForCourse(courseId);
        const latestSession = allSessions[0]; // ordered by createdAt desc
        if (latestSession) {
          setSessionEnded(true);
        } else {
          setStep('no_session');
        }
        return;
      }
      if (resolved === 'waiting') {
        setNoSessionMsg('Check-in has closed and check-out has not opened yet. Come back when check-out opens.');
        setStep('no_session');
        return;
      }
      setSession(s);
      setPhase(resolved === 'phase2_open' ? 'phase2' : 'phase1');
      checkGPS(s);
    }).catch(() => setStep('no_session'));
  }, [courseId]);

  const checkGPS = async (s: Session) => {
    setStep('gps');
    setGpsStatus('checking');
    setGpsAccuracy(null);
    try {
      // Watch GPS for a few seconds and keep the most accurate fix.
      const pos = await getBestPosition({ onUpdate: fix => setGpsAccuracy(Math.round(fix.accuracy)) });
      positionRef.current = pos;
      setGpsAccuracy(Math.round(pos.accuracy));
      const result = checkProximity(pos, {
        lat: s.classroomLat, lng: s.classroomLng, radius: s.classroomRadius, name: s.classroomName,
      });
      setGpsDistance(result.distance);
      if (result.ok) {
        setGpsStatus('confirmed');
        setTimeout(() => startCamera(), 1000);
      } else {
        setGpsStatus('failed');
        setGpsError(result.message);
      }
    } catch (e: any) {
      setGpsStatus('failed');
      setGpsError(e.message);
    }
  };

  const startCamera = () => {
    setErrorMsg('');
    setStep('camera');
    setCameraActive(false);
    // Remount the tracker so the liveness challenge (and its random turn direction) restarts.
    setTimeout(() => setCameraActive(true), 0);
  };

  const stopCamera = () => {
    stopTracker();
    setCameraActive(false);
  };

  useEffect(() => {
    if (step === 'camera' && tracker.status === 'error') {
      stopCamera();
      setErrorMsg(tracker.error);
      setRetryAction('camera');
      setStep('failed');
    }
  }, [step, tracker.status, tracker.error]); // eslint-disable-line react-hooks/exhaustive-deps

  const captureAndVerify = async (faceImage: string) => {
    if (!user || !session || !positionRef.current) return;
    setStep('processing');
    stopCamera();

    // The server re-checks the phase, enrollment, distance and face, then writes the record.
    const result = await markAttendance({
      sessionId: session.sessionId,
      image: faceImage,
      ...positionRef.current,
    });
    if (result.phase) setPhase(result.phase);
    if (typeof result.confidence === 'number') setConfidence(result.confidence);

    const fail = (message: string, retry: 'camera' | 'gps' | null) => {
      setErrorMsg(message);
      setRetryAction(retry);
      setStep('failed');
    };

    switch (result.status) {
      case 'recorded':
        setAwardedScore(result.score ?? 0);
        setStep('success');
        return;
      case 'already_recorded':
        setStep('already_recorded');
        return;
      case 'face_mismatch':
      case 'no_face': {
        const remaining = result.attempts_remaining ?? 0;
        setAttempts(3 - remaining);
        fail(remaining > 0 ? `${result.message} ${remaining} attempt${remaining === 1 ? '' : 's'} left.` : result.message,
          remaining > 0 ? 'camera' : null);
        return;
      }
      case 'out_of_range':
        if (typeof result.distance === 'number') setGpsDistance(result.distance);
        fail(result.message, 'gps');
        return;
      case 'phase_closed':
      case 'no_session':
        setSessionEnded(true);
        return;
      case 'not_enrolled_face':
        fail(result.message, null);
        return;
      default:
        fail(result.message || 'Failed to record attendance.', result.status === 'error' ? 'camera' : null);
    }
  };

  const liveness = useLivenessCheck({
    enabled: cameraActive && tracker.status === 'ready',
    analysis,
    latest,
    capture,
    onComplete: captureAndVerify,
  });

  useEffect(() => {
    return () => {
      stopCamera();
      if (graceTimerRef.current) clearTimeout(graceTimerRef.current);
    };
  }, []);

  // Real-time listener: detect if lecturer ends the session while student is on this screen
  // Starts a grace period timer instead of immediately interrupting
  useEffect(() => {
    if (!session) return;
    const unsubscribe = subscribeToSession(session.sessionId, (updatedSession) => {
      if (!updatedSession || updatedSession.status === 'ended') {
        // Guard: don't start a second timer if one is already running
        if (graceTimerRef.current) return;
        graceTimerRef.current = setTimeout(() => {
          setSessionEnded(true);
          stopCamera();
        }, GRACE_PERIOD_SECONDS * 1000);
      }
    });
    return () => {
      unsubscribe();
      if (graceTimerRef.current) {
        clearTimeout(graceTimerRef.current);
        graceTimerRef.current = null;
      }
    };
  }, [session?.sessionId]);

  const phaseLabel = phase === 'phase1' ? 'Phase 1 — Check In' : 'Phase 2 — Check Out';

  // Session ended takes priority over every other screen
  if (sessionEnded) return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center px-5 max-w-md mx-auto text-center">
      <div className="w-24 h-24 rounded-full bg-error-container/30 flex items-center justify-center mb-6">
        <span className="material-symbols-outlined text-error text-5xl" style={{fontVariationSettings:"'FILL' 1"}}>event_busy</span>
      </div>
      <h2 className="text-xl font-bold text-on-surface mb-2">Session Ended</h2>
      <p className="text-sm text-on-surface-variant mb-8">The lecturer has ended this attendance session.</p>
      <button onClick={() => router.push('/student/dashboard')}
        className="w-full h-12 bg-primary-container text-on-primary-container rounded-full text-sm font-semibold active:scale-95">
        Back to Dashboard
      </button>
    </div>
  );

  if (step === 'no_session') return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center px-5 max-w-md mx-auto text-center">
      <span className="material-symbols-outlined text-outline text-6xl mb-4">event_busy</span>
      <h2 className="text-xl font-bold text-on-surface mb-2">No Active Session</h2>
      <p className="text-sm text-on-surface-variant mb-8">{noSessionMsg}</p>
      <button onClick={() => router.back()} className="w-full h-12 bg-primary-container text-on-primary-container rounded-full text-sm font-semibold active:scale-95">Go Back</button>
    </div>
  );

  if (step === 'gps') return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center px-5 max-w-md mx-auto text-center">
      <p className="text-xs font-bold text-primary uppercase tracking-wider mb-6 bg-primary/10 px-4 py-2 rounded-full">{phaseLabel}</p>
      {gpsStatus === 'checking' && (
        <>
          <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center mb-6 animate-pulse">
            <span className="material-symbols-outlined text-primary text-4xl" style={{fontVariationSettings:"'FILL' 1"}}>location_searching</span>
          </div>
          <h2 className="text-xl font-bold text-on-surface mb-2">
            {gpsAccuracy === null ? 'Getting your location...' : 'Improving accuracy...'}
          </h2>
          <p className="text-sm text-on-surface-variant">
            {gpsAccuracy === null ? 'Please allow location access when prompted' : `Current accuracy ±${gpsAccuracy}m`}
          </p>
        </>
      )}
      {gpsStatus === 'confirmed' && (
        <>
          <div className="w-20 h-20 rounded-full bg-secondary-container/30 flex items-center justify-center mb-6">
            <span className="material-symbols-outlined text-primary text-4xl" style={{fontVariationSettings:"'FILL' 1"}}>location_on</span>
          </div>
          <h2 className="text-xl font-bold text-on-surface mb-2">Location Confirmed</h2>
          <p className="text-sm text-on-surface-variant">You are {gpsDistance}m from the classroom{gpsAccuracy !== null ? ` (±${gpsAccuracy}m)` : ''}. Starting camera...</p>
        </>
      )}
      {gpsStatus === 'failed' && (
        <>
          <div className="w-20 h-20 rounded-full bg-error-container flex items-center justify-center mb-6">
            <span className="material-symbols-outlined text-error text-4xl" style={{fontVariationSettings:"'FILL' 1"}}>location_off</span>
          </div>
          <h2 className="text-xl font-bold text-on-surface mb-2">Location Check Failed</h2>
          <p className="text-sm text-on-surface-variant mb-8">{gpsError}</p>
          <button onClick={() => session && checkGPS(session)} className="w-full h-12 bg-primary-container text-on-primary-container rounded-full text-sm font-semibold active:scale-95 mb-3">Try Again</button>
          <button onClick={() => router.back()} className="w-full h-12 border border-outline-variant rounded-full text-sm text-on-surface-variant active:scale-95">Go Back</button>
        </>
      )}
    </div>
  );

  if (step === 'camera') {
    return (
      <FaceCamera
        videoRef={tracker.videoRef}
        status={tracker.status === 'idle' ? 'starting' : tracker.status}
        title="Verify Identity"
        instruction={liveness.instruction}
        subtext={phaseLabel}
        tone={liveness.tone}
        steps={liveness.progress}
        onBack={() => { stopCamera(); router.back(); }}
        badge={
          <div className="bg-secondary-container/90 backdrop-blur-sm px-3 h-8 rounded-full flex items-center gap-1">
            <span className="material-symbols-outlined text-on-secondary-container text-sm" style={{fontVariationSettings:"'FILL' 1"}}>check_circle</span>
            <span className="text-on-secondary-container text-xs font-medium">{gpsDistance}m</span>
          </div>
        }
      />
    );
  }


  if (step === 'processing') return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center px-5 max-w-md mx-auto text-center">
      <div className="w-20 h-20 border-4 border-primary border-t-transparent rounded-full animate-spin mb-6" />
      <h2 className="text-xl font-bold text-on-surface mb-2">Verifying your face...</h2>
      <p className="text-sm text-on-surface-variant">Matching against your enrolled face data</p>
    </div>
  );

  if (step === 'success') return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center px-5 max-w-md mx-auto text-center">
      <div className="w-24 h-24 rounded-full bg-secondary-container/30 flex items-center justify-center mb-6">
        <span className="material-symbols-outlined text-primary text-5xl" style={{fontVariationSettings:"'FILL' 1"}}>check_circle</span>
      </div>
      <h2 className="text-2xl font-bold text-on-surface mb-2">{phase === 'phase1' ? 'Check-in Recorded!' : 'Check-out Recorded!'}</h2>
      <p className="text-sm text-on-surface-variant mb-2">Face match confidence: {confidence.toFixed(1)}%</p>
      <p className="text-sm text-on-surface-variant mb-8">+{awardedScore} marks awarded</p>
      <button onClick={() => router.push('/student/dashboard')}
        className="w-full h-12 bg-primary-container text-on-primary-container rounded-full text-sm font-semibold active:scale-95">
        Back to Dashboard
      </button>
    </div>
  );

  if (step === 'already_recorded') return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center px-5 max-w-md mx-auto text-center">
      <div className="w-24 h-24 rounded-full bg-primary/10 flex items-center justify-center mb-6">
        <span className="material-symbols-outlined text-primary text-5xl" style={{fontVariationSettings:"'FILL' 1"}}>info</span>
      </div>
      <h2 className="text-xl font-bold text-on-surface mb-2">Already Recorded</h2>
      <p className="text-sm text-on-surface-variant mb-8">Your attendance for this phase has already been recorded.</p>
      <button onClick={() => router.push('/student/dashboard')}
        className="w-full h-12 bg-primary-container text-on-primary-container rounded-full text-sm font-semibold active:scale-95">
        Back to Dashboard
      </button>
    </div>
  );

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center px-5 max-w-md mx-auto text-center">
      <div className="w-24 h-24 rounded-full bg-error-container flex items-center justify-center mb-6">
        <span className="material-symbols-outlined text-error text-5xl" style={{fontVariationSettings:"'FILL' 1"}}>error</span>
      </div>
      <h2 className="text-xl font-bold text-on-surface mb-2">Verification Failed</h2>
      <p className="text-sm text-on-surface-variant mb-8">{errorMsg}</p>
      <div className="w-full flex flex-col gap-3">
        {retryAction && (
          <button onClick={() => (retryAction === 'gps' && session ? checkGPS(session) : startCamera())}
            className="w-full h-12 bg-primary-container text-on-primary-container rounded-full text-sm font-semibold active:scale-95">
            Try Again
          </button>
        )}
        <button onClick={() => router.push('/student/dashboard')}
          className="w-full h-12 border border-outline-variant rounded-full text-sm text-on-surface-variant active:scale-95">
          Back to Dashboard
        </button>
      </div>
    </div>
  );
}
