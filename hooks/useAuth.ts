'use client';
import { useEffect } from 'react';
import { useAuthStore } from '@/store/auth.store';
import { onAuthChange } from '@/lib/firebase/auth.service';

export function useAuth() {
  const { user, isLoading, setUser, clearUser, setLoading } = useAuthStore();

  useEffect(() => {
    setLoading(true);
    const unsubscribe = onAuthChange((userProfile) => {
      if (userProfile) {
        setUser(userProfile);
      } else {
        clearUser();
      }
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  return { user, isLoading, isAuthenticated: !!user };
}
