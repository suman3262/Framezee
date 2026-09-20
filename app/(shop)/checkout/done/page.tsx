import Link from 'next/link'
import { and, eq } from 'drizzle-orm'
import { db } from '@/db/index.ts'
import { orders, payments } from '@/db/schema.ts'
import { requireUser } from '@/lib/auth.ts'
import { Container } from '@/components/home/section-heading.tsx'
import { fmtInr } from '@/lib/pricing.ts'

export const metadata = { title: 'Order confirmed — Framezee' }

/**
 * The wait between paying and the webhook landing.
 *
 * Razorpay's modal closes the moment the customer's bank says yes, but our order does not
 * exist until Razorpay tells *us*, server to server. That gap is usually under a second
 * and occasionally several, so this page refreshes itself rather than claiming either
 * outcome early. No JavaScript: a meta refresh survives a flaky connection.
 */
export default async function CheckoutDone({
  searchParams,
}: {
  searchParams: Promise<{ o?: string; n?: string }>
}) {
  const user = await requireUser('/account/orders')
  const { o: razorpayOrderId, n } = await searchParams
  const attempt = Number(n ?? 0)

  const [row] = razorpayOrderId
    ? await db
        .select({
          orderNo: orders.orderNo,
          id: orders.id,
          totalPaise: orders.totalPaise,
          status: orders.status,
        })
        .from(payments)
        .innerJoin(orders, eq(payments.orderId, orders.id))
        .where(and(eq(payments.razorpayOrderId, razorpayOrderId), eq(orders.userId, user.id)))
        .limit(1)
    : []

  if (row)
    return (
      <Container className="py-16">
        <div className="mx-auto max-w-md text-center">
          <span className="mx-auto grid size-14 place-items-center rounded-full bg-emerald-100 text-2xl">
            ✓
          </span>
          <h1 className="mt-4 font-display text-2xl font-bold text-ink">Payment received</h1>
          <p className="mt-2 text-sm text-body">
            Order <span className="font-mono font-semibold text-ink">{row.orderNo}</span> for{' '}
            {fmtInr(row.totalPaise)}. We have started cutting.
          </p>
          <div className="mt-6 flex flex-col gap-2">
            <Link
              href="/account/orders"
              className="rounded-full bg-accent py-3 font-display text-sm font-bold text-accent-ink"
            >
              Track this order
            </Link>
            <Link href="/browse" className="py-2 text-sm font-semibold text-violet-deep">
              Keep browsing
            </Link>
          </div>
        </div>
      </Container>
    )

  // Roughly 30 seconds of waiting. Past that something is wrong on our side, and saying
  // so honestly beats a spinner that never stops.
  const givenUp = attempt >= 15

  return (
    <Container className="py-16">
      {!givenUp && razorpayOrderId && (
        <meta
          httpEquiv="refresh"
          content={`2; url=/checkout/done?o=${encodeURIComponent(razorpayOrderId)}&n=${attempt + 1}`}
        />
      )}

      <div className="mx-auto max-w-md text-center">
        {givenUp ? (
          <>
            <h1 className="font-display text-2xl font-bold text-ink">Still confirming</h1>
            <p className="mt-2 text-sm leading-5 text-body">
              Your payment went through, but the confirmation has not reached us yet. Nothing
              is lost — the order appears as soon as it does, and you are not charged twice.
            </p>
            <p className="mt-2 text-xs text-faint">
              Reference <span className="font-mono">{razorpayOrderId}</span>
            </p>
          </>
        ) : (
          <>
            <span className="mx-auto block size-10 animate-spin rounded-full border-2 border-line border-t-violet-deep" />
            <h1 className="mt-4 font-display text-2xl font-bold text-ink">Confirming your payment</h1>
            <p className="mt-2 text-sm text-body">
              A moment — we are waiting for Razorpay to confirm. Do not pay again.
            </p>
          </>
        )}

        <Link
          href="/account/orders"
          className="mt-6 inline-block text-sm font-semibold text-violet-deep"
        >
          See all my orders
        </Link>
      </div>
    </Container>
  )
}
