'use client';
import { useEffect, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuthStore } from '@/store/auth.store';
import { getActiveSessionWithSync } from '@/lib/firebase/sessions.service';
import { recordPhase1, recordPhase2 } from '@/lib/firebase/attendance.service';
import { getCourseById } from '@/lib/firebase/courses.service';
import { verifyFace } from '@/lib/api/face.api';
import { getCurrentPosition, calculateDistance, isWithinRadius } from '@/lib/utils/gps.utils';
import { Session, Course } from '@/types';

type VerifyStep = 'gps' | 'camera' | 'processing' | 'success' | 'failed' | 'already_recorded' | 'no_session';

export default function VerifyPage() {
  const { user } = useAuthStore();
  const router = useRouter();
  const searchParams = useSearchParams();
  const courseId = searchParams.get('courseId') || '';
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const [step, setStep] = useState<VerifyStep>('gps');
  const [session, setSession] = useState<Session | null>(null);
  const [course, setCourse] = useState<Course | null>(null);
  const [gpsStatus, setGpsStatus] = useState<'checking' | 'confirmed' | 'failed'>('checking');
  const [gpsDistance, setGpsDistance] = useState(0);
  const [gpsError, setGpsError] = useState('');
  const [attempts, setAttempts] = useState(0);
  const [confidence, setConfidence] = useState(0);
  const [errorMsg, setErrorMsg] = useState('');
  const [phase, setPhase] = useState<'phase1' | 'phase2'>('phase1');

  useEffect(() => {
    if (!courseId || !user) return;
    getActiveSessionWithSync(courseId).then(async s => {
      if (!s) { setStep('no_session'); return; }
      setSession(s);
      const c = await getCourseById(s.courseId);
      setCourse(c);
      setPhase(s.status === 'phase2_open' ? 'phase2' : 'phase1');
      checkGPS(s);
    }).catch(() => setStep('no_session'));
  }, [courseId]);

  const checkGPS = async (s: Session) => {
    setGpsStatus('checking');
    try {
      const pos = await getCurrentPosition();
      const dist = calculateDistance(pos.latitude, pos.longitude, s.classroomLat, s.classroomLng);
      setGpsDistance(Math.round(dist));
      if (isWithinRadius(pos.latitude, pos.longitude, s.classroomLat, s.classroomLng, s.classroomRadius)) {
        setGpsStatus('confirmed');
        setTimeout(() => startCamera(), 1000);
      } else {
        setGpsStatus('failed');
        setGpsError(`You are ${Math.round(dist)}m away (max ${s.classroomRadius}m allowed)`);
      }
    } catch (e: any) {
      setGpsStatus('failed');
      setGpsError(e.message);
    }
  };

  const startCamera = async () => {
    setStep('camera');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 } }
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play().catch(e => console.log('play interrupted', e));
      }
    } catch {
      setErrorMsg('Camera access denied.');
      setStep('failed');
    }
  };

  const stopCamera = () => {
    streamRef.current?.getTracks().forEach(t => t.stop());
    streamRef.current = null;
  };

  const captureAndVerify = async () => {
    if (!videoRef.current || !canvasRef.current || !user || !session) return;
    setStep('processing');

    const canvas = canvasRef.current;
    canvas.width = Math.max(videoRef.current.videoWidth || 640, 640);
    canvas.height = Math.max(videoRef.current.videoHeight || 480, 480);
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    // Mirror the image (front camera is mirrored)
    ctx.translate(canvas.width, 0);
    ctx.scale(-1, 1);
    ctx.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);
    const base64 = canvas.toDataURL('image/jpeg', 0.95); // Higher quality

    stopCamera();

    const result = await verifyFace(user.userId, base64);
    setConfidence(result.confidence);

    if (result.matched) {
      try {
        if (phase === 'phase1') {
          await recordPhase1({
            sessionId: session.sessionId,
            courseId: session.courseId,
            studentId: user.userId,
            studentName: user.name,
            matricNumber: user.matricNumber || '',
            phase1Score: course?.phase1Marks ?? 3,
            faceMatchConfidence: result.confidence,
            gpsDistance,
          });
        } else {
          await recordPhase2(session.sessionId, user.userId, {
            phase2Score: course?.phase2Marks ?? 2,
            faceMatchConfidence: result.confidence,
            gpsDistance,
          });
        }
        setStep('success');
      } catch (e: any) {
        if (e.message === 'ALREADY_RECORDED') {
          setStep('already_recorded');
        } else {
          setErrorMsg(e.message || 'Failed to record attendance');
          setStep('failed');
        }
      }
    } else {
      const newAttempts = attempts + 1;
      setAttempts(newAttempts);
      if (newAttempts >= 3) {
        setErrorMsg(`Face verification failed after 3 attempts. Confidence: ${result.confidence.toFixed(1)}%`);
        setStep('failed');
      } else {
        setErrorMsg(`Face did not match (${result.confidence.toFixed(1)}% confidence, 70% required). Attempt ${newAttempts}/3`);
        setStep('failed');
      }
    }
  };

  useEffect(() => { return () => stopCamera(); }, []);

  const phaseLabel = phase === 'phase1' ? 'Phase 1 — Check In' : 'Phase 2 — Check Out';

  if (step === 'no_session') return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center px-5 max-w-md mx-auto text-center">
      <span className="material-symbols-outlined text-outline text-6xl mb-4">event_busy</span>
      <h2 className="text-xl font-bold text-on-surface mb-2">No Active Session</h2>
      <p className="text-sm text-on-surface-variant mb-8">There is no active attendance session for this course right now.</p>
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
          <h2 className="text-xl font-bold text-on-surface mb-2">Getting your location...</h2>
          <p className="text-sm text-on-surface-variant">Please allow location access when prompted</p>
        </>
      )}
      {gpsStatus === 'confirmed' && (
        <>
          <div className="w-20 h-20 rounded-full bg-secondary-container/30 flex items-center justify-center mb-6">
            <span className="material-symbols-outlined text-primary text-4xl" style={{fontVariationSettings:"'FILL' 1"}}>location_on</span>
          </div>
          <h2 className="text-xl font-bold text-on-surface mb-2">Location Confirmed</h2>
          <p className="text-sm text-on-surface-variant">You are {gpsDistance}m from the classroom. Starting camera...</p>
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

  if (step === 'camera') return (
    <div className="h-screen w-full overflow-hidden flex flex-col relative bg-black max-w-md mx-auto">
      <video ref={videoRef} className="absolute inset-0 w-full h-full object-cover" autoPlay muted playsInline />
      <canvas ref={canvasRef} className="hidden" />
      <div className="absolute inset-0 z-10 flex flex-col">
        <div className="flex items-center justify-between p-4">
          <button onClick={() => { stopCamera(); router.back(); }}
            className="w-10 h-10 rounded-full bg-black/40 backdrop-blur-sm flex items-center justify-center text-white active:scale-95">
            <span className="material-symbols-outlined">arrow_back</span>
          </button>
          <h2 className="text-white font-bold drop-shadow-md">Verify Identity</h2>
          <div className="bg-secondary-container/90 backdrop-blur-sm px-3 h-8 rounded-full flex items-center gap-1">
            <span className="material-symbols-outlined text-on-secondary-container text-sm" style={{fontVariationSettings:"'FILL' 1"}}>check_circle</span>
            <span className="text-on-secondary-container text-xs font-medium">{gpsDistance}m</span>
          </div>
        </div>
        <div className="flex-1 flex flex-col items-center justify-center">
          <div className="w-64 h-80 rounded-[50%] border-4 border-white/80 shadow-[0_0_0_9999px_rgba(0,0,0,0.55)]" />
          <p className="text-white/80 text-sm mt-6 drop-shadow-md">Center your face in the oval</p>
          <p className="text-white/50 text-xs mt-1">{phaseLabel}</p>
        </div>
        <div className="flex justify-center pb-12">
          <button onClick={captureAndVerify}
            className="w-20 h-20 rounded-full bg-white shadow-lg active:scale-95 flex items-center justify-center relative">
            <div className="absolute inset-2 rounded-full border-4 border-surface-container" />
            <span className="material-symbols-outlined text-primary text-3xl" style={{fontVariationSettings:"'FILL' 1"}}>photo_camera</span>
          </button>
        </div>
      </div>
    </div>
  );

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
      <p className="text-sm text-on-surface-variant mb-8">{phase === 'phase1' ? `+${course?.phase1Marks ?? 3} marks awarded` : `+${course?.phase2Marks ?? 2} marks awarded`}</p>
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
        {attempts < 3 && (
          <button onClick={startCamera}
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
