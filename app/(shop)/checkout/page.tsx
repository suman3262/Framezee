import Link from 'next/link'
import { redirect } from 'next/navigation'
import { desc, eq, sql } from 'drizzle-orm'
import { db } from '@/db/index.ts'
import { addresses, orders } from '@/db/schema.ts'
import { requireUser } from '@/lib/auth.ts'
import { loadBasket, shippingFor } from '@/lib/basket.ts'
import { buildOrderDraft } from '@/lib/orders.ts'
import { formatPhone } from '@/lib/phone.ts'
import { Container } from '@/components/home/section-heading.tsx'
import { BasketLines } from '@/components/checkout/basket-lines.tsx'
import { OrderSummary } from '@/components/checkout/summary.tsx'
import { AddAddressForm } from '@/components/auth/account-forms.tsx'
import { setDefaultAddress } from '@/app/actions/account.ts'

export default async function CheckoutPage() {
  const user = await requireUser('/checkout')

  const [{ count: placed }] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(orders)
    .where(eq(orders.userId, user.id))

  const basket = await loadBasket(user.id, placed)
  if (basket.lines.length === 0) redirect('/cart')

  const list = await db
    .select()
    .from(addresses)
    .where(eq(addresses.userId, user.id))
    .orderBy(desc(addresses.isDefault), desc(addresses.createdAt))

  const shipTo = list.find((a) => a.isDefault) ?? list[0] ?? null
  const drafts = basket.lines.filter((l) => l.draft !== null).map((l) => l.draft!)
  const blocked = basket.lines.some((l) => l.error !== null)

  // The same builder that will create the order once payment is confirmed, so the number
  // the customer agrees to here is the number that gets charged.
  const draft =
    shipTo && drafts.length > 0 && !blocked && basket.settings
      ? buildOrderDraft({
          lines: drafts,
          coupon: basket.coupon,
          customerOrderCount: placed,
          address: {
            name: shipTo.name,
            phone: shipTo.phone,
            line1: shipTo.line1,
            line2: shipTo.line2,
            city: shipTo.city,
            state: shipTo.state,
            pincode: shipTo.pincode,
          },
          settings: {
            sellerState: basket.settings.sellerState,
            sellerGstin: basket.settings.sellerGstin,
            gstEnabled: basket.settings.gstEnabled,
            flatShippingPaise: basket.settings.flatShippingPaise,
            freeShippingThresholdPaise: basket.settings.freeShippingThresholdPaise,
          },
          paymentMethod: 'razorpay',
        })
      : null

  const discountPaise = draft?.couponDiscountPaise ?? 0
  const shippingPaise =
    draft?.shippingPaise ?? shippingFor(basket.subtotalPaise, discountPaise, basket.settings)

  return (
    <Container className="py-8">
      <nav className="flex items-center gap-2 text-xs text-body">
        <Link href="/cart" className="hover:text-ink">Basket</Link>
        <span className="text-faint">›</span>
        <span className="text-ink">Checkout</span>
      </nav>

      <h1 className="mt-3 font-display text-2xl font-bold tracking-[-0.02em] text-ink sm:text-3xl">
        Checkout
      </h1>

      <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="flex flex-col gap-4">
          <section className="rounded-2xl bg-surface p-5 shadow-[0_1px_1px_rgba(0,0,0,0.05)]">
            <h2 className="text-[11px] font-bold uppercase tracking-[0.05em] text-faint">
              Deliver to
            </h2>

            {list.length === 0 ? (
              <>
                <p className="mt-2 text-sm text-body">
                  Add an address so we know where to send your frames.
                </p>
                <div className="mt-4">
                  <AddAddressForm />
                </div>
              </>
            ) : (
              <ul className="mt-3 flex flex-col gap-2">
                {list.map((a) => {
                  const on = a.id === shipTo?.id
                  return (
                    <li key={a.id}>
                      <form action={setDefaultAddress}>
                        <input type="hidden" name="id" value={a.id} />
                        <button
                          className={`flex w-full items-start gap-3 rounded-xl p-3 text-left ${
                            on ? 'bg-violet-tint ring-1 ring-violet-deep' : 'bg-subtle'
                          }`}
                        >
                          <span
                            className={`mt-[3px] grid size-4 shrink-0 place-items-center rounded-full border ${
                              on ? 'border-violet-deep' : 'border-faint'
                            }`}
                          >
                            {on && <span className="size-2 rounded-full bg-violet-deep" />}
                          </span>
                          <span className="min-w-0 text-xs leading-5 text-body">
                            <span className="block text-[13px] font-bold text-ink">{a.name}</span>
                            {formatPhone(a.phone)}
                            <br />
                            {a.line1}
                            {a.line2 ? `, ${a.line2}` : ''}
                            <br />
                            {a.city}, {a.state} – {a.pincode}
                          </span>
                        </button>
                      </form>
                    </li>
                  )
                })}
              </ul>
            )}

            {list.length > 0 && (
              <Link href="/account" className="mt-3 inline-block text-xs font-semibold text-violet-deep">
                Manage addresses
              </Link>
            )}
          </section>

          <section>
            <h2 className="mb-3 text-[11px] font-bold uppercase tracking-[0.05em] text-faint">
              {drafts.length} item{drafts.length === 1 ? '' : 's'}
            </h2>
            <BasketLines lines={basket.lines} editable={false} />
          </section>
        </div>

        <OrderSummary
          subtotalPaise={basket.subtotalPaise}
          discountPaise={discountPaise}
          couponCode={draft?.couponCode ?? null}
          shippingPaise={shippingPaise}
          tax={draft?.tax ?? null}
          totalPaise={draft?.totalPaise ?? basket.subtotalPaise - discountPaise + shippingPaise}
          freeShippingThresholdPaise={basket.settings?.freeShippingThresholdPaise ?? null}
        >
          {draft?.couponRejection && (
            <p className="mt-2 text-xs font-medium text-red-600">{draft.couponRejection}</p>
          )}

          {!shipTo ? (
            <p className="mt-4 text-xs font-medium text-body">
              Add a delivery address to continue.
            </p>
          ) : blocked ? (
            <p className="mt-4 text-xs font-medium text-red-600">
              Remove the unavailable line before paying.
            </p>
          ) : (
            <>
              <button
                disabled
                className="mt-4 w-full cursor-not-allowed rounded-full bg-accent px-6 py-3 font-display text-base font-semibold text-accent-ink opacity-60"
              >
                Pay with Razorpay
              </button>
              <p className="mt-2 text-center text-[11px] leading-4 text-faint">
                Waiting on Razorpay test keys. Everything up to this button is finished and
                verified; the order is created only once a payment webhook confirms it.
              </p>
            </>
          )}
        </OrderSummary>
      </div>
    </Container>
  )
}
