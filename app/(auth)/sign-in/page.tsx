import Link from 'next/link'
import { redirect } from 'next/navigation'
import { AuthShell } from '@/components/auth/auth-shell.tsx'
import { SignInForm } from '@/components/auth/sign-in-form.tsx'
import { getCurrentUser } from '@/lib/auth.ts'

const REASONS = [
  'Track orders in real time',
  'Save custom dimensions & mats',
  'Faster 1-click checkout',
]

export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>
}) {
  const { next } = await searchParams
  // Only same-site paths, so ?next= cannot bounce someone to another domain.
  const target = next && next.startsWith('/') && !next.startsWith('//') ? next : '/account'
  if (await getCurrentUser()) redirect(target)

  return (
    <AuthShell active="sign-in">
      <div className="mb-5 text-center">
        <span className="mx-auto grid size-12 place-items-center rounded-full bg-subtle font-display text-lg font-bold text-body">
          G
        </span>
        <h1 className="mt-3 font-display text-xl font-bold text-ink">
          You&rsquo;re browsing as a guest
        </h1>
        <p className="mt-1 text-xs leading-4 text-body">
          Sign in to see your orders, saved addresses and wishlist across visits.
        </p>
      </div>

      <SignInForm next={target} />

      <Link
        href="/browse"
        className="mt-3 block rounded-full border border-line py-3 text-center text-sm font-semibold text-ink"
      >
        Continue as guest
      </Link>

      <ul className="mt-5 flex flex-wrap justify-center gap-x-5 gap-y-2 border-t border-line pt-4">
        {REASONS.map((r) => (
          <li key={r} className="flex items-center gap-[6px] text-[11px] text-body">
            <span className="text-violet-deep">✓</span>
            {r}
          </li>
        ))}
      </ul>

      <p className="mt-4 text-center text-xs text-body">
        New to Framezee?{' '}
        <Link href="/sign-up" className="font-semibold text-violet-deep">
          Create an account
        </Link>
      </p>
    </AuthShell>
  )
}
