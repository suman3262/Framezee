/**
 * Supabase Send SMS Hook → Fast2SMS.
 *
 * Supabase still generates, rate-limits and verifies the OTP. This function only decides
 * how the message reaches the phone, which keeps Supabase the single auth system.
 *
 * ponytail: Quick SMS costs Rs 5 per message and sends from a random numeric sender,
 * because it is the only Fast2SMS route that needs neither DLT registration nor website
 * verification. Two cheaper routes open up later and both are a parameter change here:
 *
 *   route=otp  Rs 0.35  once the site is deployed and Fast2SMS verifies the website
 *   route=dlt  Rs 0.11  once the GSTIN exists and DLT gives us a FRAMEZ sender ID
 */

import { Webhook } from 'https://esm.sh/standardwebhooks@1.0.0'

const FAST2SMS_API_KEY = Deno.env.get('FAST2SMS_API_KEY')!
// Supabase hands this over as "v1,whsec_<base64>"; the library wants the bare secret.
const HOOK_SECRET = (Deno.env.get('SEND_SMS_HOOK_SECRET') ?? '').replace('v1,whsec_', '')

/** Fast2SMS takes the bare 10-digit number: +91 82502 88412 → 8250288412. */
function localNumber(phone: string): string | null {
  const digits = phone.replace(/\D/g, '')
  const local = digits.length > 10 ? digits.slice(-10) : digits
  return /^[6-9]\d{9}$/.test(local) ? local : null
}

Deno.serve(async (req) => {
  const body = await req.text()

  // The hook is a public URL, so an unsigned request is an untrusted one.
  let payload: { user: { phone: string }; sms: { otp: string } }
  try {
    payload = new Webhook(HOOK_SECRET).verify(body, Object.fromEntries(req.headers)) as typeof payload
  } catch {
    return new Response(JSON.stringify({ error: { message: 'Invalid signature' } }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const number = localNumber(payload.user.phone)
  if (!number) {
    return new Response(
      JSON.stringify({ error: { message: 'Only Indian mobile numbers can receive a code.' } }),
      { status: 400, headers: { 'Content-Type': 'application/json' } },
    )
  }

  const url = new URL('https://www.fast2sms.com/dev/bulkV2')
  url.searchParams.set('route', 'q')
  url.searchParams.set('numbers', number)
  url.searchParams.set('message', `${payload.sms.otp} is your Framezee sign-in code. Do not share it.`)

  // Auth is a header — query-param auth was retired and now answers 990 "old API".
  const res = await fetch(url, { headers: { Authorization: FAST2SMS_API_KEY } })
  const result = await res.json().catch(() => ({}))

  if (!res.ok || result.return !== true) {
    // Surfacing the reason means a failed send shows up in the Supabase auth logs
    // rather than looking to the customer like a code that never arrived.
    console.error('Fast2SMS refused the send', result)
    return new Response(
      JSON.stringify({ error: { message: result.message ?? 'Could not send the code. Try again.' } }),
      { status: 502, headers: { 'Content-Type': 'application/json' } },
    )
  }

  return new Response(JSON.stringify({}), { headers: { 'Content-Type': 'application/json' } })
})
