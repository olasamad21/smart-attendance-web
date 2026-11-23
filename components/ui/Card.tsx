import Link from 'next/link';
import type { HTMLAttributes, ReactNode } from 'react';

type Padding = 'none' | 'sm' | 'md' | 'lg';
const PADDING: Record<Padding, string> = { none: '', sm: 'p-3', md: 'p-4', lg: 'p-6' };
const BASE = 'bg-surface-container-lowest rounded-2xl border border-outline-variant/30 shadow-card';
const INTERACTIVE = 'transition-all duration-150 hover:shadow-raised hover:-translate-y-px active:scale-[0.99]';

export default function Card({
  padding = 'md', className = '', children, ...rest
}: { padding?: Padding; className?: string; children?: ReactNode } & HTMLAttributes<HTMLDivElement>) {
  return <div className={`${BASE} ${PADDING[padding]} ${className}`} {...rest}>{children}</div>;
}

export function CardLink({
  href, padding = 'md', className = '', children,
}: { href: string; padding?: Padding; className?: string; children?: ReactNode }) {
  return (
    <Link href={href} className={`block ${BASE} ${INTERACTIVE} ${PADDING[padding]} ${className}`}>
      {children}
    </Link>
  );
}

/** Section heading with optional action link on the right. */
export function SectionHeader({
  title, action,
}: { title: string; action?: ReactNode }) {
  return (
    <div className="flex items-center justify-between mb-3">
      <h3 className="text-base font-semibold text-on-surface">{title}</h3>
      {action}
    </div>
  );
}
