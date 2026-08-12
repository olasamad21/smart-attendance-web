import {
  collection, doc, setDoc, getDoc, getDocs,
  query, where, orderBy, deleteDoc, updateDoc,
  serverTimestamp, writeBatch
} from 'firebase/firestore';
import { db } from '@/lib/firebase/config';
import { Course, Enrollment, UserProfile } from '@/types';

export function generateEnrollmentKey(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let key = '';
  for (let i = 0; i < 8; i++) {
    key += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return key;
}

export async function createCourse(data: {
  courseTitle: string;
  courseCode: string;
  lecturerId: string;
  lecturerName: string;
  defaultDuration: number;
  phase1Marks?: number;
  phase2Marks?: number;
}): Promise<Course> {
  // Generate a unique 8-char enrollment key
  let enrollmentKey = '';
  let isUnique = false;
  
  while (!isUnique) {
    enrollmentKey = generateEnrollmentKey();
    const q = query(collection(db, 'courses'), where('enrollmentKey', '==', enrollmentKey));
    const snap = await getDocs(q);
    if (snap.empty) {
      isUnique = true;
    }
  }

  const courseId = doc(collection(db, 'courses')).id;
  const course: Course = {
    courseId,
    courseTitle: data.courseTitle,
    courseCode: data.courseCode.toUpperCase(),
    enrollmentKey,
    lecturerId: data.lecturerId,
    lecturerName: data.lecturerName,
    defaultDuration: data.defaultDuration,
    phase1Marks: data.phase1Marks ?? 3,
    phase2Marks: data.phase2Marks ?? 2,
    marksEdited: false,
    createdAt: serverTimestamp() as any,
  };
  await setDoc(doc(db, 'courses', courseId), course);
  return course;
}

export async function getLecturerCourses(lecturerId: string): Promise<Course[]> {
  if (!lecturerId) return [];
  const q = query(
    collection(db, 'courses'),
    where('lecturerId', '==', lecturerId),
    orderBy('createdAt', 'desc')
  );
  const snapshot = await getDocs(q);
  return snapshot.docs.map(d => ({ courseId: d.id, ...d.data() } as Course));
}

export async function getCourseById(courseId: string): Promise<Course | null> {
  if (!courseId) return null;
  const snap = await getDoc(doc(db, 'courses', courseId));
  if (!snap.exists()) return null;
  return { courseId: snap.id, ...snap.data() } as Course;
}

export async function getCourseByCodeAndKey(courseCode: string, enrollmentKey: string): Promise<Course | null> {
  if (!courseCode || !enrollmentKey) return null;
  const q = query(
    collection(db, 'courses'), 
    where('courseCode', '==', courseCode.toUpperCase()),
    where('enrollmentKey', '==', enrollmentKey.toUpperCase())
  );
  const snapshot = await getDocs(q);
  if (snapshot.empty) return null;
  const d = snapshot.docs[0];
  return { courseId: d.id, ...d.data() } as Course;
}

export async function updateCourse(courseId: string, data: Partial<Course>): Promise<void> {
  await updateDoc(doc(db, 'courses', courseId), data as any);
}

export async function updateCourseSettingsWithRetroactiveScoring(
  courseId: string, 
  data: Partial<Course>,
  isEditingMarks: boolean
): Promise<void> {
  if (!isEditingMarks) {
    await updateCourse(courseId, data);
    return;
  }

  const batch = writeBatch(db);
  
  // 1. Update Course
  const courseRef = doc(db, 'courses', courseId);
  batch.update(courseRef, { ...data, marksEdited: true } as any);

  // 2. Fetch all attendance records for the course
  const q = query(collection(db, 'attendance'), where('courseId', '==', courseId));
  const snap = await getDocs(q);

  // 3. Update records retroactively
  const p1Max = data.phase1Marks ?? 3;
  const p2Max = data.phase2Marks ?? 2;

  snap.docs.forEach(docSnap => {
    const record = docSnap.data();
    let newP1Score = 0;
    let newP2Score = 0;

    if (record.phase1Score > 0) newP1Score = p1Max;
    if (record.phase2Score > 0) newP2Score = p2Max;

    if (newP1Score !== record.phase1Score || newP2Score !== record.phase2Score) {
      batch.update(docSnap.ref, {
        phase1Score: newP1Score,
        phase2Score: newP2Score,
        totalScore: newP1Score + newP2Score
      });
    }
  });

  await batch.commit();
}

export async function deleteCourse(courseId: string): Promise<void> {
  await deleteDoc(doc(db, 'courses', courseId));
}

export async function enrollStudent(courseId: string, studentId: string): Promise<void> {
  if (!courseId || !studentId) throw new Error('Missing required fields.');
  const q = query(
    collection(db, 'enrollments'),
    where('courseId', '==', courseId),
    where('studentId', '==', studentId)
  );
  const existing = await getDocs(q);
  if (!existing.empty) throw new Error('You are already enrolled in this course.');

  const enrollmentId = doc(collection(db, 'enrollments')).id;
  await setDoc(doc(db, 'enrollments', enrollmentId), {
    enrollmentId,
    courseId,
    studentId,
    enrolledAt: serverTimestamp(),
  });
}

export async function getStudentCourses(studentId: string): Promise<Course[]> {
  if (!studentId) return [];
  const q = query(collection(db, 'enrollments'), where('studentId', '==', studentId));
  const snapshot = await getDocs(q);
  const courseIds = snapshot.docs.map(d => d.data().courseId as string);
  if (courseIds.length === 0) return [];
  const courses = await Promise.all(courseIds.map(id => getCourseById(id)));
  return courses.filter(Boolean) as Course[];
}

export async function getEnrolledStudents(courseId: string): Promise<(UserProfile & { enrolledAt?: any })[]> {
  if (!courseId) return [];
  const q = query(collection(db, 'enrollments'), where('courseId', '==', courseId));
  const snapshot = await getDocs(q);
  
  const enrollmentMap = new Map<string, any>();
  snapshot.docs.forEach(d => {
    const data = d.data();
    enrollmentMap.set(data.studentId, data.enrolledAt);
  });

  if (enrollmentMap.size === 0) return [];
  
  const students = await Promise.all(
    Array.from(enrollmentMap.keys()).map(async (id) => {
      const snap = await getDoc(doc(db, 'users', id));
      if (!snap.exists()) return null;
      return { 
        userId: snap.id, 
        ...snap.data(),
        enrolledAt: enrollmentMap.get(id) 
      } as UserProfile & { enrolledAt?: any };
    })
  );
  return students.filter(Boolean) as (UserProfile & { enrolledAt?: any })[];
}

export async function getEnrolledStudentCount(courseId: string): Promise<number> {
  if (!courseId) return 0;
  const q = query(collection(db, 'enrollments'), where('courseId', '==', courseId));
  const snapshot = await getDocs(q);
  return snapshot.size;
}
