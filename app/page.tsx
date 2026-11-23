'use client';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/store/auth.store';
import Icon from '@/components/ui/Icon';
import Badge from '@/components/ui/Badge';
import { ButtonLink } from '@/components/ui/Button';
import ProgressRing from '@/components/ui/ProgressRing';
import ThemeToggle from '@/components/ui/ThemeToggle';

/**
 * Public welcome page. Signed-in users go straight to their dashboard.
 */
export default function HomePage() {
  const router = useRouter();
  const { user, isLoading } = useAuthStore();

  useEffect(() => {
    if (isLoading || !user) return;
    router.replace(user.role === 'lecturer' ? '/lecturer/dashboard' : '/student/dashboard');
  }, [user, isLoading, router]);

  if (isLoading || user) {
    return (
      <div className="min-h-dvh flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <Logo />
          <div className="w-7 h-7 border-[3px] border-primary border-t-transparent rounded-full animate-spin" aria-hidden />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-dvh bg-background text-on-surface overflow-x-hidden">
      {/* Soft brand glow behind the hero */}
      <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-[560px] bg-[radial-gradient(60%_60%_at_70%_10%,color-mix(in_srgb,var(--primary)_14%,transparent),transparent_70%)]" />

      <header className="relative max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
        <Logo />
        <nav className="flex items-center gap-1 sm:gap-2">
          <ThemeToggle />
          <ButtonLink href="/login" variant="ghost" size="sm">Sign in</ButtonLink>
          <span className="hidden sm:block"><ButtonLink href="/register" size="sm">Get started</ButtonLink></span>
        </nav>
      </header>

      <main className="relative">
        {/* Hero */}
        <section className="max-w-6xl mx-auto px-4 sm:px-6 pt-8 sm:pt-16 pb-16 grid lg:grid-cols-[1.1fr_0.9fr] gap-12 items-center">
          <div className="animate-fade-up">
            <Badge tone="primary" icon="verified_user">Face · Liveness · Location</Badge>
            <h1 className="mt-5 text-4xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight leading-[1.05]">
              Attendance that<br /><span className="text-primary">verifies itself.</span>
            </h1>
            <p className="mt-5 text-base sm:text-lg text-on-surface-variant max-w-xl leading-relaxed">
              Students check in from their own phone in about 20 seconds. EduVerify confirms they&apos;re really
              there and really them, so lecturers never have to pass round a sign-in sheet again.
            </p>
            <div className="mt-8 flex flex-col sm:flex-row gap-3">
              <ButtonLink href="/register" size="lg" iconRight="arrow_forward">Create a free account</ButtonLink>
              <ButtonLink href="/login" size="lg" variant="outline">I already have an account</ButtonLink>
            </div>
            <dl className="mt-10 grid grid-cols-3 gap-4 max-w-md">
              {[
                ['~20s', 'to check in'],
                ['3', 'checks per student'],
                ['0', 'paper sheets'],
              ].map(([v, l]) => (
                <div key={l}>
                  <dt className="sr-only">{l}</dt>
                  <dd className="text-2xl sm:text-3xl font-extrabold text-on-surface tabular-nums">{v}</dd>
                  <dd className="text-xs text-on-surface-variant mt-0.5">{l}</dd>
                </div>
              ))}
            </dl>
          </div>

          <PhoneMockup />
        </section>

        {/* How it works */}
        <section className="bg-surface-container-low border-y border-outline-variant/30">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 py-16">
            <SectionTitle eyebrow="How it works" title="Three checks. One tap for the student." />
            <ol className="mt-10 grid md:grid-cols-3 gap-4">
              {[
                { icon: 'my_location', title: 'In the room', text: 'The phone samples GPS for a few seconds and keeps the most accurate reading. It must fall inside the classroom radius the lecturer set.' },
                { icon: 'face_retouching_natural', title: 'Really them', text: 'A guided face scan with a blink and a random head turn, so a photo or a recorded video won’t pass.' },
                { icon: 'task_alt', title: 'Recorded by the server', text: 'The server re-checks everything and writes the attendance itself. Students can’t edit their own records.' },
              ].map((step, i) => (
                <li key={step.title} className="bg-surface-container-lowest rounded-2xl border border-outline-variant/30 shadow-card p-6">
                  <div className="flex items-center gap-3">
                    <span className="w-10 h-10 rounded-xl bg-primary text-on-primary flex items-center justify-center">
                      <Icon name={step.icon} filled className="text-[22px]" />
                    </span>
                    <span className="text-xs font-bold text-on-surface-variant tracking-wider uppercase">Step {i + 1}</span>
                  </div>
                  <h3 className="mt-4 text-lg font-bold">{step.title}</h3>
                  <p className="mt-2 text-sm text-on-surface-variant leading-relaxed">{step.text}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        {/* Audiences */}
        <section className="max-w-6xl mx-auto px-4 sm:px-6 py-16 grid md:grid-cols-2 gap-4">
          <AudienceCard
            icon="school" title="For students"
            points={[
              'Live session alerts with a countdown',
              'Check in and out from your own phone',
              'Your attendance % per course, always up to date',
              'Clear guidance when lighting or location is poor',
            ]}
          />
          <AudienceCard
            icon="co_present" title="For lecturers"
            points={[
              'Watch check-ins arrive in real time',
              'Place a classroom by standing in it, with a suggested radius',
              'Manual check-in with a recorded reason',
              'PDF and CSV reports for sessions or the whole semester',
            ]}
          />
        </section>

        {/* Trust */}
        <section className="max-w-6xl mx-auto px-4 sm:px-6 pb-16">
          <div className="rounded-3xl bg-primary text-on-primary p-8 sm:p-12 shadow-raised">
            <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight">Built so it can&apos;t be gamed.</h2>
            <div className="mt-8 grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
              {[
                { icon: 'dns', title: 'Server decides', text: 'Only the server can record attendance, after checking every condition.' },
                { icon: 'visibility', title: 'Liveness check', text: 'Blink and a random head turn defeat printed photos and replays.' },
                { icon: 'travel_explore', title: 'Location review', text: 'Fake-GPS signs and impossible travel are flagged for the lecturer.' },
                { icon: 'lock', title: 'No photos stored', text: 'Only a mathematical face encoding is kept, and clients can’t read it.' },
              ].map(f => (
                <div key={f.title}>
                  <Icon name={f.icon} filled className="text-[26px] opacity-90" />
                  <h3 className="mt-3 font-bold">{f.title}</h3>
                  <p className="mt-1 text-sm opacity-80 leading-relaxed">{f.text}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Final CTA */}
        <section className="max-w-6xl mx-auto px-4 sm:px-6 pb-20 text-center">
          <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight">Ready for your next class?</h2>
          <p className="mt-3 text-on-surface-variant">Set up takes a minute. Face enrollment takes about 20 seconds.</p>
          <div className="mt-6 flex flex-col sm:flex-row gap-3 justify-center">
            <ButtonLink href="/register" size="lg" iconRight="arrow_forward">Get started</ButtonLink>
            <ButtonLink href="/login" size="lg" variant="outline">Sign in</ButtonLink>
          </div>
        </section>
      </main>

      <footer className="border-t border-outline-variant/30">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between text-xs text-on-surface-variant">
          <span>© {new Date().getFullYear()} EduVerify</span>
          <span>Smart attendance with face and location verification</span>
        </div>
      </footer>
    </div>
  );
}

function Logo() {
  return (
    <span className="flex items-center gap-2">
      <span className="w-8 h-8 rounded-xl bg-primary text-on-primary flex items-center justify-center shadow-card">
        <Icon name="verified_user" filled className="text-[18px]" />
      </span>
      <span className="text-lg font-extrabold tracking-tight text-on-surface">EduVerify</span>
    </span>
  );
}

function SectionTitle({ eyebrow, title }: { eyebrow: string; title: string }) {
  return (
    <div className="max-w-2xl">
      <p className="text-xs font-bold tracking-wider uppercase text-primary">{eyebrow}</p>
      <h2 className="mt-2 text-2xl sm:text-3xl font-extrabold tracking-tight">{title}</h2>
    </div>
  );
}

function AudienceCard({ icon, title, points }: { icon: string; title: string; points: string[] }) {
  return (
    <div className="bg-surface-container-lowest rounded-2xl border border-outline-variant/30 shadow-card p-6 sm:p-8">
      <div className="flex items-center gap-3">
        <span className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
          <Icon name={icon} filled className="text-[22px]" />
        </span>
        <h3 className="text-xl font-bold">{title}</h3>
      </div>
      <ul className="mt-5 flex flex-col gap-3">
        {points.map(p => (
          <li key={p} className="flex items-start gap-3 text-sm text-on-surface-variant">
            <Icon name="check_circle" filled className="text-success text-lg mt-px" />
            {p}
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Static illustration of the student check-in screen. */
function PhoneMockup() {
  return (
    <div className="relative mx-auto w-full max-w-[330px] animate-scale-in" aria-hidden>
      <div className="rounded-[2.5rem] border-[10px] border-neutral-800 dark:border-neutral-700 bg-background shadow-raised overflow-hidden">
        <div className="h-6 flex justify-center items-end"><div className="w-20 h-1.5 rounded-full bg-outline-variant" /></div>
        <div className="p-4 flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <p className="text-sm font-bold">Good morning, Ada</p>
            <span className="w-7 h-7 rounded-full bg-primary text-on-primary text-[11px] font-bold flex items-center justify-center">A</span>
          </div>

          <div className="rounded-2xl bg-primary-container p-4 text-on-primary-container">
            <div className="flex items-center justify-between">
              <Badge tone="live">Live</Badge>
              <span className="text-[11px] opacity-80">LT2 · 60 min</span>
            </div>
            <div className="mt-3 flex items-center gap-4">
              <ProgressRing value={0.62} size={72} stroke={6} tone="onPrimary">
                <span className="text-sm font-bold tabular-nums">07:42</span>
              </ProgressRing>
              <div>
                <p className="font-bold leading-tight">Data Structures</p>
                <p className="text-xs opacity-80">CSC 301 · Check-in open</p>
              </div>
            </div>
            <div className="mt-4 h-10 rounded-full bg-on-primary-container text-primary-container text-sm font-semibold flex items-center justify-center gap-2">
              <Icon name="how_to_reg" filled className="text-lg" /> Check in now
            </div>
          </div>

          <div className="rounded-2xl border border-outline-variant/30 bg-surface-container-lowest p-3 flex flex-col gap-2.5">
            {[
              ['my_location', 'Location confirmed', '12m · ±8m'],
              ['visibility', 'Liveness passed', 'blink + turn'],
              ['face', 'Face matched', '94%'],
            ].map(([icon, label, meta]) => (
              <div key={label} className="flex items-center gap-2.5">
                <span className="w-7 h-7 rounded-lg bg-success-container text-on-success-container flex items-center justify-center">
                  <Icon name={icon} filled className="text-[16px]" />
                </span>
                <span className="text-xs font-semibold flex-1">{label}</span>
                <span className="text-[11px] text-on-surface-variant">{meta}</span>
              </div>
            ))}
          </div>
          <div className="h-11 rounded-full bg-success text-on-success text-sm font-bold flex items-center justify-center gap-2">
            <Icon name="check_circle" filled className="text-lg" /> Checked in · +3 marks
          </div>
        </div>
      </div>
    </div>
  );
}
