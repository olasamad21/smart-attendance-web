'use client';
import { useAuth } from '@/hooks/useAuth';

export default function AuthProvider({ children }: { children: React.ReactNode }) {
  useAuth();
  return <>{children}</>;
}
