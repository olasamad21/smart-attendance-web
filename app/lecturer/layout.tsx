'use client';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/store/auth.store';
import LecturerBottomNav from '@/components/layout/LecturerBottomNav';

export default function LecturerLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { user, isLoading } = useAuthStore();

  useEffect(() => {
    if (!isLoading && (!user || user.role !== 'lecturer')) {
      router.replace('/login');
    }
  }, [user, isLoading, router]);

  // Show spinner while auth is loading - never redirect during loading
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  // Only redirect after loading is confirmed complete
  if (!user || user.role !== 'lecturer') {
    return null;
  }

  return (
    <div className="bg-background min-h-[100dvh] pb-20">
      {children}
      <LecturerBottomNav />
    </div>
  );
}
