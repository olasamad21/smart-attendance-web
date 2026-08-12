'use client';
import TopAppBar from '@/components/layout/TopAppBar';

export default function LecturerSessionsPage() {
  return (
    <div className="bg-background min-h-screen">
      <TopAppBar title="Sessions" />
      <main className="px-5 pt-6 max-w-lg mx-auto pb-8">
        <div className="bg-surface-container-lowest rounded-2xl p-12 text-center card-shadow mt-4">
          <span className="material-symbols-outlined text-outline text-5xl mb-3 block">fact_check</span>
          <p className="text-base font-semibold text-on-surface">No sessions yet</p>
          <p className="text-sm text-on-surface-variant mt-1">Start a session from a course to begin taking attendance</p>
        </div>
      </main>
    </div>
  );
}
