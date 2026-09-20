import Link from 'next/link'

export function SectionHeading({
  title,
  href,
  tone = 'accent',
}: {
  title: string
  href: string
  tone?: 'accent' | 'violet'
}) {
  return (
    <div className="mb-4 flex items-center justify-between">
      <h2 className="font-display text-xl font-bold tracking-[-0.02em] text-ink sm:text-2xl">{title}</h2>
      <Link
        href={href}
        className={`rounded-full px-3 py-[6px] text-xs font-bold ${
          tone === 'accent' ? 'bg-accent text-accent-ink' : 'bg-violet-deep text-white'
        }`}
      >
        Explore All
      </Link>
    </div>
  )
}

/** Page gutter. 16px on phones as the mobile design specifies, wider on desktop. */
export function Container({
  children,
  className = '',
}: {
  children: React.ReactNode
  className?: string
}) {
  return <div className={`mx-auto max-w-[1280px] px-4 sm:px-6 ${className}`}>{children}</div>
}
