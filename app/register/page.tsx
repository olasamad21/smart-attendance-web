'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { registerSchema, RegisterInput } from '@/lib/utils/validation';
import { registerUser } from '@/lib/firebase/auth.service';
import { useAuthStore } from '@/store/auth.store';

import AuthShell from '@/components/layout/AuthShell';

const DEPARTMENTS = [
  'Computer Science', 'Software Engineering', 'Cyber Security',
  'Information Technology', 'Computer Engineering', 'Electrical Engineering',
  'Mechanical Engineering', 'Civil Engineering', 'Business Administration', 'Other'
];

const LEVELS = ['100', '200', '300', '400', '500'];

export default function RegisterPage() {
  const router = useRouter();
  const { setUser } = useAuthStore();
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [pendingData, setPendingData] = useState<RegisterInput | null>(null);

  const { register, handleSubmit, watch, setValue, formState: { errors } } = useForm<RegisterInput>({
    resolver: zodResolver(registerSchema),
    defaultValues: { role: 'student' },
  });

  const selectedRole = watch('role');

  const onSubmit = async (data: RegisterInput) => {
    if (data.role === 'student') {
      setPendingData(data);
      setShowConfirmModal(true);
    } else {
      await finalizeRegistration(data);
    }
  };

  const finalizeRegistration = async (data: RegisterInput) => {
    setLoading(true);
    setError('');
    setShowConfirmModal(false);
    try {
      const user = await registerUser(data.name, data.email, data.password, data.role, {
        department: data.department,
        level: data.level,
        matricNumber: data.matricNumber,
      });
      setUser(user);
      router.replace(user.role === 'lecturer' ? '/lecturer/dashboard' : '/student/dashboard');
    } catch (err: any) {
      const msg = err.message || '';
      const code = err?.code || '';
      if (code === 'auth/email-already-in-use') {
        setError('An account with this email already exists.');
      } else if (msg === 'MATRIC_ALREADY_IN_USE') {
        setError('This Matric Number is already registered.');
      } else {
        setError('Registration failed. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthShell title="Create your account" subtitle="Takes a minute. Students set up face verification right after." back>

        {error && (
          <div className="mb-4 p-3 bg-error-container rounded-lg flex items-center gap-2">
            <span className="material-symbols-outlined text-error text-lg">error</span>
            <p className="text-sm text-on-error-container">{error}</p>
          </div>
        )}

        <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
          
          {/* Role selector */}
          <div className="flex flex-col gap-1">
            <label className="text-xs font-semibold text-on-surface-variant uppercase tracking-wider">I am a...</label>
            <div className="grid grid-cols-2 gap-3">
              {(['lecturer', 'student'] as const).map((role) => (
                <button
                  key={role}
                  type="button"
                  onClick={() => setValue('role', role)}
                  className={`p-4 rounded-2xl border-2 text-left transition-all active:scale-[0.98] ${
                    selectedRole === role
                      ? 'border-primary bg-primary/5'
                      : 'border-outline-variant bg-surface-container-lowest'
                  }`}
                >
                  <span className={`material-symbols-outlined text-2xl mb-1 block ${selectedRole === role ? 'text-primary' : 'text-outline'}`} style={selectedRole === role ? { fontVariationSettings: "'FILL' 1" } : undefined}>
                    {role === 'lecturer' ? 'school' : 'person'}
                  </span>
                  <span className={`text-sm font-semibold capitalize ${selectedRole === role ? 'text-primary' : 'text-on-surface-variant'}`}>
                    {role}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* Full Name */}
          <div className="flex flex-col gap-1">
            <label className="field-label">Full Name</label>
            <div className="relative flex items-center">
              <span className="material-symbols-outlined field-icon">badge</span>
              <input {...register('name')} placeholder="John Doe"
                className="field-input pl-11"
              />
            </div>
            {errors.name && <p className="field-error">{errors.name.message}</p>}
          </div>

          {/* Email */}
          <div className="flex flex-col gap-1">
            <label className="field-label">Email Address</label>
            <div className="relative flex items-center">
              <span className="material-symbols-outlined field-icon">mail</span>
              <input {...register('email')} type="email" placeholder="student@university.edu"
                className="field-input pl-11"
              />
            </div>
            {errors.email && <p className="field-error">{errors.email.message}</p>}
          </div>

          {/* Department */}
          <div className="flex flex-col gap-1">
            <label className="field-label">Department</label>
            <div className="relative flex items-center">
              <span className="material-symbols-outlined field-icon">apartment</span>
              <select {...register('department')}
                className="field-input pl-11"
              >
                <option value="">Select department</option>
                {DEPARTMENTS.map(d => <option key={d} value={d}>{d}</option>)}
              </select>
              <span className="material-symbols-outlined absolute right-3.5 text-outline text-xl pointer-events-none">expand_more</span>
            </div>
          </div>

          {/* Student-only fields */}
          {selectedRole === 'student' && (
            <>
              <div className="flex flex-col gap-1">
                <label className="field-label">Matric Number</label>
                <div className="relative flex items-center">
                  <span className="material-symbols-outlined field-icon">tag</span>
                  <input {...register('matricNumber')} placeholder="e.g. CSC/2021/001"
                    className="field-input pl-11"
                  />
                </div>
                {errors.matricNumber && <p className="field-error">{errors.matricNumber.message}</p>}
              </div>
              <div className="flex flex-col gap-1">
                <label className="field-label">Confirm Matric Number</label>
                <div className="relative flex items-center">
                  <span className="material-symbols-outlined field-icon">tag</span>
                  <input {...register('confirmMatricNumber')} placeholder="e.g. CSC/2021/001"
                    className="field-input pl-11"
                  />
                </div>
                {errors.confirmMatricNumber && <p className="field-error">{errors.confirmMatricNumber.message}</p>}
              </div>
              <div className="flex flex-col gap-1">
                <label className="field-label">Level</label>
                <div className="relative flex items-center">
                  <span className="material-symbols-outlined field-icon">trending_up</span>
                  <select {...register('level')}
                    className="field-input pl-11"
                  >
                    <option value="">Select level</option>
                    {LEVELS.map(l => <option key={l} value={l}>{l} Level</option>)}
                  </select>
                  <span className="material-symbols-outlined absolute right-3.5 text-outline text-xl pointer-events-none">expand_more</span>
                </div>
              </div>
            </>
          )}

          {/* Password */}
          <div className="flex flex-col gap-1">
            <label className="field-label">Password</label>
            <div className="relative flex items-center">
              <span className="material-symbols-outlined field-icon">lock</span>
              <input {...register('password')} type={showPassword ? 'text' : 'password'} placeholder="Min. 8 chars with a number"
                className="field-input pl-11 pr-12"
              />
              <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 text-outline w-8 h-8 flex items-center justify-center">
                <span className="material-symbols-outlined text-xl">{showPassword ? 'visibility' : 'visibility_off'}</span>
              </button>
            </div>
            {errors.password && <p className="field-error">{errors.password.message}</p>}
          </div>

          {/* Confirm Password */}
          <div className="flex flex-col gap-1">
            <label className="field-label">Confirm Password</label>
            <div className="relative flex items-center">
              <span className="material-symbols-outlined field-icon">lock_reset</span>
              <input {...register('confirmPassword')} type="password" placeholder="Repeat password"
                className="field-input pl-11"
              />
            </div>
            {errors.confirmPassword && <p className="field-error">{errors.confirmPassword.message}</p>}
          </div>

          <button type="submit" disabled={loading}
            className="mt-2 w-full h-12 rounded-full bg-primary text-on-primary text-sm font-semibold shadow-card hover:brightness-110 active:scale-[0.98] disabled:opacity-60 transition-all flex items-center justify-center gap-2"
          >
            {loading ? (
              <><div className="w-4 h-4 border-2 border-on-primary border-t-transparent rounded-full animate-spin" />Creating account...</>
            ) : 'Create Account'}
          </button>

          <p className="text-center text-sm text-on-surface-variant">
            Already have an account?{' '}
            <Link href="/login" className="text-primary font-semibold hover:underline">Log in</Link>
          </p>
        </form>
      {/* Confirmation Modal */}
      {showConfirmModal && pendingData && (
        <div 
          className="fixed inset-0 bg-black/60 z-[100] flex items-center justify-center p-5"
          onClick={() => setShowConfirmModal(false)}
        >
          <div 
            className="bg-surface-container-lowest w-full max-w-sm rounded-2xl p-6 card-shadow"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="w-12 h-12 bg-primary-container text-on-primary-container rounded-full flex items-center justify-center mx-auto mb-4">
              <span className="material-symbols-outlined text-2xl">verified_user</span>
            </div>
            <h3 className="text-xl font-bold text-on-surface text-center mb-2">Review Your Details</h3>
            <p className="text-sm text-on-surface-variant text-center mb-6">
              Please verify your Matric Number carefully. It cannot be changed later.
            </p>
            
            <div className="bg-surface-container-low rounded-xl p-4 flex flex-col gap-3 mb-6">
              <div>
                <p className="text-xs text-on-surface-variant uppercase tracking-wider font-semibold">Full Name</p>
                <p className="text-sm font-medium text-on-surface">{pendingData.name}</p>
              </div>
              <div>
                <p className="text-xs text-on-surface-variant uppercase tracking-wider font-semibold">Email Address</p>
                <p className="text-sm font-medium text-on-surface">{pendingData.email}</p>
              </div>
              <div>
                <p className="text-xs text-on-surface-variant uppercase tracking-wider font-semibold">Department</p>
                <p className="text-sm font-medium text-on-surface">{pendingData.department}</p>
              </div>
              <div>
                <p className="text-xs text-primary uppercase tracking-wider font-semibold">Matric Number</p>
                <p className="text-base font-bold text-primary">{pendingData.matricNumber}</p>
              </div>
            </div>

            <div className="flex gap-3">
              <button 
                onClick={() => setShowConfirmModal(false)}
                disabled={loading}
                className="flex-1 h-12 rounded-full border border-outline-variant text-on-surface-variant font-medium text-sm active:scale-95 transition-all disabled:opacity-50"
              >
                Go Back
              </button>
              <button 
                onClick={() => finalizeRegistration(pendingData)}
                disabled={loading}
                className="flex-1 h-12 rounded-full bg-primary text-on-primary font-bold text-sm active:scale-95 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {loading ? <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" /> : 'Confirm & Register'}
              </button>
            </div>
          </div>
        </div>
      )}
    </AuthShell>
  );
}
