/**
 * Pure face-frame analysis on top of MediaPipe Face Landmarker output.
 *
 * Coordinates are normalised (0–1) in the RAW camera frame — not the mirrored preview.
 * In the raw frame of a front camera, the user's left side appears on the image's right,
 * so when the user turns their head to THEIR left, the nose moves toward +x.
 */
import type { FaceLandmarkerResult, NormalizedLandmark } from '@mediapipe/tasks-vision';

// MediaPipe face-mesh landmark indices
const NOSE_TIP = 1;
const EYE_OUTER_A = 33;   // outer corner of one eye
const EYE_OUTER_B = 263;  // outer corner of the other eye
const IRIS_A = 468;
const IRIS_B = 473;

export interface FaceBox { x: number; y: number; width: number; height: number }

export interface FaceAnalysis {
  faceCount: number;
  box: FaceBox | null;
  /** Head turn: ~0 facing camera, > 0 turned to the user's left, < 0 to the user's right. */
  yaw: number;
  /** Head tilt in degrees (eye line vs horizontal). */
  rollDeg: number;
  /** 0–1 eye-closure scores from blendshapes. */
  blinkLeft: number;
  blinkRight: number;
  /** Mean luminance of the face area, 0–255 (null until measured). */
  brightness: number | null;
  /** Variance of the Laplacian on the face area — higher is sharper (null until measured). */
  sharpness: number | null;
  /** Eye centres in raw-frame normalised coordinates (for alignment). */
  eyes: [NormalizedLandmark, NormalizedLandmark] | null;
}

export const QUALITY = {
  minFaceWidth: 0.28,   // face width as a fraction of frame width (too far below this)
  maxFaceWidth: 0.85,   // too close above this
  maxCenterOffset: 0.15,
  maxFrontalYaw: 0.12,
  maxRollDeg: 12,
  minBrightness: 60,
  maxBrightness: 215,
  minSharpness: 12,
};

export const EMPTY_ANALYSIS: FaceAnalysis = {
  faceCount: 0, box: null, yaw: 0, rollDeg: 0, blinkLeft: 0, blinkRight: 0,
  brightness: null, sharpness: null, eyes: null,
};

function blendshape(result: FaceLandmarkerResult, name: string): number {
  const cats = result.faceBlendshapes?.[0]?.categories ?? [];
  return cats.find(c => c.categoryName === name)?.score ?? 0;
}

export function analyzeLandmarks(result: FaceLandmarkerResult): FaceAnalysis {
  const faces = result.faceLandmarks ?? [];
  if (faces.length === 0) return { ...EMPTY_ANALYSIS };
  const lm = faces[0];

  let minX = 1, minY = 1, maxX = 0, maxY = 0;
  for (const p of lm) {
    if (p.x < minX) minX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.x > maxX) maxX = p.x;
    if (p.y > maxY) maxY = p.y;
  }
  const box = { x: minX, y: minY, width: maxX - minX, height: maxY - minY };

  const a = lm[EYE_OUTER_A], b = lm[EYE_OUTER_B], nose = lm[NOSE_TIP];
  const eyeDist = Math.hypot(b.x - a.x, b.y - a.y) || 1e-6;
  const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
  const yaw = (nose.x - mid.x) / eyeDist;

  const [left, right] = a.x < b.x ? [a, b] : [b, a];
  const rollDeg = (Math.atan2(right.y - left.y, right.x - left.x) * 180) / Math.PI;

  const irisA = lm[IRIS_A] ?? a, irisB = lm[IRIS_B] ?? b;
  const eyes: [NormalizedLandmark, NormalizedLandmark] = irisA.x < irisB.x ? [irisA, irisB] : [irisB, irisA];

  return {
    faceCount: faces.length,
    box,
    yaw,
    rollDeg,
    blinkLeft: blendshape(result, 'eyeBlinkLeft'),
    blinkRight: blendshape(result, 'eyeBlinkRight'),
    brightness: null,
    sharpness: null,
    eyes,
  };
}

/** Brightness + sharpness of the face region, measured on a small greyscale copy. */
export function measureImageQuality(
  source: CanvasImageSource, frameW: number, frameH: number, box: FaceBox, scratch: HTMLCanvasElement,
): { brightness: number; sharpness: number } {
  const size = 96;
  scratch.width = size;
  scratch.height = size;
  const ctx = scratch.getContext('2d', { willReadFrequently: true });
  if (!ctx) return { brightness: 128, sharpness: 100 };
  ctx.drawImage(source, box.x * frameW, box.y * frameH, box.width * frameW, box.height * frameH, 0, 0, size, size);
  const { data } = ctx.getImageData(0, 0, size, size);

  const gray = new Float32Array(size * size);
  let sum = 0;
  for (let i = 0; i < gray.length; i++) {
    const g = 0.299 * data[i * 4] + 0.587 * data[i * 4 + 1] + 0.114 * data[i * 4 + 2];
    gray[i] = g;
    sum += g;
  }
  const brightness = sum / gray.length;

  let lapSum = 0, lapSq = 0, n = 0;
  for (let y = 1; y < size - 1; y++) {
    for (let x = 1; x < size - 1; x++) {
      const i = y * size + x;
      const lap = gray[i - size] + gray[i + size] + gray[i - 1] + gray[i + 1] - 4 * gray[i];
      lapSum += lap;
      lapSq += lap * lap;
      n++;
    }
  }
  const mean = lapSum / n;
  return { brightness, sharpness: lapSq / n - mean * mean };
}

export type QualityIssue =
  | 'no_face' | 'multiple_faces' | 'too_far' | 'too_close' | 'off_center'
  | 'not_frontal' | 'tilted' | 'too_dark' | 'too_bright' | 'blurry';

export const ISSUE_HINTS: Record<QualityIssue, string> = {
  no_face: 'Position your face in the oval',
  multiple_faces: 'Only one person should be in the frame',
  too_far: 'Move closer',
  too_close: 'Move back a little',
  off_center: 'Centre your face in the oval',
  not_frontal: 'Look straight at the camera',
  tilted: 'Keep your head level',
  too_dark: 'Find better lighting',
  too_bright: 'Too much light behind or on you',
  blurry: 'Hold still',
};

/** Issues for a frontal capture. Pose checks can be skipped for turned-head enrollment shots. */
export function qualityIssues(a: FaceAnalysis, opts: { requireFrontal?: boolean } = {}): QualityIssue[] {
  const { requireFrontal = true } = opts;
  if (a.faceCount === 0 || !a.box) return ['no_face'];
  const issues: QualityIssue[] = [];
  if (a.faceCount > 1) issues.push('multiple_faces');
  if (a.box.width < QUALITY.minFaceWidth) issues.push('too_far');
  if (a.box.width > QUALITY.maxFaceWidth) issues.push('too_close');
  const cx = a.box.x + a.box.width / 2, cy = a.box.y + a.box.height / 2;
  if (Math.abs(cx - 0.5) > QUALITY.maxCenterOffset || Math.abs(cy - 0.5) > QUALITY.maxCenterOffset + 0.05) {
    issues.push('off_center');
  }
  if (requireFrontal && Math.abs(a.yaw) > QUALITY.maxFrontalYaw) issues.push('not_frontal');
  if (Math.abs(a.rollDeg) > QUALITY.maxRollDeg) issues.push('tilted');
  if (a.brightness !== null && a.brightness < QUALITY.minBrightness) issues.push('too_dark');
  if (a.brightness !== null && a.brightness > QUALITY.maxBrightness) issues.push('too_bright');
  if (a.sharpness !== null && a.sharpness < QUALITY.minSharpness) issues.push('blurry');
  return issues;
}

/**
 * Crop the face out of the raw frame, rotated so the eyes are level, as a square JPEG.
 * Sending a tight, aligned face (instead of the whole camera frame) makes server-side
 * detection reliable and embeddings consistent, and shrinks the upload ~20×.
 */
export function cropAlignedFace(
  source: CanvasImageSource, frameW: number, frameH: number, a: FaceAnalysis, out: HTMLCanvasElement,
  outputSize = 320,
): string | null {
  if (!a.box || !a.eyes) return null;
  const [l, r] = a.eyes;
  const angle = Math.atan2((r.y - l.y) * frameH, (r.x - l.x) * frameW);
  const cx = (a.box.x + a.box.width / 2) * frameW;
  const cy = (a.box.y + a.box.height / 2) * frameH;
  const side = Math.max(a.box.width * frameW, a.box.height * frameH) * 1.45;

  out.width = outputSize;
  out.height = outputSize;
  const ctx = out.getContext('2d');
  if (!ctx) return null;
  const scale = outputSize / side;
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, outputSize, outputSize);
  ctx.save();
  ctx.translate(outputSize / 2, outputSize / 2);
  ctx.rotate(-angle);
  ctx.scale(scale, scale);
  ctx.drawImage(source, -cx, -cy, frameW, frameH);
  ctx.restore();
  return out.toDataURL('image/jpeg', 0.9);
}
