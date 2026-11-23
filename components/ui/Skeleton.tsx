/** Loading placeholder that matches the shape of the content it stands in for. */
export default function Skeleton({ className = '' }: { className?: string }) {
  return (
    <div
      aria-hidden
      className={`rounded-xl bg-[length:200%_100%] animate-shimmer bg-gradient-to-r from-surface-container-low via-surface-container-high to-surface-container-low ${className}`}
    />
  );
}

/** Placeholder for a list of cards (e.g. courses while loading). */
export function SkeletonCards({ count = 3, className = 'h-24' }: { count?: number; className?: string }) {
  return (
    <div className="flex flex-col gap-3" role="status" aria-label="Loading">
      {Array.from({ length: count }).map((_, i) => <Skeleton key={i} className={`w-full rounded-2xl ${className}`} />)}
    </div>
  );
}
