'use client';
import { useEffect, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuthStore } from '@/store/auth.store';
import { getActiveSessionForCourse, getSessionsForCourse, subscribeToSession, getStudentSessionAttendance } from '@/lib/firebase/sessions.service';
import { markAttendance } from '@/lib/api/face.api';
import { getBestPosition, checkProximity } from '@/lib/utils/gps.utils';
import { resolveSessionPhase } from '@/lib/utils/session.utils';
import { Session } from '@/types';
import { useFaceTracker } from '@/hooks/useFaceTracker';
import { useLivenessCheck } from '@/hooks/useLivenessCheck';
import FaceCamera from '@/components/face/FaceCamera';
import Button, { ButtonLink } from '@/components/ui/Button';
import Icon from '@/components/ui/Icon';
import { VerifyShell, StatusHero, SuccessCheck, DistanceMeter, DetailRow } from '@/components/student/VerifyScreens';

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
  const [gpsFailKind, setGpsFailKind] = useState<'too_far' | 'other'>('other');
  const [needsEnrollment, setNeedsEnrollment] = useState(false);
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
        setGpsFailKind(result.reason === 'too_far' ? 'too_far' : 'other');
        setGpsError(result.message);
      }
    } catch (e: any) {
      setGpsStatus('failed');
      setGpsFailKind('other');
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
        if (navigator.vibrate) navigator.vibrate([30, 50, 80]);
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
        setNeedsEnrollment(true);
        fail(result.message, null);
        return;
      default: {
        // The connection can drop while the server is still working (slow network, proxy
        // timeout). Before reporting failure, check whether the attendance was saved anyway.
        if (result.status === 'error') {
          const record = await getStudentSessionAttendance(session.sessionId, user.userId).catch(() => null);
          const saved = record && (phase === 'phase1'
            ? record.phase1Status === 'present'
            : record.phase2Status === 'present');
          if (saved) {
            setAwardedScore(phase === 'phase1' ? record.phase1Score : record.phase2Score);
            if (navigator.vibrate) navigator.vibrate([30, 50, 80]);
            setStep('success');
            return;
          }
        }
        fail(
          result.status === 'error'
            ? 'The connection dropped before we got an answer, and your attendance was not recorded. Please try again.'
            : result.message || 'Failed to record attendance.',
          result.status === 'error' ? 'camera' : null,
        );
      }
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

  const phaseLabel = phase === 'phase1' ? 'Check-in' : 'Check-out';
  const title = session ? `${session.courseCode} · ${phaseLabel}` : phaseLabel;
  const subtitle = session ? `${session.courseTitle} · ${session.classroomName}` : undefined;
  const toDashboard = () => router.push('/student/dashboard');
  const back = () => { stopCamera(); router.back(); };

  // Session ended takes priority over every other screen
  if (sessionEnded) return (
    <VerifyShell current={0} title={title} subtitle={subtitle} onBack={toDashboard}>
      <StatusHero icon="event_busy" tone="neutral" title="Session ended"
        actions={<Button size="lg" fullWidth onClick={toDashboard}>Back to dashboard</Button>}>
        The lecturer has closed this attendance session. If you were in class, ask them to check you in manually.
      </StatusHero>
    </VerifyShell>
  );

  if (step === 'no_session') return (
    <VerifyShell current={0} title={title} subtitle={subtitle} onBack={back}>
      <StatusHero icon="event_available" tone="neutral" title="Nothing to check in to"
        actions={<Button size="lg" fullWidth variant="outline" onClick={back}>Go back</Button>}>
        {noSessionMsg}
      </StatusHero>
    </VerifyShell>
  );

  if (step === 'gps') return (
    <VerifyShell current={0} title={title} subtitle={subtitle} onBack={back}>
      {gpsStatus === 'checking' && (
        <StatusHero icon="my_location" tone="primary" pulse
          title={gpsAccuracy === null ? 'Finding your location' : 'Improving accuracy'}>
          {gpsAccuracy === null
            ? 'Allow location access if your phone asks.'
            : <span className="tabular-nums">Current accuracy ±{gpsAccuracy}m. Hold on a moment.</span>}
        </StatusHero>
      )}
      {gpsStatus === 'confirmed' && (
        <StatusHero icon="where_to_vote" tone="success" title="You're in the classroom">
          <span className="tabular-nums">{gpsDistance}m from {session?.classroomName ?? 'the classroom'}{gpsAccuracy !== null ? ` (±${gpsAccuracy}m)` : ''}.</span>
          <br />Opening the camera…
        </StatusHero>
      )}
      {gpsStatus === 'failed' && (
        <StatusHero icon="location_off" tone="error" title="Location check failed"
          actions={<>
            <Button size="lg" fullWidth icon="refresh" onClick={() => session && checkGPS(session)}>Try again</Button>
            <Button size="lg" fullWidth variant="outline" onClick={back}>Go back</Button>
          </>}>
          {gpsError}
          {gpsFailKind === 'too_far' && session && (
            <DistanceMeter distance={gpsDistance} radius={session.classroomRadius} accuracy={gpsAccuracy} />
          )}
          {gpsFailKind !== 'too_far' && (
            <p className="mt-3 text-xs">Tip: GPS works best near a window or outdoors, with Wi-Fi turned on.</p>
          )}
        </StatusHero>
      )}
    </VerifyShell>
  );

  if (step === 'camera') {
    return (
      <FaceCamera
        videoRef={tracker.videoRef}
        status={tracker.status === 'idle' ? 'starting' : tracker.status}
        title={title}
        instruction={liveness.instruction}
        subtext="Face check · keep your face inside the oval"
        tone={liveness.tone}
        steps={liveness.progress}
        onBack={back}
        badge={
          <div className="bg-success-container/90 backdrop-blur-sm px-3 h-8 rounded-full flex items-center gap-1 text-on-success-container">
            <Icon name="where_to_vote" filled className="text-sm" />
            <span className="text-xs font-semibold tabular-nums">{gpsDistance}m</span>
          </div>
        }
      />
    );
  }

  if (step === 'processing') return (
    <VerifyShell current={1} title={title} subtitle={subtitle}>
      <StatusHero icon="face" tone="primary" pulse title="Verifying it's you">
        Matching your face and recording your {phaseLabel.toLowerCase()}. This takes a few seconds.
      </StatusHero>
    </VerifyShell>
  );

  if (step === 'success') return (
    <VerifyShell current={3} title={title} subtitle={subtitle}>
      <StatusHero visual={<SuccessCheck />} title={phase === 'phase1' ? "You're checked in" : "You're checked out"}
        actions={<Button size="lg" fullWidth onClick={toDashboard}>Done</Button>}>
        <span>Your attendance has been recorded.</span>
        <div className="mt-6 w-72 max-w-full mx-auto rounded-2xl border border-outline-variant/30 bg-surface-container-lowest shadow-card px-4 divide-y divide-outline-variant/30 text-left">
          <DetailRow icon="stars" label="Marks awarded" value={`+${awardedScore}`} />
          <DetailRow icon="face" label="Face match" value={`${confidence.toFixed(0)}%`} />
          <DetailRow icon="where_to_vote" label="Distance" value={`${gpsDistance}m`} />
          <DetailRow icon="schedule" label="Time" value={new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} />
        </div>
      </StatusHero>
    </VerifyShell>
  );

  if (step === 'already_recorded') return (
    <VerifyShell current={3} title={title} subtitle={subtitle}>
      <StatusHero icon="task_alt" tone="success" title="Already recorded"
        actions={<Button size="lg" fullWidth onClick={toDashboard}>Back to dashboard</Button>}>
        Your {phaseLabel.toLowerCase()} for this session is already on record. Nothing else to do.
      </StatusHero>
    </VerifyShell>
  );

  return (
    <VerifyShell current={1} title={title} subtitle={subtitle} onBack={toDashboard}>
      <StatusHero icon="sentiment_dissatisfied" tone="error" title="We couldn't verify you"
        actions={<>
          {retryAction && (
            <Button size="lg" fullWidth icon="refresh"
              onClick={() => (retryAction === 'gps' && session ? checkGPS(session) : startCamera())}>
              Try again
            </Button>
          )}
          {needsEnrollment && <ButtonLink href="/student/enroll" size="lg" fullWidth variant="tonal" icon="face">Set up face verification</ButtonLink>}
          <Button size="lg" fullWidth variant="outline" onClick={toDashboard}>Back to dashboard</Button>
        </>}>
        {errorMsg}
        {retryAction === 'camera' && (
          <p className="mt-3 text-xs">Tip: face a window or lamp, remove sunglasses or a cap, and hold the phone at eye level.</p>
        )}
      </StatusHero>
    </VerifyShell>
  );
}
