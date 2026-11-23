import Link from 'next/link';
import type { ButtonHTMLAttributes, ReactNode } from 'react';
import Icon from './Icon';

type Variant = 'primary' | 'tonal' | 'outline' | 'ghost' | 'danger' | 'success';
type Size = 'sm' | 'md' | 'lg';

const VARIANT: Record<Variant, string> = {
  primary: 'bg-primary text-on-primary shadow-card hover:brightness-110',
  tonal: 'bg-primary-container text-on-primary-container hover:brightness-105',
  outline: 'border border-outline-variant text-on-surface hover:bg-surface-container-low',
  ghost: 'text-primary hover:bg-primary/10',
  danger: 'bg-error text-on-error hover:brightness-110',
  success: 'bg-success text-on-success hover:brightness-110',
};
const SIZE: Record<Size, string> = {
  sm: 'h-9 px-4 text-xs gap-1.5',
  md: 'h-11 px-5 text-sm gap-2',
  lg: 'h-14 px-6 text-base gap-2',
};
const ICON_SIZE: Record<Size, string> = { sm: 'text-base', md: 'text-lg', lg: 'text-xl' };

function classes(variant: Variant, size: Size, fullWidth: boolean, extra: string) {
  return [
    'inline-flex items-center justify-center rounded-full font-semibold select-none',
    'transition-all duration-150 active:scale-[0.97]',
    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background',
    'disabled:opacity-50 disabled:pointer-events-none',
    VARIANT[variant], SIZE[size], fullWidth ? 'w-full' : '', extra,
  ].join(' ');
}

interface CommonProps {
  variant?: Variant;
  size?: Size;
  icon?: string;
  iconRight?: string;
  fullWidth?: boolean;
  className?: string;
  children?: ReactNode;
}

export default function Button({
  variant = 'primary', size = 'md', icon, iconRight, fullWidth = false, loading = false,
  className = '', children, disabled, type = 'button', ...rest
}: CommonProps & { loading?: boolean } & ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button type={type} disabled={disabled || loading} aria-busy={loading || undefined}
      className={classes(variant, size, fullWidth, className)} {...rest}>
      {loading
        ? <span className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" aria-hidden />
        : icon && <Icon name={icon} className={ICON_SIZE[size]} />}
      {children}
      {iconRight && !loading && <Icon name={iconRight} className={ICON_SIZE[size]} />}
    </button>
  );
}

export function ButtonLink({
  href, variant = 'primary', size = 'md', icon, iconRight, fullWidth = false, className = '', children,
}: CommonProps & { href: string }) {
  return (
    <Link href={href} className={classes(variant, size, fullWidth, className)}>
      {icon && <Icon name={icon} className={ICON_SIZE[size]} />}
      {children}
      {iconRight && <Icon name={iconRight} className={ICON_SIZE[size]} />}
    </Link>
  );
}
