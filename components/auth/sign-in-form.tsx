'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client.ts'
import { channelFor, normalizePhone, formatPhone } from '@/lib/phone.ts'

/**
 * One field for both channels. A mobile number gets an SMS, anything with an @ gets an
 * email — the customer does not have to pick a tab, and we do not build two forms.
 */
export function SignInForm({ next, mode = 'sign-in' }: { next: string; mode?: 'sign-in' | 'sign-up' }) {
  const router = useRouter()
  const supabase = createClient()

  const [step, setStep] = useState<'identify' | 'code'>('identify')
  const [identifier, setIdentifier] = useState('')
  const [name, setName] = useState('')
  const [sentTo, setSentTo] = useState('')
  const [code, setCode] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function sendCode(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    const channel = channelFor(identifier)
    let target = identifier.trim()

    if (channel === 'sms') {
      const phone = normalizePhone(identifier)
      if (!phone) {
        setError('Enter a 10-digit Indian mobile number, or an email address.')
        return
      }
      target = phone
    }

    setBusy(true)
    // The name rides along in the signup metadata, and the auth.users trigger copies it
    // into public.users. No separate "save your name" step afterwards.
    const options = name.trim() ? { data: { name: name.trim() } } : undefined
    const { error } = await supabase.auth.signInWithOtp(
      channel === 'sms' ? { phone: target, options } : { email: target, options },
    )
    setBusy(false)

    if (error) {
      setError(friendlyError(error.message, channel))
      return
    }
    setSentTo(target)
    setStep('code')
  }

  async function verify(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setBusy(true)

    const channel = channelFor(sentTo)
    const { error } = await supabase.auth.verifyOtp(
      channel === 'sms'
        ? { phone: sentTo, token: code.trim(), type: 'sms' }
        : { email: sentTo, token: code.trim(), type: 'email' },
    )
    setBusy(false)

    if (error) {
      setError(error.message.toLowerCase().includes('expired')
        ? 'That code has expired. Ask for a new one.'
        : 'That code is not right. Check it and try again.')
      return
    }
    router.push(next)
    router.refresh()
  }

  if (step === 'code') {
    return (
      <form onSubmit={verify} className="flex flex-col gap-4">
        <div>
          <h1 className="font-display text-xl font-bold text-ink">Enter your code</h1>
          <p className="mt-1 text-xs text-body">
            Sent to {channelFor(sentTo) === 'sms' ? formatPhone(sentTo) : sentTo}
          </p>
        </div>

        <input
          autoFocus
          inputMode="numeric"
          autoComplete="one-time-code"
          maxLength={8}
          value={code}
          onChange={(e) => setCode(e.target.value)}
          placeholder="6-digit code"
          aria-label="Verification code"
          className="w-full rounded-lg border border-line bg-surface px-4 py-3 text-center text-lg tracking-[0.4em] text-ink placeholder:tracking-normal placeholder:text-faint"
        />

        {error && <p className="text-xs font-medium text-red-600">{error}</p>}

        <button
          type="submit"
          disabled={busy || code.trim().length < 4}
          className="rounded-lg bg-accent py-3 text-sm font-bold text-accent-ink disabled:opacity-50"
        >
          {busy ? 'Checking…' : 'Sign in'}
        </button>

        <button
          type="button"
          onClick={() => {
            setStep('identify')
            setCode('')
            setError(null)
          }}
          className="text-xs font-semibold text-violet"
        >
          Use a different number or email
        </button>
      </form>
    )
  }

  return (
    <form onSubmit={sendCode} className="flex flex-col gap-4">
      {mode === 'sign-up' && (
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Full name"
          aria-label="Full name"
          autoComplete="name"
          className="w-full rounded-lg border border-line bg-surface px-4 py-3 text-sm text-ink placeholder:text-faint"
        />
      )}

      <input
        autoFocus
        value={identifier}
        onChange={(e) => setIdentifier(e.target.value)}
        placeholder="Mobile number or email"
        aria-label="Mobile number or email"
        autoComplete="username"
        className="w-full rounded-lg border border-line bg-surface px-4 py-3 text-sm text-ink placeholder:text-faint"
      />

      {error && <p className="text-xs font-medium text-red-600">{error}</p>}

      <button
        type="submit"
        disabled={busy || identifier.trim().length < 5}
        className="rounded-lg bg-accent py-3 text-sm font-bold text-accent-ink disabled:opacity-50"
      >
        {busy ? 'Sending…' : mode === 'sign-up' ? 'Verify & create account' : 'Send one-time password (OTP)'}
      </button>

      <p className="text-[11px] leading-4 text-faint">
        One account per mobile number. Signing in creates your account if you don&rsquo;t
        have one.
      </p>
    </form>
  )
}

function friendlyError(message: string, channel: 'email' | 'sms'): string {
  const m = message.toLowerCase()
  if (m.includes('rate') || m.includes('too many')) return 'Too many attempts. Wait a minute and try again.'
  if (channel === 'sms' && (m.includes('provider') || m.includes('sms') || m.includes('unsupported')))
    return 'SMS sign-in is not switched on yet. Use your email address instead.'
  return message
}
