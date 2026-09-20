import Link from 'next/link'
import { signOut } from '@/app/actions/auth.ts'
import { Container } from '@/components/home/section-heading.tsx'
import type { AppUser } from '@/lib/auth.ts'

const NAV = [
  { href: '/account', label: 'Profile' },
  { href: '/account/orders', label: 'Orders & tracking' },
  { href: '/account/addresses', label: 'Addresses' },
  { href: '/account/preferences', label: 'Preferences' },
]

export function AccountShell({
  user,
  active,
  counts,
  children,
}: {
  user: AppUser
  active: string
  counts?: Partial<Record<string, number>>
  children: React.ReactNode
}) {
  const initial = (user.name || user.email || '?').trim()[0]?.toUpperCase() ?? '?'

  return (
    <Container className="py-6">
      <nav className="flex items-center gap-2 text-xs text-body">
        <Link href="/" className="hover:text-ink">Home</Link>
        <span className="text-faint">/</span>
        <span className="text-ink">Your account</span>
      </nav>

      <header className="mt-4 flex flex-wrap items-center justify-between gap-3">
        <span className="flex items-center gap-3">
          <span className="grid size-12 place-items-center rounded-full bg-violet-tint font-display text-base font-bold text-violet-ink">
            {initial}
          </span>
          <span>
            <span className="block font-display text-xl font-bold text-ink">
              {user.name || 'Your account'}
            </span>
            <span className="block text-xs text-body">
              {user.email ?? user.phone}
              {counts?.orders !== undefined &&
                ` · ${counts.orders} order${counts.orders === 1 ? '' : 's'}`}
              {' · member since '}
              {new Date(user.createdAt).getFullYear()}
            </span>
          </span>
        </span>
        <form action={signOut}>
          <button className="rounded-full border border-line px-4 py-2 text-xs font-semibold text-body hover:text-ink">
            Sign out
          </button>
        </form>
      </header>

      <div className="mt-6 grid gap-6 lg:grid-cols-[200px_minmax(0,1fr)]">
        <nav>
          <ul className="flex gap-2 overflow-x-auto pb-1 lg:flex-col lg:overflow-visible lg:pb-0">
            {NAV.map((n) => {
              const on = active === n.href
              const count = counts?.[n.href]
              return (
                <li key={n.href}>
                  <Link
                    href={n.href}
                    className={`flex items-center justify-between gap-2 whitespace-nowrap rounded-xl px-4 py-2 text-[13px] font-semibold ${
                      on ? 'bg-violet-tint text-violet-ink' : 'text-body hover:bg-subtle hover:text-ink'
                    }`}
                  >
                    {n.label}
                    {count !== undefined && count > 0 && (
                      <span className="text-[11px] font-normal text-faint">{count}</span>
                    )}
                  </Link>
                </li>
              )
            })}
          </ul>
        </nav>

        <div className="min-w-0">{children}</div>
      </div>
    </Container>
  )
}

export function Panel({
  children,
  className = '',
}: {
  children: React.ReactNode
  className?: string
}) {
  return (
    <section className={`rounded-2xl bg-surface p-5 shadow-[0_1px_1px_rgba(0,0,0,0.05)] ${className}`}>
      {children}
    </section>
  )
}
