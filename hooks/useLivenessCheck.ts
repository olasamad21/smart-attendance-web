'use client';
/**
 * Liveness challenge: align → blink → turn head (random side) → face camera again → capture.
 * A printed photo can't blink, and a pre-recorded video can't know which side it will be asked
 * to turn. The final frame is captured only after the challenge, while the face is frontal and
 * passes the quality checks.
 */
import { useEffect, useRef, useState } from 'react';
import { qualityIssues, ISSUE_HINTS, type FaceAnalysis } from '@/lib/face/analysis';
import type { OvalTone } from '@/components/face/FaceCamera';

export type LivenessStep = 'align' | 'blink' | 'turn' | 'return' | 'done';

const EYES_CLOSED = 0.45;
const EYES_OPEN = 0.25;
const TURN_YAW = 0.22;
const HOLD_MS = 500;

export function useLivenessCheck(opts: {
  enabled: boolean;
  analysis: FaceAnalysis;
  latest: () => FaceAnalysis;
  capture: () => string | null;
  onComplete: (image: string) => void;
}) {
  const { enabled, analysis, latest, capture, onComplete } = opts;
  const [step, setStep] = useState<LivenessStep>('align');
  // User's left => positive yaw in the raw (unmirrored) frame. Randomised per attempt.
  const [direction, setDirection] = useState<'left' | 'right'>('left');
  const holdSince = useRef<number | null>(null);
  const eyesWereClosed = useRef(false);
  const completed = useRef(false);

  // Reset whenever the check is (re)started.
  useEffect(() => {
    if (!enabled) return;
    setStep('align');
    setDirection(Math.random() < 0.5 ? 'left' : 'right');
    holdSince.current = null;
    eyesWereClosed.current = false;
    completed.current = false;
  }, [enabled]);

  useEffect(() => {
    if (!enabled || completed.current) return;
    const a = analysis;
    const frontalOk = qualityIssues(a).length === 0;
    const now = performance.now();

    if (step === 'align' || step === 'return') {
      if (!frontalOk) { holdSince.current = null; return; }
      holdSince.current ??= now;
      if (now - holdSince.current < HOLD_MS) return;
      holdSince.current = null;
      if (step === 'align') { setStep('blink'); return; }
      // Capture from the freshest frame, re-checking quality at that instant.
      if (qualityIssues(latest()).length > 0) return;
      const image = capture();
      if (!image) return;
      completed.current = true;
      setStep('done');
      onComplete(image);
      return;
    }

    if (step === 'blink') {
      if (a.faceCount !== 1) return;
      const closed = a.blinkLeft > EYES_CLOSED && a.blinkRight > EYES_CLOSED;
      const open = a.blinkLeft < EYES_OPEN && a.blinkRight < EYES_OPEN;
      if (closed) eyesWereClosed.current = true;
      else if (open && eyesWereClosed.current) setStep('turn');
      return;
    }

    if (step === 'turn') {
      if (a.faceCount !== 1) return;
      const turned = direction === 'left' ? a.yaw > TURN_YAW : a.yaw < -TURN_YAW;
      if (turned) setStep('return');
    }
  }, [analysis, enabled, step, direction, latest, capture, onComplete]);

  const issues = qualityIssues(analysis);
  let instruction: string;
  let tone: OvalTone = 'neutral';
  switch (step) {
    case 'align':
    case 'return':
      instruction = issues.length ? ISSUE_HINTS[issues[0]] : step === 'align' ? 'Hold still…' : 'Hold still — capturing';
      if (step === 'return' && issues[0] === 'not_frontal') instruction = 'Now look straight at the camera';
      tone = issues.length ? 'guide' : 'good';
      break;
    case 'blink':
      instruction = analysis.faceCount === 1 ? 'Blink slowly' : ISSUE_HINTS.no_face;
      tone = 'good';
      break;
    case 'turn':
      instruction = `Turn your head to your ${direction}`;
      tone = 'good';
      break;
    default:
      instruction = 'Verifying…';
      tone = 'done';
  }
  const order: LivenessStep[] = ['align', 'blink', 'turn', 'return', 'done'];
  return { step, instruction, tone, progress: { done: order.indexOf(step), total: 4 } };
}
