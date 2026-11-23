'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { loginSchema, LoginInput } from '@/lib/utils/validation';
import { loginUser } from '@/lib/firebase/auth.service';
import { useAuthStore } from '@/store/auth.store';
import AuthShell from '@/components/layout/AuthShell';

export default function LoginPage() {
  const router = useRouter();
  const { setUser } = useAuthStore();
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const { register, handleSubmit, formState: { errors } } = useForm<LoginInput>({
    resolver: zodResolver(loginSchema),
  });

  const onSubmit = async (data: LoginInput) => {
    setLoading(true);
    setError('');
    try {
      const user = await loginUser(data.email, data.password);
      setUser(user);
      if (user.role === 'lecturer') {
        router.replace('/lecturer/dashboard');
      } else {
        router.replace('/student/dashboard');
      }
    } catch (err: any) {
      const code = err?.code || '';
      if (code === 'auth/invalid-credential' || code === 'auth/user-not-found') {
        setError('No account found with this email or password.');
      } else if (code === 'auth/wrong-password') {
        setError('Incorrect password. Please try again.');
      } else if (code === 'auth/too-many-requests') {
        setError('Too many attempts. Please try again later.');
      } else {
        setError('Login failed. Please check your details.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthShell title="Welcome back" subtitle="Sign in to check in to class or manage your sessions.">

        {error && (
          <div className="mb-4 p-4 bg-error-container rounded-lg flex items-center gap-2">
            <span className="material-symbols-outlined text-error" style={{fontSize: '18px'}}>error</span>
            <p className="text-sm text-on-error-container">{error}</p>
          </div>
        )}

        <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
          {/* Email */}
          <div className="flex flex-col gap-1">
            <label className="field-label">Email</label>
            <div className="relative flex items-center">
              <span className="material-symbols-outlined field-icon">mail</span>
              <input
                {...register('email')}
                type="email"
                placeholder="student@university.edu"
                className="field-input pl-11"
              />
            </div>
            {errors.email && <p className="field-error">{errors.email.message}</p>}
          </div>

          {/* Password */}
          <div className="flex flex-col gap-1">
            <label className="field-label">Password</label>
            <div className="relative flex items-center">
              <span className="material-symbols-outlined field-icon">lock</span>
              <input
                {...register('password')}
                type={showPassword ? 'text' : 'password'}
                placeholder="••••••••"
                className="field-input pl-11 pr-12"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 text-outline hover:text-primary w-8 h-8 flex items-center justify-center rounded-full"
              >
                <span className="material-symbols-outlined" style={{fontSize: '20px'}}>
                  {showPassword ? 'visibility' : 'visibility_off'}
                </span>
              </button>
            </div>
            {errors.password && <p className="field-error">{errors.password.message}</p>}
            <div className="flex justify-end mt-1">
              <Link href="/forgot-password" className="text-sm font-semibold text-primary hover:underline">Forgot password?</Link>
            </div>
          </div>

          {/* Submit */}
          <button
            type="submit"
            disabled={loading}
            className="mt-2 w-full h-12 rounded-full bg-primary text-on-primary text-sm font-semibold shadow-card hover:brightness-110 active:scale-[0.98] disabled:opacity-60 transition-all flex items-center justify-center gap-2"
          >
            {loading ? (
              <>
                <div className="w-4 h-4 border-2 border-on-primary border-t-transparent rounded-full animate-spin" />
                Signing in...
              </>
            ) : 'Sign in'}
          </button>

          {/* Divider */}
          <div className="flex items-center gap-4 my-2">
            <div className="h-px bg-outline-variant flex-1" />
            <span className="text-xs text-on-surface-variant uppercase tracking-widest">or</span>
            <div className="h-px bg-outline-variant flex-1" />
          </div>

          <div className="text-center">
            <p className="text-sm text-on-surface-variant">
              Don&apos;t have an account?{' '}
              <Link href="/register" className="text-sm font-semibold text-primary hover:underline ml-1">Sign up</Link>
            </p>
          </div>
        </form>
    </AuthShell>
  );
}
