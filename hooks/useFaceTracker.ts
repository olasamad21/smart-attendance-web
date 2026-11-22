'use client';
/**
 * Camera + MediaPipe Face Landmarker loop.
 * Exposes the latest FaceAnalysis (throttled for rendering) and a capture() that returns
 * an aligned face crop of the current frame.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import type { FaceLandmarker } from '@mediapipe/tasks-vision';
import {
  analyzeLandmarks, cropAlignedFace, measureImageQuality, EMPTY_ANALYSIS, type FaceAnalysis,
} from '@/lib/face/analysis';

const MEDIAPIPE_VERSION = '1.2.2'; // keep in sync with package.json
const WASM_URL = `https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@${MEDIAPIPE_VERSION}/wasm`;
const MODEL_URL =
  'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task';

let landmarkerPromise: Promise<FaceLandmarker> | null = null;

/** One shared landmarker per page load (the model is ~4 MB). */
function getLandmarker(): Promise<FaceLandmarker> {
  if (!landmarkerPromise) {
    landmarkerPromise = (async () => {
      const { FaceLandmarker, FilesetResolver } = await import('@mediapipe/tasks-vision');
      const fileset = await FilesetResolver.forVisionTasks(WASM_URL);
      const options = {
        baseOptions: { modelAssetPath: MODEL_URL, delegate: 'GPU' as const },
        runningMode: 'VIDEO' as const,
        numFaces: 2, // detect a second face so we can reject it
        outputFaceBlendshapes: true,
      };
      try {
        return await FaceLandmarker.createFromOptions(fileset, options);
      } catch {
        // Some phones have no usable WebGL — fall back to CPU.
        return await FaceLandmarker.createFromOptions(fileset, {
          ...options, baseOptions: { ...options.baseOptions, delegate: 'CPU' as const },
        });
      }
    })();
    landmarkerPromise.catch(() => { landmarkerPromise = null; });
  }
  return landmarkerPromise;
}

export type TrackerStatus = 'idle' | 'starting' | 'ready' | 'error';

export function useFaceTracker(active: boolean) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const scratchRef = useRef<HTMLCanvasElement | null>(null);
  const cropRef = useRef<HTMLCanvasElement | null>(null);
  const latestRef = useRef<FaceAnalysis>(EMPTY_ANALYSIS);
  const [analysis, setAnalysis] = useState<FaceAnalysis>(EMPTY_ANALYSIS);
  const [status, setStatus] = useState<TrackerStatus>('idle');
  const [error, setError] = useState('');

  const stop = useCallback(() => {
    streamRef.current?.getTracks().forEach(t => t.stop());
    streamRef.current = null;
  }, []);

  useEffect(() => {
    if (!active) return;
    let cancelled = false;
    let raf = 0;
    let frame = 0;
    let lastRender = 0;
    let lastQuality: { brightness: number; sharpness: number } | null = null;
    scratchRef.current ??= document.createElement('canvas');
    cropRef.current ??= document.createElement('canvas');

    (async () => {
      setStatus('starting');
      setError('');
      try {
        const [stream, landmarker] = await Promise.all([
          navigator.mediaDevices.getUserMedia({
            video: { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 720 } },
            audio: false,
          }),
          getLandmarker(),
        ]);
        if (cancelled) { stream.getTracks().forEach(t => t.stop()); return; }
        streamRef.current = stream;
        const video = videoRef.current;
        if (!video) return;
        video.srcObject = stream;
        await video.play().catch(() => {});
        setStatus('ready');

        const loop = () => {
          if (cancelled) return;
          if (video.readyState >= 2 && video.videoWidth > 0) {
            const result = landmarker.detectForVideo(video, performance.now());
            const a = analyzeLandmarks(result);
            frame++;
            if (a.box && (frame % 5 === 0 || !lastQuality)) {
              lastQuality = measureImageQuality(video, video.videoWidth, video.videoHeight, a.box, scratchRef.current!);
            }
            if (!a.box) lastQuality = null;
            if (lastQuality) { a.brightness = lastQuality.brightness; a.sharpness = lastQuality.sharpness; }
            latestRef.current = a;
            const now = performance.now();
            if (now - lastRender > 80) { lastRender = now; setAnalysis(a); }
          }
          raf = requestAnimationFrame(loop);
        };
        raf = requestAnimationFrame(loop);
      } catch (e: unknown) {
        if (cancelled) return;
        const name = (e as { name?: string })?.name;
        setError(
          name === 'NotAllowedError'
            ? 'Camera access was denied. Allow camera access in your browser settings, then try again.'
            : name === 'NotFoundError'
              ? 'No camera was found on this device.'
              : 'Could not start face detection. Check your connection and try again.',
        );
        setStatus('error');
      }
    })();

    return () => {
      cancelled = true;
      cancelAnimationFrame(raf);
      stop();
      setStatus('idle');
    };
  }, [active, stop]);

  /** Aligned face crop of the current frame (JPEG data URL), or null if no face. */
  const capture = useCallback((): string | null => {
    const video = videoRef.current;
    if (!video || !cropRef.current) return null;
    return cropAlignedFace(video, video.videoWidth, video.videoHeight, latestRef.current, cropRef.current);
  }, []);

  /** Latest analysis without waiting for a re-render (for state machines). */
  const latest = useCallback(() => latestRef.current, []);

  return { videoRef, status, error, analysis, latest, capture, stop };
}
