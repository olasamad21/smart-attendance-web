'use client';
import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/store/auth.store';
import { enrollFace, checkFaceEnrolled } from '@/lib/api/face.api';

type EnrollState = 'intro' | 'camera' | 'scanning' | 'processing' | 'success' | 'error' | 'already_enrolled';

export default function FaceEnrollPage() {
  const { user } = useAuthStore();
  const router = useRouter();
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [state, setState] = useState<EnrollState>('intro');
  const [errorMsg, setErrorMsg] = useState('');
  const [isChecking, setIsChecking] = useState(true);

  const [cameraReady, setCameraReady] = useState(false);
  const [scanProgress, setScanProgress] = useState(0);
  const [scanImages, setScanImages] = useState<string[]>([]);

  // Check if already enrolled
  useEffect(() => {
    if (!user?.userId) {
      setIsChecking(false);
      return;
    }
    checkFaceEnrolled(user.userId)
      .then(res => {
        if (res.enrolled) setState('already_enrolled');
      })
      .catch(() => {
        // If check fails, just show intro
      })
      .finally(() => {
        setIsChecking(false);
      });
  }, [user?.userId]);

  // Start camera
  const startCamera = async () => {
    setState('camera');
    setCameraReady(false);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 } }
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.onloadedmetadata = () => {
          setCameraReady(true);
        };
        videoRef.current.play().catch(e => console.log('play interrupted', e));
      }
    } catch (err) {
      setErrorMsg('Camera access denied. Please allow camera access in your browser settings and try again.');
      setState('error');
    }
  };

  // Stop camera
  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }
    setCameraReady(false);
  };

  const startScanning = () => {
    setState('scanning');
    setScanProgress(0);
    setScanImages([]);

    let currentProgress = 0;
    const images: string[] = [];
    const interval = setInterval(() => {
      if (!videoRef.current || !canvasRef.current || !user) return;
      const video = videoRef.current;
      const canvas = canvasRef.current;
      canvas.width = Math.max(video.videoWidth || 640, 640);
      canvas.height = Math.max(video.videoHeight || 480, 480);
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      
      // Mirror the image (front camera is mirrored)
      ctx.translate(canvas.width, 0);
      ctx.scale(-1, 1);
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      const base64 = canvas.toDataURL('image/jpeg', 0.95);
      
      images.push(base64);
      currentProgress++;
      setScanProgress(currentProgress);
      
      if (currentProgress >= 4) {
        clearInterval(interval);
        setScanImages(images);
        processEnrollment(images);
      }
    }, 1000);
  };

  const processEnrollment = async (images: string[]) => {
    if (!user) return;
    setState('processing');
    stopCamera();

    try {
      for (let i = 0; i < images.length; i++) {
        const result = await enrollFace(user.userId, images[i]);
        if (!result.success) {
          setErrorMsg(result.error || 'Enrollment failed. Please try again.');
          setState('error');
          return;
        }
      }
      setState('success');
    } catch (error) {
      setErrorMsg('An unexpected error occurred. Please try again.');
      setState('error');
    }
  };

  useEffect(() => {
    return () => stopCamera();
  }, []);

  if (isChecking) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  // Already enrolled screen
  if (state === 'already_enrolled') {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center px-5 max-w-md mx-auto">
        <div className="w-20 h-20 rounded-full bg-secondary-container/30 flex items-center justify-center mb-6">
          <span className="material-symbols-outlined text-primary text-4xl" style={{fontVariationSettings:"'FILL' 1"}}>verified_user</span>
        </div>
        <h2 className="text-2xl font-bold text-on-surface mb-2 text-center">Face Already Enrolled</h2>
        <p className="text-sm text-on-surface-variant text-center mb-8">Your face is registered for attendance verification.</p>
        <div className="w-full flex flex-col gap-3">
          <button onClick={() => { setState('intro'); setIsChecking(false); }}
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

  // Intro screen
  if (state === 'intro') {
    return (
      <div className="min-h-screen bg-background flex flex-col max-w-md mx-auto">
        <header className="flex items-center px-5 h-12 sticky top-0 bg-background z-10">
          <button onClick={() => router.back()} className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-surface-container-low text-primary">
            <span className="material-symbols-outlined">arrow_back</span>
          </button>
        </header>
        <div className="flex-1 flex flex-col items-center justify-center px-5 pb-10">
          <div className="w-24 h-24 rounded-3xl bg-primary/10 flex items-center justify-center mb-8">
            <span className="material-symbols-outlined text-primary text-5xl" style={{fontVariationSettings:"'FILL' 1"}}>face</span>
          </div>
          <h2 className="text-2xl font-bold text-on-surface text-center mb-3">Set up face verification</h2>
          <p className="text-sm text-on-surface-variant text-center mb-2 leading-relaxed">
            Your face is used to confirm your identity during attendance sessions.
          </p>
          <p className="text-xs text-on-surface-variant text-center mb-10 leading-relaxed bg-surface-container-low rounded-xl p-4 border border-outline-variant/20">
            <span className="material-symbols-outlined text-sm align-middle mr-1" style={{fontVariationSettings:"'FILL' 1"}}>security</span>
            Only a secure mathematical encoding of your face is stored — not the actual photo.
          </p>
          <div className="w-full flex flex-col gap-3">
            <div className="flex flex-col gap-2 mb-4">
              {['Ensure good lighting', 'Look directly at the camera', 'Remove glasses if possible'].map((tip, i) => (
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

  // Camera screen
  if (state === 'camera' || state === 'scanning') {
    return (
      <div className="h-screen w-full overflow-hidden flex flex-col relative bg-black max-w-md mx-auto">
        <video ref={videoRef} className="absolute inset-0 w-full h-full object-cover" autoPlay muted playsInline />
        <canvas ref={canvasRef} className="hidden" />

        <div className="absolute inset-0 z-10 flex flex-col">
          {/* Header */}
          <div className="flex items-center justify-between p-4">
            <button onClick={() => { stopCamera(); setState('intro'); }}
              className="w-10 h-10 rounded-full bg-black/40 backdrop-blur-sm flex items-center justify-center text-white active:scale-95">
              <span className="material-symbols-outlined">arrow_back</span>
            </button>
            <h2 className="text-white font-bold text-lg drop-shadow-md">Face Enrollment</h2>
            <div className="w-10" />
          </div>

          {/* Face guide — shifted up to make room for button */}
          <div className="flex-1 flex flex-col items-center justify-center -mt-16">
            {state === 'camera' ? (
              <div className="w-72 h-[22rem] rounded-[50%] border-4 border-white/80 shadow-[0_0_0_9999px_rgba(0,0,0,0.55)] flex items-center justify-center">
                <span className="material-symbols-outlined text-white/30 text-6xl" style={{fontVariationSettings:"'FILL' 1"}}>face</span>
              </div>
            ) : (
              <div className="relative">
                <div className="w-72 h-[22rem] rounded-[50%] border-4 border-white/30 shadow-[0_0_0_9999px_rgba(0,0,0,0.55)]" />
                <svg className="absolute inset-0 w-72 h-[22rem]" viewBox="0 0 288 352">
                  <ellipse cx="144" cy="176" rx="140" ry="172"
                    fill="none" stroke="#a9ece5" strokeWidth="4"
                    strokeDasharray="980"
                    strokeDashoffset={980 - (980 * scanProgress / 4)}
                    strokeLinecap="round"
                    className="transition-all duration-1000 ease-linear"
                  />
                </svg>
              </div>
            )}
            
            {state === 'camera' ? (
              <p className="text-white/80 text-sm mt-6 drop-shadow-md">Center your face in the oval</p>
            ) : (
              <p className="text-white/90 text-sm mt-6 drop-shadow-md font-medium">
                Hold still... Capturing {scanProgress}/4
              </p>
            )}
          </div>

          {/* Capture button */}
          <div className="flex justify-center pb-24 h-28">
            {state === 'camera' && cameraReady && (
              <button onClick={startScanning}
                className="h-14 px-8 rounded-full bg-white shadow-lg active:scale-95 transition-all flex items-center justify-center gap-2">
                <span className="material-symbols-outlined text-primary text-2xl" style={{fontVariationSettings:"'FILL' 1"}}>face</span>
                <span className="text-primary font-bold text-sm">Begin Scan</span>
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  // Processing screen
  if (state === 'processing') {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center px-5 max-w-md mx-auto">
        <div className="w-20 h-20 border-4 border-primary border-t-transparent rounded-full animate-spin mb-6" />
        <h2 className="text-xl font-bold text-on-surface mb-2">Processing 4 samples...</h2>
        <p className="text-sm text-on-surface-variant text-center">This may take a few seconds. Please wait.</p>
      </div>
    );
  }

  // Success screen
  if (state === 'success') {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center px-5 max-w-md mx-auto">
        <div className="w-24 h-24 rounded-full bg-secondary-container/30 flex items-center justify-center mb-6">
          <span className="material-symbols-outlined text-primary text-5xl" style={{fontVariationSettings:"'FILL' 1"}}>check_circle</span>
        </div>
        <h2 className="text-2xl font-bold text-on-surface text-center mb-2">Face Enrolled!</h2>
        <p className="text-sm text-on-surface-variant text-center mb-2">4 samples captured and averaged.</p>
        <p className="text-xs text-on-surface-variant text-center mb-10 bg-surface-container-low rounded-xl p-3 border border-outline-variant/20">
          Your photo was processed and deleted. Only a secure face encoding is stored.
        </p>
        <button onClick={() => router.push('/student/dashboard')}
          className="w-full h-12 bg-primary-container text-on-primary-container rounded-full text-sm font-semibold active:scale-95">
          Go to Dashboard
        </button>
      </div>
    );
  }

  // Error screen
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
