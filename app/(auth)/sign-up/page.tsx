import Link from 'next/link'
import { redirect } from 'next/navigation'
import { AuthShell } from '@/components/auth/auth-shell.tsx'
import { SignInForm } from '@/components/auth/sign-in-form.tsx'
import { getCurrentUser } from '@/lib/auth.ts'

const PRIVILEGES = [
  {
    title: 'Bespoke studio cloud saves',
    body: 'Never lose exact dimensions, mount and mat widths, or wall preview mocks across your devices.',
  },
  {
    title: 'Live workshop tracking',
    body: 'Watch a frame move from cut to glazed to packed, with dispatch updates as they happen.',
  },
  {
    title: 'Member-only discounts',
    body: 'Unlock codes like FRAME10 and seasonal collection drops.',
  },
  {
    title: 'Any custom size',
    body: 'From 4 in to a 60 in span, cut to the millimetre in our Krishnagar workshop.',
  },
]

export default async function SignUpPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>
}) {
  const { next } = await searchParams
  const target = next && next.startsWith('/') && !next.startsWith('//') ? next : '/account'
  if (await getCurrentUser()) redirect(target)

  return (
    <AuthShell
      active="sign-up"
      aside={
        <aside className="rounded-2xl bg-surface p-6 shadow-[0_1px_1px_rgba(0,0,0,0.05)]">
          <h2 className="font-display text-base font-bold text-ink">Framezee member privileges</h2>
          <p className="mt-1 text-xs leading-4 text-body">
            Why join the Framezee family? Millimetre-accurate framing presets, insured
            transport, and museum-grade handling.
          </p>

          <ul className="mt-4 flex flex-col gap-4">
            {PRIVILEGES.map((p) => (
              <li key={p.title} className="flex gap-3">
                <span className="mt-[2px] grid size-6 shrink-0 place-items-center rounded-full bg-violet-tint text-[11px] text-violet-ink">
                  ✦
                </span>
                <span>
                  <span className="block text-[13px] font-bold text-ink">{p.title}</span>
                  <span className="block text-xs leading-4 text-body">{p.body}</span>
                </span>
              </li>
            ))}
          </ul>

          <div className="mt-5 rounded-xl bg-subtle p-4">
            <p className="text-[13px] font-bold text-ink">Handcrafted in West Bengal</p>
            <p className="mt-1 text-xs leading-4 text-body">
              Precision timber joinery. Each joint is glued, pinned and inspected to 1 mm
              tolerance for lasting wall presence.
            </p>
          </div>
        </aside>
      }
    >
      <div className="mb-5">
        <span className="text-[10px] font-bold uppercase tracking-[0.05em] text-faint">
          New artisan member
        </span>
        <h1 className="mt-1 font-display text-xl font-bold text-ink">
          Create your Framezee account
        </h1>
        <p className="mt-1 text-xs leading-4 text-body">
          Unlock millimetre-precise custom framing saves, member discounts like FRAME10, and
          live workshop tracking.
        </p>
      </div>

      <SignInForm next={target} mode="sign-up" />

      <p className="mt-4 text-[11px] leading-4 text-faint">
        Passwordless: your code is sent by email, or by SMS once that is switched on. By
        creating an account you agree to our{' '}
        <Link href="/terms" className="underline">Terms of Service</Link> and{' '}
        <Link href="/privacy" className="underline">Privacy Policy</Link>.
      </p>

      <p className="mt-4 text-center text-xs text-body">
        Already have a Framezee account?{' '}
        <Link href="/sign-in" className="font-semibold text-violet-deep">
          Sign in
        </Link>
      </p>
    </AuthShell>
  )
}
