'use client';
import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { sendPasswordResetEmail } from 'firebase/auth';
import { auth } from '@/lib/firebase/config';
import AuthShell from '@/components/layout/AuthShell';

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
    <AuthShell back title={sent ? 'Check your inbox' : 'Reset your password'}
      subtitle={sent ? undefined : "Enter your account's email and we'll send you a reset link."}>
        {!sent ? (
          <>
            {/* Form */}
            <form onSubmit={handleSubmit} className="flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <label className="field-label">Email address</label>
                <div className="relative flex items-center">
                  <span className="material-symbols-outlined field-icon">mail</span>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="student@university.edu"
                    autoComplete="email"
                    autoFocus
                    className="field-input pl-11"
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
                className="mt-2 w-full h-12 rounded-full bg-primary text-on-primary text-sm font-semibold shadow-card hover:brightness-110 active:scale-[0.98] disabled:opacity-60 transition-all flex items-center justify-center gap-2"
              >
                {isLoading ? (
                  <>
                    <div className="w-4 h-4 border-2 border-on-primary border-t-transparent rounded-full animate-spin" />
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
            <p className="text-sm text-on-surface-variant mb-8 max-w-xs mx-auto">
              If an account exists for <strong className="text-on-surface">{email}</strong>, we&apos;ve sent a password reset link. Check your spam folder too.
            </p>
            <button
              onClick={() => router.push('/login')}
              className="w-full h-12 rounded-full bg-primary text-on-primary text-sm font-semibold shadow-card hover:brightness-110 active:scale-[0.98] disabled:opacity-60 transition-all flex items-center justify-center gap-2"
            >
              <span className="material-symbols-outlined text-lg">arrow_back</span>
              Back to Login
            </button>
          </div>
        )}
    </AuthShell>
  );
}
