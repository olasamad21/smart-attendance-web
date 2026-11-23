'use client';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/store/auth.store';

/** Entry point: sends signed-in users to their dashboard and everyone else to login. */
export default function HomePage() {
  const router = useRouter();
  const { user, isLoading } = useAuthStore();

  useEffect(() => {
    if (isLoading) return;
    if (!user) {
      router.replace('/login');
    } else if (user.role === 'lecturer') {
      router.replace('/lecturer/dashboard');
    } else {
      router.replace('/student/dashboard');
    }
  }, [user, isLoading, router]);

  return (
    <div className="min-h-dvh flex items-center justify-center bg-background">
      <div className="flex flex-col items-center gap-4">
        <h1 className="text-2xl font-bold text-primary tracking-tight">EduVerify</h1>
        <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" aria-hidden />
        <p className="text-on-surface-variant text-sm">Loading…</p>
      </div>
    </div>
  );
}
