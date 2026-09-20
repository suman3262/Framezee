export function Stars({ tenths, size = 15 }: { tenths: number; size?: number }) {
  return (
    <span className="inline-flex items-center gap-[1px]" aria-label={`${tenths / 10} out of 5`}>
      {[1, 2, 3, 4, 5].map((i) => {
        // Each star is filled by however much of it this rating covers.
        const fill = Math.max(0, Math.min(1, tenths / 10 - (i - 1)))
        return (
          <span key={i} className="relative inline-block" style={{ width: size, height: size }}>
            <Star size={size} className="absolute inset-0 text-line" />
            <span className="absolute inset-0 overflow-hidden" style={{ width: `${fill * 100}%` }}>
              <Star size={size} className="text-accent" />
            </span>
          </span>
        )
      })}
    </span>
  )
}

function Star({ size, className = '' }: { size: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" fill="currentColor" className={className} aria-hidden>
      <path d="M10 1.5l2.47 5.26 5.53.79-4 4.05.94 5.9L10 14.75 5.06 17.5l.94-5.9-4-4.05 5.53-.79z" />
    </svg>
  )
}
