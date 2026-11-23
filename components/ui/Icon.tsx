import type { CSSProperties } from 'react';

/** Material Symbols icon. `filled` switches to the solid style. Decorative by default. */
export default function Icon({
  name, filled = false, className = '', label, style,
}: { name: string; filled?: boolean; className?: string; label?: string; style?: CSSProperties }) {
  return (
    <span
      className={`material-symbols-outlined ${className}`}
      style={filled ? { fontVariationSettings: "'FILL' 1", ...style } : style}
      aria-hidden={label ? undefined : true}
      aria-label={label}
      role={label ? 'img' : undefined}
    >
      {name}
    </span>
  );
}
