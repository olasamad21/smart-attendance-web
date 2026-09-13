import {
  collection, doc, setDoc, getDocs, getDoc,
  query, where, orderBy, updateDoc,
  serverTimestamp, onSnapshot
} from 'firebase/firestore';
import { db } from '@/lib/firebase/config';
import { AttendanceRecord } from '@/types';

export async function recordPhase1(data: {
  sessionId: string;
  courseId: string;
  studentId: string;
  studentName: string;
  matricNumber: string;
  phase1Score: number;
  faceMatchConfidence: number;
  gpsDistance: number;
}): Promise<AttendanceRecord> {
  // Check duplicate
  const dupQ = query(
    collection(db, 'attendance'),
    where('sessionId', '==', data.sessionId),
    where('studentId', '==', data.studentId)
  );
  const existing = await getDocs(dupQ);
  if (!existing.empty) throw new Error('ALREADY_RECORDED');

  const attendanceId = doc(collection(db, 'attendance')).id;
  const record: any = {
    attendanceId,
    ...data,
    phase1Status: data.phase1Score > 0 ? 'present' : 'failed',
    phase1Time: serverTimestamp(),
    phase2Score: 0,
    phase2Time: null,
    phase2Status: 'absent',
    totalScore: data.phase1Score,
    remark: 'Present',
    timestamp: serverTimestamp(),
    phase1VerificationMethod: 'face_gps'
  };
  await setDoc(doc(db, 'attendance', attendanceId), record);
  return { ...record, phase1Time: new Date() as any };
}

export async function recordPhase2(
  sessionId: string,
  studentId: string,
  data: { phase2Score: number; faceMatchConfidence: number; gpsDistance: number }
): Promise<void> {
  const q = query(
    collection(db, 'attendance'),
    where('sessionId', '==', sessionId),
    where('studentId', '==', studentId)
  );
  const snap = await getDocs(q);
  if (snap.empty) throw new Error('NO_PHASE1_RECORD');

  const recordDoc = snap.docs[0];
  const existing = recordDoc.data();
  const totalScore = (existing.phase1Score || 0) + data.phase2Score;

  let remark = 'Present';
  if (existing.phase1Score > 0 && data.phase2Score > 0) remark = 'Present';
  else if (existing.phase1Score > 0 && data.phase2Score === 0) remark = 'Left Early';
  else if (existing.phase1Score === 0 && data.phase2Score > 0) remark = 'Late';
  else remark = 'Absent';

  await updateDoc(doc(db, 'attendance', recordDoc.id), {
    phase2Score: data.phase2Score,
    phase2Time: serverTimestamp(),
    phase2Status: data.phase2Score > 0 ? 'present' : 'absent',
    phase2Confidence: data.faceMatchConfidence,
    phase2GpsDistance: data.gpsDistance,
    totalScore,
    remark,
    phase2VerificationMethod: 'face_gps'
  });
}

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
  const q = query(
    collection(db, 'attendance'),
    where('sessionId', '==', data.sessionId),
    where('studentId', '==', data.studentId)
  );
  const snap = await getDocs(q);
  const existing = snap.empty ? null : snap.docs[0];

  if (data.activePhase === 'phase1_open') {
    if (existing) {
      const existingData = existing.data() as AttendanceRecord;
      if (existingData.phase1Score > 0 || existingData.phase1VerificationMethod) {
        throw new Error("Student already has a Phase 1 record.");
      }
    }
    const attendanceId = doc(collection(db, 'attendance')).id;
    await setDoc(doc(db, 'attendance', attendanceId), {
      attendanceId,
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
      overriddenBy: data.lecturerId,
      overrideReason: data.reason,
      overrideTimestamp: serverTimestamp(),
    });
  } else if (data.activePhase === 'phase2_open') {
    if (existing) {
      const existingData = existing.data() as AttendanceRecord;
      if (existingData.phase2Score > 0 || existingData.phase2VerificationMethod) {
        throw new Error("Student already has a Phase 2 record.");
      }
      await updateDoc(doc(db, 'attendance', existing.id), {
        phase2Score: data.phase2Max,
        phase2Status: 'present',
        phase2Time: serverTimestamp(),
        totalScore: (existingData.phase1Score || 0) + data.phase2Max,
        remark: (existingData.phase1Score > 0) ? 'Present (Manual)' : 'Late (Manual)',
        phase2VerificationMethod: 'manual_override',
        overriddenBy: data.lecturerId,
        overrideReason: data.reason,
        overrideTimestamp: serverTimestamp(),
      });
    } else {
      const attendanceId = doc(collection(db, 'attendance')).id;
      await setDoc(doc(db, 'attendance', attendanceId), {
        attendanceId,
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
        overriddenBy: data.lecturerId,
        overrideReason: data.reason,
        overrideTimestamp: serverTimestamp(),
      });
    }
  } else {
    throw new Error("Session is not currently active for overrides.");
  }
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
