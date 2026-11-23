'use client';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import type { ReactNode } from 'react';
import Icon from '@/components/ui/Icon';
import ThemeToggle from '@/components/ui/ThemeToggle';

/**
 * Layout for login / register / password reset.
 * Desktop: brand panel on the left, form on the right. Phone: compact header + form.
 */
export default function AuthShell({
  title, subtitle, children, back = false,
}: { title: string; subtitle?: string; children: ReactNode; back?: boolean }) {
  const router = useRouter();
  return (
    <div className="min-h-dvh bg-background lg:grid lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)]">
      {/* Brand panel (desktop) */}
      <aside className="hidden lg:flex lg:sticky lg:top-0 lg:h-dvh relative overflow-hidden bg-primary text-on-primary p-12 flex-col justify-between">
        <div aria-hidden className="absolute -right-24 -top-24 w-96 h-96 rounded-full bg-on-primary/5" />
        <div aria-hidden className="absolute -left-16 bottom-10 w-72 h-72 rounded-full bg-on-primary/5" />
        <Link href="/" className="relative flex items-center gap-2 w-fit">
          <span className="w-9 h-9 rounded-xl bg-on-primary text-primary flex items-center justify-center">
            <Icon name="verified_user" filled className="text-[20px]" />
          </span>
          <span className="text-xl font-extrabold tracking-tight">EduVerify</span>
        </Link>
        <div className="relative max-w-md">
          <h2 className="text-4xl font-extrabold tracking-tight leading-tight">Attendance that verifies itself.</h2>
          <ul className="mt-8 flex flex-col gap-4">
            {[
              ['my_location', 'Location checked against the classroom'],
              ['face', 'Face match with a liveness check'],
              ['dns', 'Recorded by the server, never the browser'],
            ].map(([icon, text]) => (
              <li key={text} className="flex items-center gap-3 text-base opacity-90">
                <span className="w-9 h-9 rounded-xl bg-on-primary/10 flex items-center justify-center">
                  <Icon name={icon} filled className="text-[20px]" />
                </span>
                {text}
              </li>
            ))}
          </ul>
        </div>
        <p className="relative text-sm opacity-70">Smart attendance with face and location verification.</p>
      </aside>

      {/* Form column */}
      <div className="min-h-dvh flex flex-col">
        <header className="h-16 px-4 sm:px-6 flex items-center justify-between">
          <div className="flex items-center gap-2">
            {back && (
              <button onClick={() => router.back()} aria-label="Back"
                className="w-10 h-10 -ml-2 rounded-full flex items-center justify-center text-on-surface hover:bg-surface-container-low">
                <Icon name="arrow_back" />
              </button>
            )}
            <Link href="/" className="flex items-center gap-2 lg:hidden">
              <span className="w-8 h-8 rounded-xl bg-primary text-on-primary flex items-center justify-center">
                <Icon name="verified_user" filled className="text-[18px]" />
              </span>
              <span className="text-lg font-extrabold tracking-tight text-on-surface">EduVerify</span>
            </Link>
          </div>
          <ThemeToggle />
        </header>
        <main className="flex-1 flex items-start sm:items-center justify-center px-4 sm:px-6 pb-10">
          <div className="w-full max-w-md animate-fade-up">
            <h1 className="text-3xl font-extrabold tracking-tight text-on-surface">{title}</h1>
            {subtitle && <p className="mt-2 text-sm text-on-surface-variant">{subtitle}</p>}
            <div className="mt-8">{children}</div>
          </div>
        </main>
      </div>
    </div>
  );
}
