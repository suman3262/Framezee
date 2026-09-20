import Link from 'next/link'
import { eq, sql } from 'drizzle-orm'
import { db } from '@/db/index.ts'
import { orders } from '@/db/schema.ts'
import { requireUser } from '@/lib/auth.ts'
import { loadBasket, shippingFor } from '@/lib/basket.ts'
import { calcTax } from '@/lib/tax.ts'
import { Container } from '@/components/home/section-heading.tsx'
import { BasketLines } from '@/components/checkout/basket-lines.tsx'
import { CouponForm } from '@/components/checkout/coupon-form.tsx'
import { fmtInr, fmtInrRupees } from '@/lib/pricing.ts'

export default async function CartPage() {
  const user = await requireUser('/cart')

  const [{ count: placed }] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(orders)
    .where(eq(orders.userId, user.id))

  const basket = await loadBasket(user.id, placed)
  const priced = basket.lines.filter((l) => l.breakdown !== null)

  const discountPaise = basket.couponResult?.ok ? basket.couponResult.discountPaise : 0
  const shippingPaise = shippingFor(basket.subtotalPaise, discountPaise, basket.settings)

  const tax =
    priced.length > 0
      ? calcTax({
          lines: priced.map((l) => ({
            linePaise: l.breakdown!.linePaise,
            gstRateBp: l.draft?.gstRateBp ?? 0,
          })),
          discountPaise,
          shippingPaise,
          sellerState: basket.settings?.sellerState ?? 'West Bengal',
          shipToState: basket.settings?.sellerState ?? 'West Bengal',
          gstEnabled: basket.settings?.gstEnabled ?? false,
        })
      : null

  const totalPaise = tax ? tax.totalPaise : basket.subtotalPaise - discountPaise + shippingPaise
  const blocked = basket.lines.some((l) => l.error !== null)
  const frames = basket.lines.reduce((a, l) => a + l.display.qty, 0)

  return (
    <Container className="py-6 pb-28 md:pb-10">
      <nav className="flex items-center justify-between gap-3 text-xs text-body">
        <span className="flex items-center gap-2">
          <Link href="/browse" className="hover:text-ink">Home</Link>
          <span className="text-faint">/</span>
          <span className="text-ink">Basket</span>
        </span>
        <Link href="/browse" className="font-semibold text-violet-deep">
          Continue shopping →
        </Link>
      </nav>

      <h1 className="mt-3 font-display text-2xl font-bold tracking-[-0.02em] text-ink sm:text-3xl">
        Your basket
      </h1>
      <p className="mt-1 text-xs text-body">
        {frames} frame{frames === 1 ? '' : 's'}
        {shippingPaise === 0 && frames > 0 ? ' · Free flat-pack delivery included.' : ''}
      </p>

      {basket.lines.length === 0 ? (
        <p className="mt-6 text-sm text-body">
          Nothing in here yet.{' '}
          <Link href="/browse" className="font-semibold text-violet-deep">Browse frames</Link> or{' '}
          <Link href="/custom" className="font-semibold text-violet-deep">build your own</Link>.
        </p>
      ) : (
        <div className="mt-5 grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
          <div className="flex flex-col gap-4">
            <BasketLines lines={basket.lines} />
            <p className="px-1 text-xs text-faint">Have a coupon code? Enter it below.</p>
          </div>

          <div className="flex flex-col gap-4">
            <aside className="rounded-2xl bg-surface p-5 shadow-[0_1px_1px_rgba(0,0,0,0.05)]">
              <h2 className="font-display text-base font-bold text-ink">Order summary</h2>

              <dl className="mt-3 flex flex-col gap-2 text-[13px]">
                <Row label="Subtotal" value={fmtInr(basket.subtotalPaise)} />
                <Row
                  label="Discount"
                  value={discountPaise > 0 ? `−${fmtInr(discountPaise)}` : '—'}
                  good={discountPaise > 0}
                />
                <Row label="Delivery" value={shippingPaise === 0 ? 'Free' : fmtInr(shippingPaise)} />
              </dl>

              <div className="mt-3 flex items-baseline justify-between border-t border-line pt-3">
                <span className="text-sm font-bold text-ink">Total</span>
                <span className="text-right">
                  <span className="block font-display text-xl font-extrabold text-ink">
                    {fmtInr(totalPaise)}
                  </span>
                  {basket.settings?.gstEnabled && (
                    <span className="block text-[10px] text-faint">Inclusive of GST</span>
                  )}
                </span>
              </div>

              <div className="mt-4">
                <CouponForm
                  applied={basket.couponResult?.ok ? basket.couponResult.code : null}
                  discountPaise={discountPaise}
                  rejection={
                    basket.couponResult && !basket.couponResult.ok ? basket.couponResult.message : null
                  }
                />
                <p className="mt-2 text-[11px] text-faint">
                  Suggested codes: <span className="font-semibold text-body">FRAME10</span> or{' '}
                  <span className="font-semibold text-body">FRAME5</span>
                </p>
              </div>

              {blocked ? (
                <p className="mt-4 text-xs font-medium text-red-600">
                  Remove the unavailable line before checking out.
                </p>
              ) : (
                <>
                  <Link
                    href="/checkout"
                    className="mt-4 block rounded-full bg-accent px-6 py-3 text-center font-display text-base font-semibold text-accent-ink shadow-[0_4px_6px_rgba(255,195,41,0.35)]"
                  >
                    Checkout — {fmtInrRupees(totalPaise)}
                  </Link>
                  <p className="mt-2 text-center text-[11px] text-faint">
                    Prototype checkout — no card is charged yet.
                  </p>
                </>
              )}
            </aside>

            <aside className="rounded-2xl bg-violet-tint/50 p-5 text-center">
              <span className="mx-auto grid size-8 place-items-center rounded-full bg-violet-tint text-violet-ink">
                +
              </span>
              <h2 className="mt-2 text-sm font-bold text-ink">Something missing?</h2>
              <p className="mt-1 text-xs leading-4 text-body">
                Any size we don&rsquo;t stock can be cut to order — same mouldings, same glazing.
              </p>
              <Link
                href="/custom"
                className="mt-3 inline-block rounded-full bg-accent px-4 py-2 text-xs font-bold text-accent-ink"
              >
                Build a custom frame
              </Link>
            </aside>
          </div>
        </div>
      )}

      {/* Sticky total on phones, as the mobile design shows */}
      {basket.lines.length > 0 && !blocked && (
        <div className="fixed inset-x-0 bottom-[57px] z-30 flex items-center justify-between gap-3 border-t border-line bg-page/95 px-4 py-3 backdrop-blur-[12px] md:hidden">
          <span>
            <span className="block text-[10px] font-bold uppercase tracking-[0.05em] text-faint">
              Total amount
            </span>
            <span className="font-display text-base font-extrabold text-ink">
              {fmtInr(totalPaise)}
              {shippingPaise === 0 && (
                <span className="ml-1 text-[10px] font-normal text-violet-ink">Free del.</span>
              )}
            </span>
          </span>
          <Link
            href="/checkout"
            className="rounded-full bg-accent px-5 py-[10px] text-sm font-bold text-accent-ink"
          >
            Checkout — {fmtInrRupees(totalPaise)} →
          </Link>
        </div>
      )}
    </Container>
  )
}

function Row({ label, value, good }: { label: string; value: string; good?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <dt className="text-body">{label}</dt>
      <dd className={good ? 'font-semibold text-violet-ink' : 'font-medium text-ink'}>{value}</dd>
    </div>
  )
}
