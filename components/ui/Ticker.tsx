'use client';
import { useEffect, useState, type ReactNode } from 'react';

/**
 * Re-renders only its own children every `intervalMs` (default 1 s).
 * Wrap countdowns in this instead of ticking state on the whole page.
 */
export default function Ticker({ children, intervalMs = 1000 }: { children: () => ReactNode; intervalMs?: number }) {
  const [, setNow] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setNow(n => n + 1), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);
  return <>{children()}</>;
}
