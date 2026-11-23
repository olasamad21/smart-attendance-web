'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/store/auth.store';
import { logoutUser } from '@/lib/firebase/auth.service';
import { checkFaceEnrolled, type FaceStatus } from '@/lib/api/face.api';
import { getThemePreference, setThemePreference, type ThemePreference } from '@/lib/theme';
import TopAppBar from '@/components/layout/TopAppBar';
import AppDialog from '@/components/ui/AppDialog';
import Card from '@/components/ui/Card';
import Badge from '@/components/ui/Badge';
import Button, { ButtonLink } from '@/components/ui/Button';
import Icon from '@/components/ui/Icon';
import Skeleton from '@/components/ui/Skeleton';
import InstallAppCard from '@/components/pwa/InstallApp';

/** Profile screen shared by students and lecturers. */
export default function ProfileView() {
  const { user, clearUser } = useAuthStore();
  const router = useRouter();
  const isStudent = user?.role === 'student';
  const [face, setFace] = useState<FaceStatus | null>(null);
  const [theme, setTheme] = useState<ThemePreference>('system');
  const [showSignOut, setShowSignOut] = useState(false);
  const [signingOut, setSigningOut] = useState(false);

  useEffect(() => { setTheme(getThemePreference()); }, []);
  useEffect(() => {
    if (!isStudent || !user?.userId) return;
    checkFaceEnrolled().then(setFace).catch(() => setFace({ enrolled: false }));
  }, [isStudent, user?.userId]);

  const signOut = async () => {
    setShowSignOut(false);
    setSigningOut(true);
    await logoutUser();
    clearUser();
    router.replace('/login');
  };

  const initials = user?.name?.split(' ').filter(Boolean).map(n => n[0]).join('').toUpperCase().slice(0, 2) || '?';
  const rows = [
    { icon: 'mail', label: 'Email', value: user?.email },
    ...(isStudent ? [
      { icon: 'tag', label: 'Matric number', value: user?.matricNumber || 'Not set' },
      { icon: 'trending_up', label: 'Level', value: user?.level ? `${user.level} Level` : 'Not set' },
    ] : []),
    { icon: 'apartment', label: 'Department', value: user?.department || 'Not set' },
  ];

  return (
    <div className="bg-background min-h-dvh">
      <TopAppBar title="Profile" />
      <main className={`px-4 sm:px-6 pt-6 pb-10 mx-auto flex flex-col gap-5 max-w-lg md:max-w-2xl`}>
        {/* Identity */}
        <Card padding="lg" className="flex items-center gap-4 animate-fade-up">
          <span className="w-16 h-16 rounded-2xl bg-primary text-on-primary flex items-center justify-center text-xl font-bold shrink-0">
            {initials}
          </span>
          <div className="min-w-0">
            <h2 className="text-xl font-bold text-on-surface truncate">{user?.name}</h2>
            <Badge tone="primary" icon={isStudent ? 'school' : 'co_present'} className="mt-1.5">
              {isStudent ? 'Student' : 'Lecturer'}
            </Badge>
          </div>
        </Card>

        {/* Details */}
        <section>
          <h3 className="text-xs font-bold uppercase tracking-wider text-on-surface-variant mb-2 px-1">Account</h3>
          <Card padding="none" className="divide-y divide-outline-variant/30">
            {rows.map(r => (
              <div key={r.label} className="flex items-center gap-3 px-4 py-3.5">
                <Icon name={r.icon} className="text-on-surface-variant text-xl" />
                <div className="min-w-0">
                  <p className="text-[11px] font-medium text-on-surface-variant">{r.label}</p>
                  <p className="text-sm font-semibold text-on-surface truncate">{r.value}</p>
                </div>
              </div>
            ))}
          </Card>
          {isStudent && <p className="text-[11px] text-on-surface-variant mt-2 px-1">Matric number can&apos;t be changed after registration.</p>}
        </section>

        {/* Face verification (students) */}
        {isStudent && (
          <section>
            <h3 className="text-xs font-bold uppercase tracking-wider text-on-surface-variant mb-2 px-1">Face verification</h3>
            {face === null ? <Skeleton className="h-24 w-full rounded-2xl" /> : (
              <Card className="flex items-center gap-4">
                <span className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 ${face.enrolled ? 'bg-success-container text-on-success-container' : 'bg-warning-container text-on-warning-container'}`}>
                  <Icon name={face.enrolled ? 'verified_user' : 'face'} filled className="text-[22px]" />
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-on-surface">
                    {face.enrolled ? 'Set up and ready' : face.needs_reenroll ? 'Needs updating' : 'Not set up'}
                  </p>
                  <p className="text-xs text-on-surface-variant mt-0.5">
                    {face.enrolled ? 'Re-enroll if check-ins start failing (new glasses, big haircut).' : 'Required to check in to class. Takes about 20 seconds.'}
                  </p>
                </div>
                <ButtonLink href="/student/enroll" size="sm" variant={face.enrolled ? 'outline' : 'primary'}>
                  {face.enrolled ? 'Re-enroll' : 'Set up'}
                </ButtonLink>
              </Card>
            )}
          </section>
        )}

        {/* Appearance */}
        <section>
          <h3 className="text-xs font-bold uppercase tracking-wider text-on-surface-variant mb-2 px-1">Appearance</h3>
          <div role="radiogroup" aria-label="Theme" className="grid grid-cols-3 gap-1 p-1 rounded-2xl bg-surface-container-high">
            {([['system', 'brightness_auto', 'Auto'], ['light', 'light_mode', 'Light'], ['dark', 'dark_mode', 'Dark']] as const).map(([value, icon, label]) => (
              <button key={value} role="radio" aria-checked={theme === value}
                onClick={() => { setTheme(value); setThemePreference(value); }}
                className={`h-11 rounded-xl text-sm font-semibold flex items-center justify-center gap-1.5 transition-all ${theme === value ? 'bg-surface-container-lowest text-on-surface shadow-card' : 'text-on-surface-variant hover:text-on-surface'}`}>
                <Icon name={icon} className="text-lg" />{label}
              </button>
            ))}
          </div>
        </section>

        {/* App install */}
        <section>
          <h3 className="text-xs font-bold uppercase tracking-wider text-on-surface-variant mb-2 px-1">App</h3>
          <InstallAppCard />
          <p className="text-[11px] text-on-surface-variant mt-2 px-1">Installing works on Chrome, Edge and Android, and on iPhone via Safari.</p>
        </section>

        <Button variant="outline" size="lg" fullWidth icon="logout" loading={signingOut}
          onClick={() => setShowSignOut(true)} className="!text-error !border-error/30 mt-2">
          {signingOut ? 'Signing out…' : 'Sign out'}
        </Button>
      </main>

      <AppDialog open={showSignOut} onClose={() => setShowSignOut(false)} icon="logout" variant="destructive"
        title="Sign out?" description="You'll need to sign in again to use EduVerify." confirmLabel="Sign out" onConfirm={signOut} />
    </div>
  );
}
