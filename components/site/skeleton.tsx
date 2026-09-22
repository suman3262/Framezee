/**
 * Loading placeholders.
 *
 * Tailwind's animate-pulse rather than a shimmer keyframe: it is one class, it respects
 * prefers-reduced-motion already, and a skeleton nobody looks at for more than a moment
 * does not need a gradient sweeping across it.
 *
 * These are shaped like the real content so the page does not jump when it arrives.
 */

export function Bar({ className = '' }: { className?: string }) {
  return <span className={`block animate-pulse rounded bg-subtle ${className}`} />
}

export function Box({ className = '' }: { className?: string }) {
  return <div className={`animate-pulse rounded-xl bg-subtle ${className}`} />
}

/** A card in a listing grid. */
export function CardSkeleton() {
  return (
    <div className="flex flex-col rounded-2xl bg-surface p-4 shadow-[0_1px_1px_rgba(0,0,0,0.05)]">
      <Box className="h-[170px] rounded-xl" />
      <Bar className="mt-3 h-3 w-16" />
      <Bar className="mt-2 h-4 w-3/4" />
      <Bar className="mt-2 h-3 w-1/2" />
    </div>
  )
}

export function GridSkeleton({ count = 6 }: { count?: number }) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-3">
      {Array.from({ length: count }, (_, i) => (
        <CardSkeleton key={i} />
      ))}
    </div>
  )
}

export function RowsSkeleton({ rows = 6 }: { rows?: number }) {
  return (
    <div className="divide-y divide-line rounded-2xl bg-surface p-2 shadow-[0_1px_1px_rgba(0,0,0,0.05)]">
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="flex items-center gap-3 p-3">
          <Box className="size-10 shrink-0 rounded-lg" />
          <span className="min-w-0 flex-1">
            <Bar className="h-3 w-1/3" />
            <Bar className="mt-2 h-3 w-1/2" />
          </span>
          <Bar className="h-4 w-16 shrink-0" />
        </div>
      ))}
    </div>
  )
}

/** The screen-reader half: a skeleton is silent without it. */
export function LoadingLabel({ children }: { children: string }) {
  return (
    <span role="status" aria-live="polite" className="sr-only">
      {children}
    </span>
  )
}
