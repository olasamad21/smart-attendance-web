import {
  collection, doc, getDocs, getDoc,
  query, where, updateDoc,
  serverTimestamp, onSnapshot, runTransaction
} from 'firebase/firestore';
import { db } from '@/lib/firebase/config';
import { AttendanceRecord } from '@/types';

/**
 * Deterministic attendance id — one record per student per session.
 * Must match attendance_doc_id() in python-backend/services/attendance_service.py.
 */
export function attendanceDocId(sessionId: string, studentId: string): string {
  return `${sessionId}_${studentId}`;
}

/** Deterministic record first, then legacy random-id records created before this scheme. */
async function findAttendanceRef(sessionId: string, studentId: string) {
  const ref = doc(db, 'attendance', attendanceDocId(sessionId, studentId));
  const snap = await getDoc(ref);
  if (snap.exists()) return { ref, isLegacy: false };
  const legacy = await getDocs(query(
    collection(db, 'attendance'),
    where('sessionId', '==', sessionId),
    where('studentId', '==', studentId)
  ));
  if (!legacy.empty) return { ref: legacy.docs[0].ref, isLegacy: true };
  return { ref, isLegacy: false };
}

// Students' own check-ins/check-outs are written by the backend
// (POST /api/attendance/mark). Only the course lecturer writes here.

export async function recordManualOverride(data: {
  sessionId: string;
  courseId: string;
  studentId: string;
  studentName: string;
  matricNumber: string;
  activePhase: 'phase1_open' | 'phase2_open';
  phase1Max: number;
  phase2Max: number;
  lecturerId: string;
  reason: string | null;
}): Promise<void> {
  if (data.activePhase !== 'phase1_open' && data.activePhase !== 'phase2_open') {
    throw new Error('Session is not currently active for overrides.');
  }
  const { ref } = await findAttendanceRef(data.sessionId, data.studentId);
  const override = {
    overriddenBy: data.lecturerId,
    overrideReason: data.reason,
    overrideTimestamp: serverTimestamp(),
  };

  // Transaction: if the student's own check-in lands at the same moment, we see it
  // and refuse instead of overwriting it.
  await runTransaction(db, async (txn) => {
    const snap = await txn.get(ref);
    const existing = snap.exists() ? (snap.data() as AttendanceRecord) : null;

    if (data.activePhase === 'phase1_open') {
      if (existing) throw new Error('Student already has a Phase 1 record.');
      txn.set(ref, {
        attendanceId: ref.id,
        sessionId: data.sessionId,
        courseId: data.courseId,
        studentId: data.studentId,
        studentName: data.studentName,
        matricNumber: data.matricNumber,
        phase1Score: data.phase1Max,
        phase1Status: 'present',
        phase1Time: serverTimestamp(),
        phase2Score: 0,
        phase2Status: 'absent',
        phase2Time: null,
        totalScore: data.phase1Max,
        remark: 'Present (Manual)',
        timestamp: serverTimestamp(),
        phase1VerificationMethod: 'manual_override',
        ...override,
      });
      return;
    }

    if (existing) {
      if (existing.phase2Score > 0 || existing.phase2VerificationMethod) {
        throw new Error('Student already has a Phase 2 record.');
      }
      txn.update(ref, {
        phase2Score: data.phase2Max,
        phase2Status: 'present',
        phase2Time: serverTimestamp(),
        totalScore: (existing.phase1Score || 0) + data.phase2Max,
        remark: existing.phase1Score > 0 ? 'Present (Manual)' : 'Late (Manual)',
        phase2VerificationMethod: 'manual_override',
        ...override,
      });
      return;
    }

    txn.set(ref, {
      attendanceId: ref.id,
      sessionId: data.sessionId,
      courseId: data.courseId,
      studentId: data.studentId,
      studentName: data.studentName,
      matricNumber: data.matricNumber,
      phase1Score: 0,
      phase1Status: 'absent',
      phase1Time: null,
      phase2Score: data.phase2Max,
      phase2Status: 'present',
      phase2Time: serverTimestamp(),
      totalScore: data.phase2Max,
      remark: 'Late (Manual)',
      timestamp: serverTimestamp(),
      phase2VerificationMethod: 'manual_override',
      ...override,
    });
  });
}

export async function awardFullMarksAndEnd(sessionId: string, phase2MaxScore: number): Promise<void> {
  // Get all records for this session where student checked in during Phase 1
  const q = query(
    collection(db, 'attendance'),
    where('sessionId', '==', sessionId)
  );
  const snap = await getDocs(q);
  
  const updates = snap.docs.map(async (d) => {
    const data = d.data() as AttendanceRecord;
    // If they got points in Phase 1, award them Phase 2 points
    if (data.phase1Score > 0) {
      await updateDoc(doc(db, 'attendance', d.id), {
        phase2Score: phase2MaxScore,
        phase2Time: serverTimestamp(),
        phase2Status: 'present',
        totalScore: data.phase1Score + phase2MaxScore,
        remark: 'Present (Emergency)',
      });
    }
  });
  
  await Promise.all(updates);
  
  // Import endSession dynamically to avoid circular dependencies if any
  const { endSession } = await import('./sessions.service');
  await endSession(sessionId);
}

export async function getSessionAttendance(sessionId: string): Promise<AttendanceRecord[]> {
  if (!sessionId) return [];
  const q = query(
    collection(db, 'attendance'),
    where('sessionId', '==', sessionId)
  );
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ attendanceId: d.id, ...d.data() } as AttendanceRecord));
}

export function subscribeToSessionAttendance(
  sessionId: string,
  callback: (records: AttendanceRecord[]) => void
): () => void {
  const q = query(
    collection(db, 'attendance'),
    where('sessionId', '==', sessionId)
  );
  return onSnapshot(q, (snap) => {
    callback(snap.docs.map(d => ({ attendanceId: d.id, ...d.data() } as AttendanceRecord)));
  });
}

/**
 * Get all attendance records for a specific student, ordered by most recent first.
 */
export async function getStudentAttendanceHistory(studentId: string): Promise<AttendanceRecord[]> {
  if (!studentId) return [];
  const q = query(
    collection(db, 'attendance'),
    where('studentId', '==', studentId)
  );
  const snap = await getDocs(q);
  const records = snap.docs.map(d => ({ attendanceId: d.id, ...d.data() } as AttendanceRecord));
  
  // Sort in memory to avoid requiring a composite index in Firestore
  records.sort((a, b) => {
    const timeA = a.timestamp?.seconds || 0;
    const timeB = b.timestamp?.seconds || 0;
    return timeB - timeA; // Descending (newest first)
  });
  
  return records;
}

export async function getCourseAttendanceOverview(courseId: string): Promise<AttendanceRecord[]> {
  if (!courseId) return [];
  const q = query(
    collection(db, 'attendance'),
    where('courseId', '==', courseId)
  );
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ attendanceId: d.id, ...d.data() } as AttendanceRecord));
}

/**
 * Overall attendance across the given courses: sessions the student has a record for,
 * out of all sessions held in those courses. Same rule as the per-course page.
 */
export async function getStudentOverallAttendance(
  studentId: string,
  courseIds: string[],
): Promise<{ attended: number; total: number; percentage: number | null }> {
  if (!studentId || courseIds.length === 0) return { attended: 0, total: 0, percentage: null };
  const { getSessionsForCourse } = await import('./sessions.service');
  const [records, sessionLists] = await Promise.all([
    getStudentAttendanceHistory(studentId),
    Promise.all(courseIds.map(id => getSessionsForCourse(id).catch(() => []))),
  ]);
  const sessionIds = new Set(sessionLists.flat().map(s => s.sessionId));
  const attended = new Set(records.filter(r => sessionIds.has(r.sessionId)).map(r => r.sessionId)).size;
  const total = sessionIds.size;
  return { attended, total, percentage: total > 0 ? Math.round((attended / total) * 100) : null };
}
