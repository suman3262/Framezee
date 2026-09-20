'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client.ts'

type Step =
  | { name: 'password' }
  | { name: 'code'; factorId: string }
  | { name: 'enrol'; factorId: string; qr: string; secret: string }

/**
 * Staff sign-in: password, then an authenticator code. Never an OTP link or an SMS —
 * a factor that arrives in an inbox is not a second factor when the first one is an
 * email address.
 *
 * An account with no authenticator enrols one here rather than anywhere else, so there
 * is no window in which a staff account exists without a second factor.
 */
export function AdminSignIn({ denied }: { denied?: string }) {
  const router = useRouter()
  const supabase = createClient()

  const [step, setStep] = useState<Step>({ name: 'password' })
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [code, setCode] = useState('')
  const [error, setError] = useState<string | null>(
    denied === 'mfa'
      ? 'Finish signing in with your authenticator.'
      : denied === 'suspended'
        ? 'This account is suspended. A super-admin can lift it.'
        : null,
  )
  const [busy, setBusy] = useState(false)

  async function submitPassword(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setBusy(true)

    const { error } = await supabase.auth.signInWithPassword({
      email: email.trim().toLowerCase(),
      password,
    })
    if (error) {
      setBusy(false)
      // Deliberately vague: saying which half was wrong tells an attacker which
      // addresses are real.
      setError('That email and password do not match.')
      return
    }

    const { data: factors } = await supabase.auth.mfa.listFactors()
    const verified = factors?.totp?.find((f) => f.status === 'verified')
    setBusy(false)
    setPassword('')

    if (verified) {
      setStep({ name: 'code', factorId: verified.id })
      return
    }

    // No authenticator yet. Clear any half-finished attempt, then start a fresh one —
    // an unverified factor left behind by an abandoned enrolment blocks the next try.
    for (const f of factors?.all ?? [])
      if (f.status === 'unverified') await supabase.auth.mfa.unenroll({ factorId: f.id })

    const { data, error: enrolError } = await supabase.auth.mfa.enroll({
      factorType: 'totp',
      friendlyName: `Framezee admin ${new Date().toISOString().slice(0, 10)}`,
    })
    if (enrolError || !data) {
      setError('Could not start authenticator setup. Try again.')
      return
    }
    setStep({ name: 'enrol', factorId: data.id, qr: data.totp.qr_code, secret: data.totp.secret })
  }

  async function submitCode(e: React.FormEvent) {
    e.preventDefault()
    if (step.name === 'password') return
    setError(null)
    setBusy(true)

    const { error } = await supabase.auth.mfa.challengeAndVerify({
      factorId: step.factorId,
      code: code.replace(/\D/g, ''),
    })
    setBusy(false)

    if (error) {
      setError('That code is not right. Check the clock on your phone and try the next one.')
      setCode('')
      return
    }

    router.push('/admin')
    router.refresh()
  }

  return (
    <main className="grid min-h-dvh place-items-center bg-nav-chrome px-4 py-10">
      <div className="w-full max-w-[380px]">
        <div className="mb-6 flex items-center gap-2">
          <span className="grid size-9 place-items-center rounded-lg bg-violet font-display text-sm font-extrabold text-white">
            Fz
          </span>
          <span className="flex flex-col leading-tight">
            <span className="font-display text-[15px] font-semibold text-white">Framezee</span>
            <span className="text-[12px] text-nav-muted">Operations Suite</span>
          </span>
        </div>

        <div className="rounded-xl bg-card p-6 shadow-lg">
          {step.name === 'password' && (
            <form onSubmit={submitPassword} className="flex flex-col gap-4">
              <div>
                <h1 className="font-display text-xl font-bold text-t1">Staff sign-in</h1>
                <p className="mt-1 text-xs text-t3">
                  Customers sign in at <span className="font-mono">/sign-in</span>. This door is
                  for the workshop.
                </p>
              </div>

              <Field
                label="Work email"
                type="email"
                value={email}
                onChange={setEmail}
                autoComplete="username"
                autoFocus
              />
              <Field
                label="Password"
                type="password"
                value={password}
                onChange={setPassword}
                autoComplete="current-password"
              />

              {error && <Err>{error}</Err>}

              <Submit busy={busy} disabled={!email.trim() || !password}>
                Continue
              </Submit>
            </form>
          )}

          {step.name === 'enrol' && (
            <form onSubmit={submitCode} className="flex flex-col gap-4">
              <div>
                <h1 className="font-display text-xl font-bold text-t1">Set up your authenticator</h1>
                <p className="mt-1 text-xs text-t3">
                  Scan this with Google Authenticator, Microsoft Authenticator, 1Password — any
                  TOTP app. Then type the six digits it shows.
                </p>
              </div>

              {/* Supabase returns the QR as an SVG data URI. */}
              <img
                src={step.qr}
                alt="Authenticator setup QR code"
                className="mx-auto size-44 rounded-lg bg-white p-2"
              />

              <details className="text-xs text-t3">
                <summary className="cursor-pointer font-semibold text-violet-deep">
                  Can&rsquo;t scan it?
                </summary>
                <p className="mt-2 break-all rounded-lg bg-subtle p-2 font-mono text-[11px] text-t2">
                  {step.secret}
                </p>
              </details>

              <CodeField value={code} onChange={setCode} />
              {error && <Err>{error}</Err>}

              <Submit busy={busy} disabled={code.replace(/\D/g, '').length < 6}>
                Confirm and sign in
              </Submit>
              <p className="text-center text-[11px] text-t3">
                Keep the app. You will need it every time you sign in.
              </p>
            </form>
          )}

          {step.name === 'code' && (
            <form onSubmit={submitCode} className="flex flex-col gap-4">
              <div>
                <h1 className="font-display text-xl font-bold text-t1">Authenticator code</h1>
                <p className="mt-1 text-xs text-t3">
                  Open your authenticator app and type the current six digits.
                </p>
              </div>

              <CodeField value={code} onChange={setCode} />
              {error && <Err>{error}</Err>}

              <Submit busy={busy} disabled={code.replace(/\D/g, '').length < 6}>
                Sign in
              </Submit>
            </form>
          )}
        </div>

        <p className="mt-4 text-center text-[11px] text-nav-muted">
          Every action in the dashboard is recorded against your account.
        </p>
      </div>
    </main>
  )
}

function Field({
  label,
  type,
  value,
  onChange,
  autoComplete,
  autoFocus,
}: {
  label: string
  type: string
  value: string
  onChange: (v: string) => void
  autoComplete?: string
  autoFocus?: boolean
}) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-[11px] font-semibold uppercase tracking-[0.04em] text-t3">{label}</span>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        autoComplete={autoComplete}
        autoFocus={autoFocus}
        required
        className="w-full rounded-lg border border-rule bg-card px-3 py-[10px] text-sm text-t1 outline-none focus:ring-2 focus:ring-violet/40"
      />
    </label>
  )
}

function CodeField({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <input
      autoFocus
      inputMode="numeric"
      autoComplete="one-time-code"
      maxLength={7}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder="000000"
      aria-label="Six-digit authenticator code"
      className="w-full rounded-lg border border-rule bg-card px-3 py-3 text-center text-lg tracking-[0.4em] text-t1 outline-none placeholder:text-t3 focus:ring-2 focus:ring-violet/40"
    />
  )
}

const Err = ({ children }: { children: React.ReactNode }) => (
  <p className="rounded-lg bg-bad-bg px-3 py-2 text-xs font-medium text-bad">{children}</p>
)

function Submit({
  busy,
  disabled,
  children,
}: {
  busy: boolean
  disabled: boolean
  children: React.ReactNode
}) {
  return (
    <button
      type="submit"
      disabled={busy || disabled}
      className="rounded-lg bg-violet py-3 font-display text-sm font-bold text-white disabled:opacity-50"
    >
      {busy ? 'Checking…' : children}
    </button>
  )
}
