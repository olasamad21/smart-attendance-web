'use client';
import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { sendPasswordResetEmail } from 'firebase/auth';
import { auth } from '@/lib/firebase/config';
import TopAppBar from '@/components/layout/TopAppBar';

export default function ForgotPasswordPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [sent, setSent] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!email.trim()) {
      setError('Please enter your email address.');
      return;
    }

    setIsLoading(true);
    try {
      await sendPasswordResetEmail(auth, email.trim());
      setSent(true);
    } catch (err: any) {
      // Don't reveal whether the email exists — show success either way
      if (err.code === 'auth/invalid-email') {
        setError('Please enter a valid email address.');
      } else {
        setSent(true);
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <TopAppBar isAuth showBack />

      <main className="flex-1 flex flex-col justify-center px-6 max-w-md mx-auto w-full pb-12">
        {!sent ? (
          <>
            {/* Heading */}
            <div className="mb-8">
              <div className="w-16 h-16 rounded-2xl bg-primary-container/30 flex items-center justify-center mb-5">
                <span className="material-symbols-outlined text-primary text-3xl" style={{fontVariationSettings:"'FILL' 1"}}>lock_reset</span>
              </div>
              <h2 className="text-2xl font-bold text-on-surface mb-2">Reset your password</h2>
              <p className="text-sm text-on-surface-variant">
                Enter the email associated with your account and we&apos;ll send you a link to reset your password.
              </p>
            </div>

            {/* Form */}
            <form onSubmit={handleSubmit} className="flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-on-surface-variant uppercase tracking-wider">Email Address</label>
                <div className="relative flex items-center">
                  <span className="material-symbols-outlined absolute left-3 text-outline text-xl">mail</span>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="student@university.edu"
                    autoComplete="email"
                    autoFocus
                    className="w-full h-12 pl-11 pr-4 bg-surface-container-lowest border border-outline-variant rounded-xl text-sm text-on-surface placeholder:text-outline/50 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all"
                  />
                </div>
              </div>

              {error && (
                <div className="p-3 bg-error-container rounded-lg flex items-center gap-2">
                  <span className="material-symbols-outlined text-error text-lg">error</span>
                  <p className="text-sm text-on-error-container">{error}</p>
                </div>
              )}

              <button
                type="submit"
                disabled={isLoading}
                className="mt-2 w-full h-12 bg-primary-container text-on-primary-container rounded-full text-sm font-bold active:scale-95 disabled:opacity-50 transition-all flex items-center justify-center gap-2"
              >
                {isLoading ? (
                  <>
                    <div className="w-4 h-4 border-2 border-on-primary-container border-t-transparent rounded-full animate-spin" />
                    Sending...
                  </>
                ) : 'Send Reset Link'}
              </button>
            </form>

            <p className="text-center text-sm text-on-surface-variant mt-8">
              Remembered your password?{' '}
              <Link href="/login" className="text-primary font-semibold hover:underline">Log in</Link>
            </p>
          </>
        ) : (
          /* Success State */
          <div className="text-center">
            <div className="w-20 h-20 rounded-full bg-secondary-container/30 flex items-center justify-center mx-auto mb-6">
              <span className="material-symbols-outlined text-primary text-4xl" style={{fontVariationSettings:"'FILL' 1"}}>mark_email_read</span>
            </div>
            <h2 className="text-2xl font-bold text-on-surface mb-2">Check your inbox</h2>
            <p className="text-sm text-on-surface-variant mb-8 max-w-xs mx-auto">
              If an account exists for <strong className="text-on-surface">{email}</strong>, we&apos;ve sent a password reset link. Check your spam folder too.
            </p>
            <button
              onClick={() => router.push('/login')}
              className="w-full h-12 bg-primary-container text-on-primary-container rounded-full text-sm font-bold active:scale-95 transition-all flex items-center justify-center gap-2"
            >
              <span className="material-symbols-outlined text-lg">arrow_back</span>
              Back to Login
            </button>
          </div>
        )}
      </main>
    </div>
  );
}
