import { auth } from '@/lib/firebase/config';

// Same-origin by default (proxied to the Python API by next.config.ts rewrites).
const API_URL = process.env.NEXT_PUBLIC_API_URL || '/backend';

/**
 * fetch() against the Python backend with the signed-in user's Firebase ID token.
 * The backend derives the user's identity from this token — never from the request body.
 */
async function authedFetch(path: string, init: RequestInit = {}): Promise<Response> {
  await auth.authStateReady();
  const user = auth.currentUser;
  if (!user) throw new Error('You are signed out. Please sign in again.');
  const token = await user.getIdToken();
  return fetch(`${API_URL}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      ...(init.headers || {}),
    },
  });
}

async function readError(response: Response, fallback: string): Promise<string> {
  const body = await response.json().catch(() => ({}));
  if (typeof body.detail === 'string') return body.detail;
  return fallback;
}

/** Replace the signed-in user's face template with 3–6 aligned face crops (one per pose). */
export async function enrollFace(images: string[]): Promise<{ success: boolean; message?: string; error?: string }> {
  try {
    const response = await authedFetch('/api/face/enroll', {
      method: 'POST',
      body: JSON.stringify({ images }),
    });
    if (!response.ok) return { success: false, error: await readError(response, 'Enrollment failed') };
    return await response.json();
  } catch (error: any) {
    return { success: false, error: 'Network error: ' + error.message };
  }
}

export interface FaceStatus {
  enrolled: boolean;
  /** Enrolled with an older face pipeline — must enroll again. */
  needs_reenroll?: boolean;
}

export async function checkFaceEnrolled(): Promise<FaceStatus> {
  try {
    const response = await authedFetch('/api/face/status');
    if (!response.ok) return { enrolled: false };
    return await response.json();
  } catch {
    return { enrolled: false };
  }
}

export async function deleteFace(): Promise<{ success: boolean }> {
  try {
    const response = await authedFetch('/api/face/me', { method: 'DELETE' });
    if (!response.ok) return { success: false };
    return await response.json();
  } catch {
    return { success: false };
  }
}

export type MarkAttendanceStatus =
  | 'recorded'
  | 'already_recorded'
  | 'face_mismatch'
  | 'no_face'
  | 'out_of_range'
  | 'phase_closed'
  | 'no_phase1'
  | 'too_many_attempts'
  | 'not_enrolled'
  | 'not_enrolled_face'
  | 'no_session'
  | 'forbidden'
  | 'error';

export interface MarkAttendanceResult {
  status: MarkAttendanceStatus;
  message: string;
  phase?: 'phase1' | 'phase2';
  score?: number;
  confidence?: number;
  threshold?: number;
  distance?: number;
  radius?: number;
  attempts_remaining?: number;
  needs_reenroll?: boolean;
}

/**
 * Submit a camera frame + GPS fix. The server checks the session window, enrollment,
 * distance and face match, and writes the attendance record itself.
 */
export async function markAttendance(data: {
  sessionId: string;
  image: string;
  latitude: number;
  longitude: number;
  accuracy?: number;
}): Promise<MarkAttendanceResult> {
  try {
    const response = await authedFetch('/api/attendance/mark', {
      method: 'POST',
      body: JSON.stringify({
        session_id: data.sessionId,
        image: data.image,
        latitude: data.latitude,
        longitude: data.longitude,
        accuracy: data.accuracy ?? null,
      }),
    });
    if (!response.ok) {
      return { status: 'error', message: await readError(response, 'Could not reach the attendance server.') };
    }
    return await response.json();
  } catch (error: any) {
    return { status: 'error', message: 'Network error: ' + error.message };
  }
}
