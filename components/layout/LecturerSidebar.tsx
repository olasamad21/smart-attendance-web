'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuthStore } from '@/store/auth.store';
import Icon from '@/components/ui/Icon';
import ThemeToggle from '@/components/ui/ThemeToggle';

export const LECTURER_NAV = [
  { label: 'Home', href: '/lecturer/dashboard', icon: 'home' },
  { label: 'Courses', href: '/lecturer/courses', icon: 'school' },
  { label: 'Classrooms', href: '/lecturer/classrooms', icon: 'location_on' },
  { label: 'Profile', href: '/lecturer/profile', icon: 'person' },
];

/** Desktop (md+) navigation rail for lecturers. On phones the bottom tab bar is used instead. */
export default function LecturerSidebar() {
  const pathname = usePathname();
  const { user } = useAuthStore();

  return (
    <aside className="hidden md:flex fixed left-0 top-0 h-dvh w-60 flex-col bg-surface-container-lowest border-r border-outline-variant/30 z-40">
      <div className="h-16 px-5 flex items-center gap-2">
        <span className="w-8 h-8 rounded-xl bg-primary text-on-primary flex items-center justify-center shadow-card">
          <Icon name="verified_user" filled className="text-[18px]" />
        </span>
        <span className="text-lg font-extrabold tracking-tight text-on-surface">EduVerify</span>
      </div>
      <p className="px-5 mt-2 mb-2 text-[11px] font-bold uppercase tracking-wider text-on-surface-variant">Lecturer</p>
      <nav className="flex-1 px-3 flex flex-col gap-1" aria-label="Main">
        {LECTURER_NAV.map(item => {
          const active = pathname === item.href || pathname.startsWith(item.href + '/');
          return (
            <Link key={item.href} href={item.href} aria-current={active ? 'page' : undefined}
              className={`h-11 px-3 rounded-xl flex items-center gap-3 text-sm font-semibold transition-colors ${
                active ? 'bg-secondary-container text-on-secondary-container' : 'text-on-surface-variant hover:bg-surface-container-low hover:text-on-surface'
              }`}>
              <Icon name={item.icon} filled={active} className="text-[22px]" />
              {item.label}
            </Link>
          );
        })}
      </nav>
      <div className="p-3 border-t border-outline-variant/30 flex items-center gap-3">
        <span className="w-9 h-9 rounded-full bg-primary text-on-primary flex items-center justify-center text-sm font-bold shrink-0">
          {user?.name?.charAt(0).toUpperCase() ?? '?'}
        </span>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-on-surface truncate">{user?.name}</p>
          <p className="text-xs text-on-surface-variant truncate">{user?.email}</p>
        </div>
        <ThemeToggle />
      </div>
    </aside>
  );
}
