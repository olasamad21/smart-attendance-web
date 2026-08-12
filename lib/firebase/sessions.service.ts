import {
  collection, doc, setDoc, getDoc, getDocs,
  query, where, orderBy, updateDoc,
  serverTimestamp, onSnapshot, Timestamp
} from 'firebase/firestore';
import { db } from '@/lib/firebase/config';
import { Session } from '@/types';

export async function startSession(data: {
  courseId: string;
  courseTitle: string;
  courseCode: string;
  lecturerId: string;
  classroomId: string;
  classroomName: string;
  classroomLat: number;
  classroomLng: number;
  classroomRadius: number;
  phase1Duration: number;
  phase2Duration: number;
}): Promise<Session> {
  const sessionId = doc(collection(db, 'sessions')).id;
  const now = new Date();
  const phase1End = new Date(now.getTime() + data.phase1Duration * 60000);
  const phase2Start = new Date(phase1End.getTime() + 5 * 60000);
  const phase2End = new Date(phase2Start.getTime() + data.phase2Duration * 60000);

  const session: any = {
    sessionId,
    ...data,
    status: 'phase1_open',
    phase1Start: serverTimestamp(),
    phase1End: Timestamp.fromDate(phase1End),
    phase2Start: Timestamp.fromDate(phase2Start),
    phase2End: Timestamp.fromDate(phase2End),
    createdAt: serverTimestamp(),
  };

  await setDoc(doc(db, 'sessions', sessionId), session);
  return { ...session, phase1Start: now as any, createdAt: now as any };
}

export async function updateSessionStatus(
  sessionId: string,
  status: Session['status']
): Promise<void> {
  await updateDoc(doc(db, 'sessions', sessionId), { status });
}

export async function endSession(sessionId: string): Promise<void> {
  await updateDoc(doc(db, 'sessions', sessionId), {
    status: 'ended',
    phase2End: serverTimestamp(),
  });
}

export async function getSessionById(sessionId: string): Promise<Session | null> {
  const snap = await getDoc(doc(db, 'sessions', sessionId));
  if (!snap.exists()) return null;
  return { sessionId: snap.id, ...snap.data() } as Session;
}

export async function getActiveSessionForCourse(courseId: string): Promise<Session | null> {
  if (!courseId) return null;
  try {
    const q = query(
      collection(db, 'sessions'),
      where('courseId', '==', courseId),
      orderBy('createdAt', 'desc')
    );
    const snap = await getDocs(q);
    if (snap.empty) return null;
    // Filter in memory instead of using != operator
    const activeSessions = snap.docs
      .map(d => ({ sessionId: d.id, ...d.data() } as Session))
      .filter(s => s.status !== 'ended');
    return activeSessions.length > 0 ? activeSessions[0] : null;
  } catch (e) {
    console.error('getActiveSessionForCourse error:', e);
    return null;
  }
}

export async function getSessionsForCourse(courseId: string): Promise<Session[]> {
  if (!courseId) return [];
  const q = query(
    collection(db, 'sessions'),
    where('courseId', '==', courseId),
    orderBy('createdAt', 'desc')
  );
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ sessionId: d.id, ...d.data() } as Session));
}

export function subscribeToSession(
  sessionId: string,
  callback: (session: Session | null) => void
): () => void {
  return onSnapshot(doc(db, 'sessions', sessionId), (snap) => {
    if (!snap.exists()) { callback(null); return; }
    callback({ sessionId: snap.id, ...snap.data() } as Session);
  });
}

/**
 * Self-healing phase sync: computes the correct phase from timestamps
 * and updates Firestore if the stored status is stale.
 * Returns the session with the corrected status.
 */
export async function syncSessionPhase(session: Session): Promise<Session> {
  const { resolveSessionPhase } = await import('@/lib/utils/session.utils');
  const correctStatus = resolveSessionPhase(session);

  if (session.status !== correctStatus && session.status !== 'ended') {
    if (correctStatus === 'ended') {
      await endSession(session.sessionId);
    } else {
      await updateSessionStatus(session.sessionId, correctStatus);
    }
    return { ...session, status: correctStatus };
  }
  return session;
}

/**
 * Get the active session for a course, auto-syncing the phase status.
 * Use this from student-side pages to ensure phase is always correct.
 */
export async function getActiveSessionWithSync(courseId: string): Promise<Session | null> {
  const session = await getActiveSessionForCourse(courseId);
  if (!session) return null;
  const synced = await syncSessionPhase(session);
  // If the sync determined it's ended, there's no active session
  if (synced.status === 'ended') return null;
  return synced;
}

/**
 * Get a student's attendance record for a specific session.
 */
export async function getStudentSessionAttendance(
  sessionId: string,
  studentId: string
): Promise<import('@/types').AttendanceRecord | null> {
  const q = query(
    collection(db, 'attendance'),
    where('sessionId', '==', sessionId),
    where('studentId', '==', studentId)
  );
  const snap = await getDocs(q);
  if (snap.empty) return null;
  return { attendanceId: snap.docs[0].id, ...snap.docs[0].data() } as import('@/types').AttendanceRecord;
}
