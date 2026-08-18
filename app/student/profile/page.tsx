'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuthStore } from '@/store/auth.store';
import { logoutUser } from '@/lib/firebase/auth.service';
import TopAppBar from '@/components/layout/TopAppBar';

export default function StudentProfilePage() {
  const { user, clearUser } = useAuthStore();
  const router = useRouter();
  const [loggingOut, setLoggingOut] = useState(false);

  const handleLogout = async () => {
    if (!confirm('Sign out of EduVerify?')) return;
    setLoggingOut(true);
    await logoutUser();
    clearUser();
    router.replace('/login');
  };

  const initials = user?.name?.split(' ').map(n => n[0]).join('').toUpperCase().slice(0,2) || '??';

  return (
    <div className="bg-background">
      <TopAppBar title="Profile" />
      <main className="px-5 pt-6 max-w-lg mx-auto pb-8">

        {/* Avatar */}
        <div className="flex flex-col items-center mb-8">
          <div className="w-20 h-20 rounded-full bg-primary flex items-center justify-center mb-3">
            <span className="text-2xl font-bold text-on-primary">{initials}</span>
          </div>
          <h2 className="text-xl font-bold text-on-surface">{user?.name}</h2>
          <span className="text-xs font-semibold text-primary bg-primary/10 px-3 py-1 rounded-full mt-1">Student</span>
        </div>

        {/* Info card */}
        <div className="bg-surface-container-lowest rounded-2xl card-shadow border border-outline-variant/20 mb-4 overflow-hidden">
          {[
            { icon: 'mail', label: 'Email', value: user?.email },
            { icon: 'tag', label: 'Matric Number', value: user?.matricNumber || 'Not set' },
            { icon: 'trending_up', label: 'Level', value: user?.level ? `${user.level} Level` : 'Not set' },
            { icon: 'apartment', label: 'Department', value: user?.department || 'Not set' },
          ].map((item, i, arr) => (
            <div key={item.label} className={`flex items-center gap-3 p-4 ${i < arr.length - 1 ? 'border-b border-surface-variant' : ''}`}>
              <span className="material-symbols-outlined text-outline">{item.icon}</span>
              <div>
                <p className="text-xs text-on-surface-variant">{item.label}</p>
                <p className="text-sm font-medium text-on-surface">{item.value}</p>
              </div>
            </div>
          ))}
        </div>
        
        {/* Face Verification Setup */}
        <Link href="/student/enroll"
          className="w-full h-12 bg-primary-container text-on-primary-container rounded-full text-sm font-semibold active:scale-95 transition-all flex items-center justify-center gap-2 mb-4 mt-4">
          <span className="material-symbols-outlined text-xl">face</span>
          Set up Face Verification
        </Link>

        {/* Sign out */}
        <button onClick={handleLogout} disabled={loggingOut}
          className="w-full h-12 border-2 border-error/30 text-error rounded-full text-sm font-semibold active:scale-95 disabled:opacity-60 transition-all flex items-center justify-center gap-2 mt-4">
          <span className="material-symbols-outlined text-xl">logout</span>
          {loggingOut ? 'Signing out...' : 'Sign Out'}
        </button>
      </main>
    </div>
  );
}
