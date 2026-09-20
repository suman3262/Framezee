import { createHmac, timingSafeEqual } from 'node:crypto'
import { RAZORPAY } from './env.ts'

/**
 * Razorpay over its REST API, with node's crypto for the signatures.
 *
 * No SDK: order creation is one POST and verification is one HMAC, and a payment
 * dependency is a thing you have to keep patched forever.
 */

const API = 'https://api.razorpay.com/v1'

const auth = () =>
  'Basic ' + Buffer.from(`${RAZORPAY.keyId}:${RAZORPAY.keySecret}`).toString('base64')

export type RazorpayOrder = { id: string; amount: number; currency: string; status: string }

/**
 * `amountPaise` must come from the server's own pricing, never from the browser. The
 * whole point of the basket recomputing on every load is that this number cannot be
 * chosen by the customer.
 */
export async function createRazorpayOrder(input: {
  amountPaise: number
  receipt: string
  notes: Record<string, string>
}): Promise<RazorpayOrder> {
  if (!Number.isInteger(input.amountPaise) || input.amountPaise < 100)
    throw new Error('Razorpay rejects anything under ₹1.')

  const res = await fetch(`${API}/orders`, {
    method: 'POST',
    headers: { Authorization: auth(), 'Content-Type': 'application/json' },
    body: JSON.stringify({
      amount: input.amountPaise,
      currency: 'INR',
      receipt: input.receipt.slice(0, 40), // Razorpay caps this
      notes: input.notes,
    }),
  })

  const body = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(body?.error?.description ?? `Razorpay said ${res.status}.`)
  return body as RazorpayOrder
}

/** Constant-time, because a fast compare leaks the signature one byte at a time. */
function sameSignature(expected: string, given: string): boolean {
  const a = Buffer.from(expected, 'utf8')
  const b = Buffer.from(given, 'utf8')
  return a.length === b.length && timingSafeEqual(a, b)
}

/**
 * The webhook is the only thing allowed to create a paid order, so this is the gate.
 * Without it anyone who finds the URL can POST "payment succeeded" and be sent a frame.
 */
export function verifyWebhook(rawBody: string, signature: string | null): boolean {
  if (!signature || !RAZORPAY.webhookSecret) return false
  const expected = createHmac('sha256', RAZORPAY.webhookSecret).update(rawBody).digest('hex')
  return sameSignature(expected, signature)
}

/** The browser's own callback. Checked too, but it never creates the order by itself. */
export function verifyPaymentSignature(
  razorpayOrderId: string,
  razorpayPaymentId: string,
  signature: string,
): boolean {
  const expected = createHmac('sha256', RAZORPAY.keySecret)
    .update(`${razorpayOrderId}|${razorpayPaymentId}`)
    .digest('hex')
  return sameSignature(expected, signature)
}
