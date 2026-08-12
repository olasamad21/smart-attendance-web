'use client';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/store/auth.store';

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
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="flex flex-col items-center gap-4">
        <div className="w-12 h-12 border-4 border-[#2D6A4F] border-t-transparent rounded-full animate-spin" />
        <p className="text-gray-500 text-sm">Loading...</p>
      </div>
    </div>
  );
}
