'use client';
import { useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useAuthStore } from '@/store/auth.store';
import StudentBottomNav from '@/components/layout/StudentBottomNav';

export default function StudentLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { user, isLoading } = useAuthStore();
  const pathname = usePathname();
  // Check-in and face enrollment are focused, full-screen flows: no tab bar.
  const fullScreen = pathname.startsWith('/student/verify') || pathname.startsWith('/student/enroll');

  useEffect(() => {
    if (!isLoading && (!user || user.role !== 'student')) {
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
  if (!user || user.role !== 'student') {
    return null;
  }

  return (
    <div className={`bg-background ${fullScreen ? '' : 'pb-20'}`}>
      {children}
      {!fullScreen && <StudentBottomNav />}
    </div>
  );
}
