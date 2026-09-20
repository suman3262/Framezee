import Link from 'next/link'
import { Logo } from '@/components/site/logo.tsx'

/** Shared chrome for sign-in and sign-up (Figma 3:3870 / 3:4956). */
export function AuthShell({
  active,
  children,
  aside,
}: {
  active: 'sign-in' | 'sign-up'
  children: React.ReactNode
  aside?: React.ReactNode
}) {
  return (
    <main className="mx-auto max-w-[1280px] px-4 py-8 sm:px-8">
      <nav className="mb-6 flex items-center gap-2 text-xs text-body">
        <Link href="/" className="hover:text-ink">Home</Link>
        <span className="text-faint">/</span>
        <span className="text-ink">Your account</span>
      </nav>

      <div className={`grid gap-6 ${aside ? 'lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]' : 'max-w-md'}`}>
        <div className="rounded-2xl bg-surface p-6 shadow-[0_1px_1px_rgba(0,0,0,0.05)]">
          <div className="mb-5 flex justify-center">
            <Logo />
          </div>

          <div className="mb-5 flex rounded-full bg-subtle p-1">
            <Tab href="/sign-in" label="Sign in" on={active === 'sign-in'} />
            <Tab href="/sign-up" label="Create account" on={active === 'sign-up'} />
          </div>

          {children}
        </div>

        {aside}
      </div>
    </main>
  )
}

function Tab({ href, label, on }: { href: string; label: string; on: boolean }) {
  return (
    <Link
      href={href}
      className={`flex-1 rounded-full py-2 text-center text-[13px] font-semibold ${
        on ? 'bg-violet text-white' : 'text-body hover:text-ink'
      }`}
    >
      {label}
    </Link>
  )
}
