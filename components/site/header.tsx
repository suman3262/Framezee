import Link from 'next/link'
import { Logo } from './logo.tsx'
import { ThemeToggle } from './theme-toggle.tsx'
import type { AppUser } from '@/lib/auth.ts'

/** Figma 3:10683 (desktop) and 3:10737's header (mobile). One responsive header. */
const NAV = [
  { href: '/browse', label: 'Gallery Store' },
  { href: '/custom', label: 'Custom Studio' },
  { href: '/sizes', label: 'Custom Sizes' },
  { href: '/account/orders', label: 'Track Order' },
]

export function Header({ user, active }: { user: AppUser | null; active?: string }) {
  return (
    <header className="sticky top-0 z-40 bg-page/90 shadow-[0_1px_8px_0_rgba(0,0,0,0.04)] backdrop-blur-[12px]">
      <div className="mx-auto flex h-16 max-w-[1280px] items-center gap-4 px-4 sm:h-20 sm:px-10">
        <Logo />

        <nav className="hidden items-center gap-1 xl:flex">
          {NAV.map((n) => {
            const on = active === n.href
            return (
              <Link
                key={n.href}
                href={n.href}
                className={`whitespace-nowrap rounded-full px-4 py-[6px] text-[13px] font-semibold ${
                  on ? 'bg-violet text-white' : 'text-body hover:text-ink'
                }`}
              >
                {n.label}
              </Link>
            )
          })}
        </nav>

        <div className="hidden min-w-0 max-w-96 flex-1 md:block md:min-w-[160px]">
          <SearchInput />
        </div>

        <div className="ml-auto flex shrink-0 items-center gap-2 md:ml-2">
          <Link
            href="/custom"
            className="hidden items-center gap-[6px] rounded-full bg-accent px-4 py-2 shadow-[0_2px_8px_-2px_rgba(30,30,30,0.04)] lg:flex"
          >
            <img src="/figma/pdp-frame.svg" alt="" className="size-[13px]" />
            <span className="whitespace-nowrap text-[13px] font-semibold text-accent-ink">
              Build a custom frame
            </span>
          </Link>

          <IconLink href="/wishlist" icon="/figma/pdp-heart.svg" label="Wishlist" />
          <IconLink href="/cart" icon="/figma/pdp-cart.svg" label="Cart" badge={0} />
          <ThemeToggle />

          <span className="hidden items-center gap-1 rounded-full bg-subtle px-2 py-1 lg:flex">
            <img src="/figma/pdp-globe.svg" alt="" className="size-[13px] dark:invert" />
            <span className="text-[11px] font-bold uppercase tracking-[0.04em] text-body">
              English
            </span>
          </span>

          <Link
            href={user ? '/account' : '/sign-in'}
            aria-label={user ? 'Your account' : 'Sign in'}
            className="grid size-8 shrink-0 place-items-center rounded-full bg-violet-deep text-xs font-bold text-white"
          >
            {user ? initial(user) : <img src="/figma/pdp-user.svg" alt="" className="size-3" />}
          </Link>
        </div>
      </div>
    </header>
  )
}

export function SearchInput() {
  return (
    <div className="relative">
      <img
        src="/figma/pdp-search.svg"
        alt=""
        className="pointer-events-none absolute left-[14px] top-1/2 size-[13px] -translate-y-1/2 dark:invert"
      />
      <input
        type="search"
        placeholder="Search a size, a moulding, a mat..."
        aria-label="Search frames"
        className="h-9 w-full rounded-full bg-subtle pl-9 pr-4 text-[13px] text-ink placeholder:text-faint focus:outline-2 focus:outline-offset-2 focus:outline-violet-deep"
      />
    </div>
  )
}

function IconLink({
  href,
  icon,
  label,
  badge,
}: {
  href: string
  icon: string
  label: string
  badge?: number
}) {
  return (
    <Link
      href={href}
      aria-label={label}
      className="relative grid size-9 place-items-center rounded-full hover:bg-subtle"
    >
      <img src={icon} alt="" className="size-[17px] dark:invert" />
      {badge !== undefined && badge > 0 && (
        <span className="absolute right-1 top-1 grid size-4 place-items-center rounded-full bg-violet-deep text-[10px] font-bold leading-none text-white">
          {badge}
        </span>
      )}
    </Link>
  )
}

/** First letter of whatever we know them by. */
function initial(user: AppUser): string {
  const source = user.name || user.email || ''
  return (source.trim()[0] ?? '#').toUpperCase()
}
