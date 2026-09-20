import { eq } from 'drizzle-orm'
import { db } from '@/db/index.ts'
import { payments } from '@/db/schema.ts'
import { verifyWebhook } from '@/lib/razorpay.ts'
import { createOrderFromCart } from '@/lib/order-create.ts'

/**
 * Razorpay's webhook. The only thing in this codebase that creates a paid order.
 *
 * Why not the browser callback: a customer who pays and immediately closes the tab must
 * still get their frame, and a browser can claim anything. Razorpay talks to us directly,
 * signs what it sends, and retries until we answer 2xx.
 *
 * Three rules follow from that:
 *   1. An unverified body is never acted on.
 *   2. A retry must not create a second order — a unique index on razorpay_order_id
 *      decides that, not a SELECT, because two retries can overlap.
 *   3. Anything we cannot act on still answers 200, or Razorpay retries it forever.
 */
export async function POST(req: Request) {
  const raw = await req.text()

  if (!verifyWebhook(raw, req.headers.get('x-razorpay-signature'))) {
    console.warn('razorpay webhook: bad signature')
    return Response.json({ error: 'bad signature' }, { status: 401 })
  }

  let event: {
    event: string
    payload?: { payment?: { entity?: Record<string, unknown> } }
  }
  try {
    event = JSON.parse(raw)
  } catch {
    return Response.json({ ok: true, ignored: 'unparseable' })
  }

  // order.paid arrives alongside payment.captured for the same money; acting on one is
  // enough, and the index would refuse the second anyway.
  if (event.event !== 'payment.captured')
    return Response.json({ ok: true, ignored: event.event })

  const p = event.payload?.payment?.entity ?? {}
  const razorpayOrderId = String(p.order_id ?? '')
  const razorpayPaymentId = String(p.id ?? '')
  const amountPaise = Number(p.amount ?? 0)
  const notes = (p.notes ?? {}) as Record<string, string>

  if (!razorpayOrderId || !razorpayPaymentId || !notes.userId || !notes.addressId) {
    console.warn('razorpay webhook: missing ids or notes', { razorpayOrderId, notes })
    return Response.json({ ok: true, ignored: 'incomplete' })
  }

  const already = await db
    .select({ id: payments.id })
    .from(payments)
    .where(eq(payments.razorpayOrderId, razorpayOrderId))
    .limit(1)
  if (already.length > 0) return Response.json({ ok: true, duplicate: true })

  try {
    const order = await createOrderFromCart({
      userId: notes.userId,
      addressId: notes.addressId,
      paymentMethod: 'razorpay',
      payment: {
        razorpayOrderId,
        razorpayPaymentId,
        signature: req.headers.get('x-razorpay-signature') ?? '',
      },
    })

    console.log(`razorpay webhook: order ${order.orderNo} created for ${amountPaise} paise`)
    return Response.json({ ok: true, orderNo: order.orderNo })
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e)

    // The unique index caught a racing retry — the money is accounted for, so this is a
    // success from Razorpay's point of view.
    if (message.includes('payments_razorpay_order_id_key'))
      return Response.json({ ok: true, duplicate: true })

    // Anything else is ours to fix. Answering 200 stops an endless retry loop against a
    // basket that will never price, and the log is where this gets found.
    console.error(`razorpay webhook: could not create the order — ${message}`, {
      razorpayOrderId,
      razorpayPaymentId,
    })
    return Response.json({ ok: true, failed: message })
  }
}

/** Razorpay pings the URL when you save it in the dashboard. */
export function GET() {
  return Response.json({ ok: true, endpoint: 'razorpay webhook' })
}
