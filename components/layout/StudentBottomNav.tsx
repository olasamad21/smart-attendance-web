'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

const tabs = [
  { label: 'Home', href: '/student/dashboard', icon: 'home' },
  { label: 'Courses', href: '/student/courses', icon: 'school' },
  { label: 'Attendance', href: '/student/history', icon: 'fact_check' },
  { label: 'Profile', href: '/student/profile', icon: 'person' },
];

export default function StudentBottomNav() {
  const pathname = usePathname();

  return (
    <nav className="bg-surface-container-lowest fixed bottom-0 w-full z-50 border-t border-outline-variant/30 shadow-[0_-4px_20px_rgba(0,0,0,0.05)] pb-[env(safe-area-inset-bottom)]">
      <div className="flex justify-around items-center h-[72px] w-full px-2 max-w-lg mx-auto">
        {tabs.map((tab) => {
          const isActive = pathname === tab.href || pathname.startsWith(tab.href + '/');
          return (
            <Link
              key={tab.href}
              href={tab.href}
              className="flex flex-col items-center justify-center flex-1 h-full transition-all active:scale-95"
            >
              <div className={`w-16 h-8 flex items-center justify-center rounded-full mb-1 transition-colors ${
                isActive ? 'bg-secondary-container text-on-secondary-container' : 'text-on-surface-variant'
              }`}>
                <span
                  className="material-symbols-outlined text-[24px]"
                  style={isActive ? { fontVariationSettings: "'FILL' 1" } : {}}
                >
                  {tab.icon}
                </span>
              </div>
              <span className={`text-[12px] font-medium transition-colors ${
                isActive ? 'text-on-surface font-bold' : 'text-on-surface-variant'
              }`}>
                {tab.label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
