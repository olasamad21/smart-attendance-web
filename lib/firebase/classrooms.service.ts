import {
  collection, doc, setDoc, getDocs,
  getDoc, updateDoc, deleteDoc
} from 'firebase/firestore';
import { db } from '@/lib/firebase/config';
import { Classroom } from '@/types';

export async function createClassroom(data: Omit<Classroom, 'classroomId'>): Promise<Classroom> {
  const classroomId = doc(collection(db, 'classrooms')).id;
  const classroom = { classroomId, ...data };
  await setDoc(doc(db, 'classrooms', classroomId), classroom);
  return classroom;
}

export async function getClassrooms(): Promise<Classroom[]> {
  const snap = await getDocs(collection(db, 'classrooms'));
  return snap.docs.map(d => ({ classroomId: d.id, ...d.data() } as Classroom));
}

export async function getClassroomById(id: string): Promise<Classroom | null> {
  const snap = await getDoc(doc(db, 'classrooms', id));
  if (!snap.exists()) return null;
  return { classroomId: snap.id, ...snap.data() } as Classroom;
}

export async function updateClassroom(id: string, data: Partial<Classroom>): Promise<void> {
  await updateDoc(doc(db, 'classrooms', id), data as any);
}

export async function deleteClassroom(id: string): Promise<void> {
  await deleteDoc(doc(db, 'classrooms', id));
}
