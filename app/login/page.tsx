'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { loginSchema, LoginInput } from '@/lib/utils/validation';
import { loginUser } from '@/lib/firebase/auth.service';
import { useAuthStore } from '@/store/auth.store';

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
    <div className="bg-surface text-on-surface flex flex-col min-h-screen">
      {/* Top App Bar */}
      <header className="w-full sticky top-0 z-50 bg-surface shadow-sm">
        <div className="flex items-center justify-between px-container-padding h-touch-target w-full max-w-lg mx-auto">
          <div className="w-10" />
          <h1 className="text-display font-bold text-primary">EduVerify</h1>
          <div className="w-8 h-8 rounded-full bg-surface-container-high border border-outline-variant flex items-center justify-center">
            <span className="material-symbols-outlined text-outline-variant" style={{fontSize: '20px'}}>person</span>
          </div>
        </div>
      </header>

      <main className="flex-1 px-container-padding py-section-margin flex flex-col w-full max-w-md mx-auto">
        <div className="mb-section-margin pt-4">
          <h2 className="text-display font-bold text-on-surface mb-2">Welcome back.</h2>
          <p className="text-body-md text-on-surface-variant">Please log in to continue verification.</p>
        </div>

        {error && (
          <div className="mb-4 p-4 bg-error-container rounded-lg flex items-center gap-2">
            <span className="material-symbols-outlined text-error" style={{fontSize: '18px'}}>error</span>
            <p className="text-body-md text-on-error-container">{error}</p>
          </div>
        )}

        <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-stack-gap">
          {/* Email */}
          <div className="flex flex-col gap-1">
            <label className="text-label-md text-on-surface-variant">Email</label>
            <div className="relative flex items-center">
              <span className="material-symbols-outlined absolute left-3 text-outline" style={{fontSize: '20px'}}>mail</span>
              <input
                {...register('email')}
                type="email"
                placeholder="student@university.edu"
                className="w-full h-12 pl-10 pr-4 bg-surface-container-lowest border border-outline-variant rounded-lg text-body-md text-on-surface placeholder:text-outline/50 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-colors"
              />
            </div>
            {errors.email && <p className="text-label-md text-error">{errors.email.message}</p>}
          </div>

          {/* Password */}
          <div className="flex flex-col gap-1">
            <label className="text-label-md text-on-surface-variant">Password</label>
            <div className="relative flex items-center">
              <span className="material-symbols-outlined absolute left-3 text-outline" style={{fontSize: '20px'}}>lock</span>
              <input
                {...register('password')}
                type={showPassword ? 'text' : 'password'}
                placeholder="••••••••"
                className="w-full h-12 pl-10 pr-12 bg-surface-container-lowest border border-outline-variant rounded-lg text-body-md text-on-surface placeholder:text-outline/50 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-colors"
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
            {errors.password && <p className="text-label-md text-error">{errors.password.message}</p>}
            <div className="flex justify-end mt-1">
              <a href="#" className="text-label-md text-primary hover:underline">Forgot password?</a>
            </div>
          </div>

          {/* Submit */}
          <button
            type="submit"
            disabled={loading}
            className="mt-element-gap w-full h-touch-target bg-primary-container text-on-primary-container text-label-md font-semibold rounded-full shadow-button hover:shadow-button-hover hover:bg-primary-container/90 active:scale-95 disabled:opacity-60 transition-all flex items-center justify-center gap-2"
          >
            {loading ? (
              <>
                <div className="w-4 h-4 border-2 border-on-primary-container border-t-transparent rounded-full animate-spin" />
                Signing in...
              </>
            ) : 'Log In'}
          </button>

          {/* Divider */}
          <div className="flex items-center gap-4 my-2">
            <div className="h-px bg-outline-variant flex-1" />
            <span className="text-label-sm text-on-surface-variant uppercase tracking-widest">or</span>
            <div className="h-px bg-outline-variant flex-1" />
          </div>

          <div className="text-center">
            <p className="text-body-md text-on-surface-variant">
              Don&apos;t have an account?{' '}
              <Link href="/register" className="text-label-md text-primary hover:underline ml-1">Sign up</Link>
            </p>
          </div>
        </form>
      </main>
    </div>
  );
}
