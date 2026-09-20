import Link from 'next/link'

/** Figma 3:10686 — the Fz mark then the Framezee wordmark. */
export function Logo({ size = 32 }: { size?: number }) {
  return (
    <Link href="/" className="flex shrink-0 items-center gap-2" aria-label="Framezee home">
      <span
        className="relative grid shrink-0 place-items-center rounded-lg bg-violet font-display font-extrabold text-white"
        style={{ width: size, height: size, fontSize: size * 0.4 }}
      >
        Fz
      </span>
      <span
        className="font-display font-semibold tracking-[-0.025em] text-ink"
        style={{ fontSize: size * 0.625 }}
      >
        Framezee
      </span>
    </Link>
  )
}
