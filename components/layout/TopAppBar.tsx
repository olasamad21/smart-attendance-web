'use client';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/store/auth.store';

interface TopAppBarProps {
  showBack?: boolean;
  title?: string;
}

export default function TopAppBar({ showBack = false, title }: TopAppBarProps) {
  const router = useRouter();
  const { user } = useAuthStore();
  const initials = user?.name?.charAt(0).toUpperCase() || '?';

  return (
    <header className="bg-surface w-full sticky top-0 z-50 shadow-sm">
      <div className="flex items-center justify-between px-container-padding h-touch-target w-full max-w-lg mx-auto">
        {showBack ? (
          <button
            onClick={() => router.back()}
            className="flex items-center justify-center w-10 h-10 rounded-full hover:bg-surface-container-low text-primary active:scale-95 transition-all"
          >
            <span className="material-symbols-outlined">arrow_back</span>
          </button>
        ) : (
          <div className="w-10" />
        )}
        <h1 className="text-display font-bold text-primary tracking-tight">
          {title || 'EduVerify'}
        </h1>
        <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center">
          <span className="text-on-primary text-xs font-bold">{initials}</span>
        </div>
      </div>
    </header>
  );
}
