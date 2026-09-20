/**
 * Every environment-dependent value, read in one place.
 *
 * Scattered `process.env` reads are how a hardcoded `localhost:3000` survives into
 * production: nothing fails, the link just points at the wrong machine. Reading them here
 * means a missing variable is a startup error with a sentence attached, not a broken link
 * a customer finds.
 *
 * Only NEXT_PUBLIC_* values reach the browser. Everything else is server-side, and
 * lib/supabase/admin.ts is the only place the service-role key is ever touched.
 */

export type AppEnv = 'development' | 'staging' | 'production'

function readAppEnv(): AppEnv {
  const raw = (process.env.NEXT_PUBLIC_APP_ENV ?? '').trim().toLowerCase()
  if (raw === 'production' || raw === 'prod') return 'production'
  if (raw === 'staging' || raw === 'stage') return 'staging'
  if (raw === 'development' || raw === 'dev' || raw === '') return 'development'
  throw new Error(
    `NEXT_PUBLIC_APP_ENV is "${raw}". Use development, staging or production.`,
  )
}

export const APP_ENV: AppEnv = readAppEnv()
export const isProduction = APP_ENV === 'production'

/**
 * Where this deployment actually lives. Used for anything that has to be absolute:
 * Razorpay's callback, Shiprocket's webhook, links in emails, canonical URLs.
 *
 * Development falls back to localhost so nobody has to set it to run the app. Production
 * refuses to start without it, because falling back silently is exactly the bug this
 * file exists to prevent.
 */
function readSiteUrl(): string {
  const raw = (process.env.NEXT_PUBLIC_SITE_URL ?? '').trim().replace(/\/+$/, '')

  if (!raw) {
    if (APP_ENV === 'production')
      throw new Error(
        'NEXT_PUBLIC_SITE_URL must be set in production — payment callbacks and email links need an absolute address.',
      )
    return 'http://localhost:3000'
  }

  try {
    new URL(raw)
  } catch {
    throw new Error(`NEXT_PUBLIC_SITE_URL is "${raw}", which is not a URL.`)
  }

  if (APP_ENV === 'production' && !raw.startsWith('https://'))
    throw new Error(`NEXT_PUBLIC_SITE_URL must be https in production, not "${raw}".`)

  return raw
}

export const SITE_URL = readSiteUrl()

/** An absolute URL for a path in this deployment. `url('/admin')`. */
export const url = (path: string) => `${SITE_URL}${path.startsWith('/') ? path : `/${path}`}`

/**
 * The unguessable door to the admin. Only the sign-in page lives here; the dashboard
 * stays on /admin, gated by role and MFA rather than by obscurity.
 *
 * It sits in this file, not lib/auth.ts, so scripts can print it — importing auth.ts
 * outside Next drags in next/navigation and fails.
 */
export const ADMIN_SIGN_IN = '/framezee/a/auth/admin'

/**
 * Razorpay. Absent in development until the keys are pasted in, so everything here is
 * optional and `razorpayReady` is what the checkout button asks.
 *
 * The webhook secret is not issued by Razorpay — it is a shared string typed into both
 * the dashboard and .env. If the two differ, every webhook fails verification and no
 * order is ever created, which is exactly the failure this comment exists to shorten.
 */
export const RAZORPAY = {
  keyId: process.env.RAZORPAY_KEY_ID?.trim() ?? '',
  keySecret: process.env.RAZORPAY_KEY_SECRET?.trim() ?? '',
  webhookSecret: process.env.RAZORPAY_WEBHOOK_SECRET?.trim() ?? '',
} as const

export const razorpayReady = Boolean(RAZORPAY.keyId && RAZORPAY.keySecret)

/** A live key outside production is nearly always a mistake, and an expensive one. */
if (RAZORPAY.keyId.startsWith('rzp_live_') && APP_ENV !== 'production')
  console.warn(
    `RAZORPAY_KEY_ID is a LIVE key but NEXT_PUBLIC_APP_ENV is "${APP_ENV}". Real money will move.`,
  )
