import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  deleteUser,
} from 'firebase/auth';
import { doc, setDoc, getDoc, getDocs, collection, query, where, serverTimestamp } from 'firebase/firestore';
import { auth, db } from '@/lib/firebase/config';
import { UserProfile } from '@/types';

export async function registerUser(
  name: string,
  email: string,
  password: string,
  role: 'lecturer' | 'student',
  extra?: { department?: string; level?: string; matricNumber?: string }
): Promise<UserProfile> {
  // Enforce matric number uniqueness for students
  if (role === 'student' && extra?.matricNumber) {
    const q = query(collection(db, 'users'), where('matricNumber', '==', extra.matricNumber));
    const snap = await getDocs(q);
    if (!snap.empty) throw new Error('MATRIC_ALREADY_IN_USE');
  }

  const credential = await createUserWithEmailAndPassword(auth, email, password);
  const uid = credential.user.uid;

  // Ensure auth token is ready before Firestore write (avoids permission-denied race)
  await auth.authStateReady();
  await credential.user.getIdToken(true);

  const profile: Omit<UserProfile, 'createdAt'> & { createdAt: any } = {
    userId: uid,
    name,
    email,
    role,
    department: extra?.department || '',
    level: extra?.level || '',
    matricNumber: extra?.matricNumber || '',
    createdAt: serverTimestamp(),
  };

  try {
    await setDoc(doc(db, 'users', uid), profile);
  } catch (error) {
    await deleteUser(credential.user).catch(() => {});
    throw error;
  }

  // Wait for Firestore write to propagate
  await new Promise(resolve => setTimeout(resolve, 500));

  return { ...profile, createdAt: new Date() as any };
}

export async function loginUser(
  email: string,
  password: string
): Promise<UserProfile> {
  const credential = await signInWithEmailAndPassword(auth, email, password);
  const uid = credential.user.uid;
  const userDoc = await getDoc(doc(db, 'users', uid));
  if (!userDoc.exists()) throw new Error('User profile not found');
  return { userId: uid, ...userDoc.data() } as UserProfile;
}

export async function logoutUser(): Promise<void> {
  await signOut(auth);
}

export async function getCurrentUserProfile(): Promise<UserProfile | null> {
  const user = auth.currentUser;
  if (!user) return null;
  const userDoc = await getDoc(doc(db, 'users', user.uid));
  if (!userDoc.exists()) return null;
  return { userId: user.uid, ...userDoc.data() } as UserProfile;
}

export function onAuthChange(
  callback: (user: UserProfile | null) => void
): () => void {
  return onAuthStateChanged(auth, async (firebaseUser) => {
    if (firebaseUser) {
      try {
        const userDoc = await getDoc(doc(db, 'users', firebaseUser.uid));
        if (userDoc.exists()) {
          callback({ userId: firebaseUser.uid, ...userDoc.data() } as UserProfile);
        } else {
          callback(null);
        }
      } catch {
        callback(null);
      }
    } else {
      callback(null);
    }
  });
}
