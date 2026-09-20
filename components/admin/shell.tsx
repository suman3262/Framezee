import Link from 'next/link'
import { signOut } from '@/app/actions/auth.ts'
import { BUSINESS } from '@/lib/business.ts'
import type { AppUser } from '@/lib/auth.ts'

/**
 * The admin chrome, from framezee_super_admin_dashboard_desktop/code.html: a fixed dark
 * rail on the left, a fixed bar across the top, content between them.
 *
 * Two tabs the design draws are deliberately absent — Custom Studio Jobs and Settings —
 * and Price & Material Control and Coupons are here instead. The client's call.
 */

const NAV = [
  { href: '/admin', label: 'Dashboard', icon: 'dashboard' },
  { href: '/admin/orders', label: 'Orders', icon: 'receipt_long' },
  { href: '/admin/products', label: 'Products & Frames', icon: 'crop_original' },
  { href: '/admin/categories', label: 'Categories', icon: 'category' },
]

/** Only a super-admin sees these, and the pages check again for themselves. */
const SUPER_NAV = [
  { href: '/admin/pricing', label: 'Price & Material Control', icon: 'sell' },
  { href: '/admin/coupons', label: 'Coupons', icon: 'confirmation_number' },
  { href: '/admin/revenue', label: 'Revenue & Analytics', icon: 'monitoring' },
  { href: '/admin/staff', label: 'Staff & Permissions', icon: 'admin_panel_settings' },
]

export function Icon({ name, className = '' }: { name: string; className?: string }) {
  return (
    <span aria-hidden className={`material-symbols-outlined leading-none ${className}`}>
      {name}
    </span>
  )
}

export function AdminShell({
  staff,
  active,
  title,
  eyebrow,
  actions,
  pendingCount,
  children,
}: {
  staff: AppUser
  active: string
  title: string
  /** The breadcrumb tail, e.g. "Operations Cockpit". */
  eyebrow?: string
  /** Filters or buttons that belong beside the title rather than in the page body. */
  actions?: React.ReactNode
  /** Drives the badge on Orders — the count of orders still waiting on the workshop. */
  pendingCount?: number
  children: React.ReactNode
}) {
  const isSuper = staff.role === 'super_admin'

  return (
    <div className="min-h-dvh bg-page">
      {/* The design's icon set. Loading it here keeps it off every storefront page. */}
      <link
        rel="stylesheet"
        href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@20..48,100..700,0..1,-50..200&display=swap"
      />

      <aside className="fixed left-0 top-0 z-50 hidden h-full w-64 flex-col justify-between bg-nav-chrome lg:flex">
        <div className="flex flex-col">
          <div className="flex h-16 items-center gap-2 px-6">
            <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-violet font-display text-xs font-extrabold text-white">
              Fz
            </span>
            <span className="flex flex-col leading-tight">
              <span className="font-display text-[15px] font-semibold tracking-tight text-white">
                {BUSINESS.tradingName}
              </span>
              <span className="text-[12px] text-nav-muted">Operations Suite</span>
            </span>
          </div>

          <div className="px-6 py-2">
            <div className="flex items-center justify-between rounded-lg bg-nav-surface px-3 py-1">
              <span className="flex items-center gap-[6px]">
                <span className="size-2 animate-pulse rounded-full bg-violet" />
                <span className="text-[11px] font-semibold uppercase tracking-[0.03em] text-[#f3f0eb]">
                  {isSuper ? 'Super admin' : 'Admin'}
                </span>
              </span>
              <Icon name="verified_user" className="text-[16px] text-nav-muted" />
            </div>
          </div>

          <nav className="mt-2 flex flex-col gap-1 px-2">
            {NAV.map((n) => (
              <NavLink key={n.href} {...n} active={active} badge={n.href === '/admin/orders' ? pendingCount : undefined} />
            ))}

            {isSuper && (
              <>
                <p className="mt-4 px-4 py-1 text-[11px] font-semibold uppercase tracking-[0.06em] text-nav-muted/70">
                  Super admin
                </p>
                {SUPER_NAV.map((n) => (
                  <NavLink key={n.href} {...n} active={active} />
                ))}
              </>
            )}
          </nav>
        </div>

        <div className="p-4">
          <div className="flex items-center gap-3 rounded-xl bg-nav-surface p-3">
            <span className="grid size-8 shrink-0 place-items-center rounded-full bg-violet/20 text-violet-tint">
              <Icon name="precision_manufacturing" className="text-[18px]" />
            </span>
            <span className="flex flex-col leading-tight">
              <span className="text-[11px] font-bold uppercase tracking-[0.03em] text-[#f3f0eb]">
                Workshop
              </span>
              <span className="text-[12px] text-nav-muted">{BUSINESS.address.line2}</span>
            </span>
          </div>
        </div>
      </aside>

      <header className="fixed left-0 top-0 right-0 z-40 h-16 bg-card/90 shadow-[0_1px_8px_rgba(0,0,0,0.04)] backdrop-blur-xl lg:left-64">
        <div className="flex h-16 items-center justify-between gap-5 px-4 sm:px-6">
          <Link href="/admin" className="flex items-center gap-2 lg:hidden">
            <span className="grid size-7 place-items-center rounded-lg bg-violet font-display text-xs font-extrabold text-white">
              Fz
            </span>
          </Link>

          <form action="/admin/orders" className="hidden min-w-0 flex-1 md:block md:max-w-lg">
            <div className="relative flex items-center">
              <Icon name="search" className="absolute left-3 text-[18px] text-t3" />
              <input
                name="q"
                type="search"
                placeholder="Search orders by number or customer…"
                aria-label="Search orders"
                className="h-9 w-full rounded-lg bg-subtle pl-10 pr-3 text-[12px] text-ink outline-none transition-colors placeholder:text-t3 focus:bg-card focus:ring-1 focus:ring-violet/40"
              />
            </div>
          </form>

          <div className="flex items-center gap-3">
            <span className="hidden items-center gap-[6px] rounded-full bg-ok-bg px-3 py-[6px] xl:flex">
              <span className="size-2 animate-pulse rounded-full bg-ok" />
              <span className="text-[11px] font-semibold uppercase tracking-[0.03em] text-ok">
                Live workshop {BUSINESS.address.line2.split(',')[0]}
              </span>
            </span>

            <Link
              href="/admin/products"
              className="flex items-center gap-1 rounded-lg bg-violet px-3 py-[6px] font-display text-[15px] font-semibold text-white shadow-sm transition-colors hover:bg-violet-deep"
            >
              <Icon name="add" className="text-[18px]" />
              <span className="hidden sm:inline">New frame</span>
            </Link>

            <Link
              href="/"
              aria-label="View store"
              className="grid size-9 place-items-center rounded-lg bg-subtle text-body transition-colors hover:bg-violet-tint hover:text-violet-ink"
            >
              <Icon name="storefront" className="text-[20px]" />
            </Link>

            <span className="flex items-center gap-2 pl-1">
              <span className="grid size-8 shrink-0 place-items-center rounded-full bg-violet-deep text-white">
                <Icon name="person" className="text-[18px]" />
              </span>
              <span className="hidden flex-col text-left leading-tight md:flex">
                <span className="font-display text-[15px] font-semibold text-t1">
                  {staff.name || staff.email}
                </span>
                <span className="text-[12px] text-t3">{isSuper ? 'Super admin' : 'Admin'}</span>
              </span>
            </span>

            <form action={signOut}>
              <button
                aria-label="Sign out"
                className="grid size-9 place-items-center rounded-lg text-t3 transition-colors hover:bg-subtle hover:text-ink"
              >
                <Icon name="logout" className="text-[20px]" />
              </button>
            </form>
          </div>
        </div>
      </header>

      {/* Below lg the rail is hidden, so the tabs move into a scrolling strip. */}
      <nav className="fixed left-0 right-0 top-16 z-30 flex gap-1 overflow-x-auto bg-nav-chrome px-3 py-2 lg:hidden">
        {[...NAV, ...(isSuper ? SUPER_NAV : [])].map((n) => (
          <Link
            key={n.href}
            href={n.href}
            className={`whitespace-nowrap rounded-lg px-3 py-[6px] text-[13px] font-semibold ${
              active === n.href ? 'bg-violet text-white' : 'text-nav-muted'
            }`}
          >
            {n.label}
          </Link>
        ))}
      </nav>

      <main className="pt-[104px] lg:pl-64 lg:pt-16">
        <div className="flex flex-col gap-4 px-4 py-5 sm:px-6">
          <div className="flex flex-col justify-between gap-3 md:flex-row md:items-end">
            <div className="flex flex-col gap-1">
              {eyebrow && (
                <span className="flex items-center gap-2 text-[12px] text-t3">
                  Admin panel
                  <Icon name="chevron_right" className="text-[14px]" />
                  <span className="font-semibold text-t2">{eyebrow}</span>
                </span>
              )}
              <h1 className="font-display text-2xl font-bold tracking-[-0.02em] text-t1 sm:text-[32px] sm:leading-10">
                {title}
              </h1>
            </div>
            {actions}
          </div>

          {children}
        </div>
      </main>
    </div>
  )
}

function NavLink({
  href,
  label,
  icon,
  active,
  badge,
}: {
  href: string
  label: string
  icon: string
  active: string
  badge?: number
}) {
  const on = active === href
  return (
    <Link
      href={href}
      aria-current={on ? 'page' : undefined}
      className={`flex items-center justify-between rounded-lg px-3 py-2 transition-colors ${
        on ? 'bg-violet text-white' : 'text-nav-muted hover:bg-nav-surface hover:text-white'
      }`}
    >
      <span className="flex items-center gap-3">
        <Icon name={icon} className="text-[20px]" />
        <span className="text-[13px] font-medium">{label}</span>
      </span>
      {badge ? (
        <span className="rounded-full bg-warn-bg px-[6px] py-[2px] text-[11px] font-semibold text-warn">
          {badge}
        </span>
      ) : null}
    </Link>
  )
}

export function Card({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`rounded-xl bg-card p-4 shadow-[0_1px_2px_rgba(0,0,0,0.05)] ${className}`}>
      {children}
    </div>
  )
}

export function StatusPill({ status }: { status: string }) {
  const tone: Record<string, string> = {
    paid: 'bg-warn-bg text-warn',
    ready_to_ship: 'bg-info-bg text-info',
    shipped: 'bg-sky-100 text-sky-900',
    delivered: 'bg-ok-bg text-ok',
    cancelled: 'bg-bad-bg text-bad',
    refunded: 'bg-bad-bg text-bad',
  }
  return (
    <span
      className={`inline-flex items-center gap-[5px] whitespace-nowrap rounded-full px-2 py-[3px] text-[11px] font-semibold ${
        tone[status] ?? 'bg-subtle text-body'
      }`}
    >
      <span className="size-[5px] rounded-full bg-current" />
      {status.replace(/_/g, ' ')}
    </span>
  )
}
