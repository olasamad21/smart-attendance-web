'use client';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuthStore } from '@/store/auth.store';

interface TopAppBarProps {
  showBack?: boolean;
  isModal?: boolean;
  isAuth?: boolean;
  title?: string;
}

export default function TopAppBar({ showBack = false, isModal = false, isAuth = false, title }: TopAppBarProps) {
  const router = useRouter();
  const { user } = useAuthStore();
  const initials = user?.name?.charAt(0).toUpperCase() || '?';
  const profileUrl = user?.role === 'lecturer' ? '/lecturer/profile' : '/student/profile';

  if (isAuth) {
    return (
      <header className="bg-surface w-full sticky top-0 z-50 shadow-sm">
        <div className="flex items-center px-5 h-12 w-full max-w-lg mx-auto">
          <div className="flex-1 flex justify-start">
            {showBack && (
              <button
                onClick={() => router.back()}
                className="flex items-center justify-center w-10 h-10 rounded-full hover:bg-surface-container-low text-primary active:scale-95 transition-all -ml-2"
              >
                <span className="material-symbols-outlined">arrow_back</span>
              </button>
            )}
          </div>
          <h1 className="text-xl font-bold text-primary tracking-tight shrink-0">
            EduVerify
          </h1>
          <div className="flex-1" />
        </div>
      </header>
    );
  }

  return (
    <header className="bg-surface w-full sticky top-0 z-50 shadow-sm">
      <div className="flex items-center justify-between px-5 h-12 w-full max-w-lg mx-auto gap-4">
        
        {/* LEFT SIDE */}
        <div className="flex items-center gap-2 overflow-hidden">
          {showBack ? (
            <>
              <button
                onClick={() => router.back()}
                className="flex items-center justify-center w-10 h-10 rounded-full hover:bg-surface-container-low text-primary active:scale-95 transition-all shrink-0 -ml-2"
              >
                <span className="material-symbols-outlined">{isModal ? 'close' : 'arrow_back'}</span>
              </button>
              {title && (
                <h1 className="text-lg font-bold text-on-surface truncate">
                  {title}
                </h1>
              )}
            </>
          ) : (
            <div className="flex items-baseline gap-2 truncate">
              <h1 className="text-xl font-bold text-primary tracking-tight shrink-0">
                EduVerify
              </h1>
              {title && (
                <>
                  <span className="text-on-surface-variant/40 shrink-0">|</span>
                  <span className="text-lg font-semibold text-on-surface truncate">{title}</span>
                </>
              )}
            </div>
          )}
        </div>

        {/* RIGHT SIDE */}
        {!showBack && user && (
          <div className="flex items-center shrink-0 gap-2">
            {/* Future Dark Mode Toggle space */}
            <Link href={profileUrl} className="w-8 h-8 rounded-full bg-primary flex items-center justify-center active:scale-95 transition-all hover:bg-primary/90 ml-1">
              <span className="text-on-primary text-xs font-bold">{initials}</span>
            </Link>
          </div>
        )}
      </div>
    </header>
  );
}
