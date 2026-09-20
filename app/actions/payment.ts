'use server'

import { eq, sql } from 'drizzle-orm'
import { db } from '@/db/index.ts'
import { addresses, orders } from '@/db/schema.ts'
import { requireUser } from '@/lib/auth.ts'
import { loadBasket } from '@/lib/basket.ts'
import { buildOrderDraft } from '@/lib/orders.ts'
import { createRazorpayOrder } from '@/lib/razorpay.ts'
import { RAZORPAY, razorpayReady } from '@/lib/env.ts'
import { BUSINESS } from '@/lib/business.ts'

export type StartPaymentResult =
  | {
      ok: true
      keyId: string
      razorpayOrderId: string
      amountPaise: number
      name: string
      description: string
      prefill: { name: string; email: string; contact: string }
    }
  | { ok: false; error: string }

/**
 * Opens a Razorpay order for the signed-in customer's basket.
 *
 * The amount is recomputed here from the rate cards. Nothing about the price comes from
 * the browser — a customer editing a hidden field is the oldest trick in e-commerce, and
 * the basket already recomputes on every load precisely so this number has one source.
 *
 * This does NOT create an order in our database. Only the webhook does that, after
 * Razorpay says the money arrived.
 */
export async function startRazorpayPayment(addressId: string): Promise<StartPaymentResult> {
  const user = await requireUser('/checkout')

  if (!razorpayReady) return { ok: false, error: 'Payments are not configured yet.' }

  const [address] = await db.select().from(addresses).where(eq(addresses.id, addressId)).limit(1)
  if (!address || address.userId !== user.id)
    return { ok: false, error: 'Choose a delivery address first.' }

  const [{ placed }] = await db
    .select({ placed: sql<number>`count(*)::int` })
    .from(orders)
    .where(eq(orders.userId, user.id))

  const basket = await loadBasket(user.id, placed)
  if (basket.lines.length === 0) return { ok: false, error: 'Your basket is empty.' }

  const unpriceable = basket.lines.find((l) => l.error !== null)
  if (unpriceable) return { ok: false, error: unpriceable.error! }

  if (!basket.settings) return { ok: false, error: 'Store settings are missing.' }

  // The same draft the checkout page shows and lib/order-create.ts will write, built
  // from the same function — so the amount charged cannot differ from the amount quoted.
  const draft = buildOrderDraft({
    lines: basket.lines.map((l) => l.draft!),
    coupon: basket.coupon,
    customerOrderCount: placed,
    address: {
      name: address.name,
      phone: address.phone,
      line1: address.line1,
      line2: address.line2,
      city: address.city,
      state: address.state,
      pincode: address.pincode,
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

  try {
    const rzp = await createRazorpayOrder({
      amountPaise: draft.totalPaise,
      receipt: `cart-${user.id.slice(0, 8)}-${Date.now()}`,
      // The webhook arrives with no session, so who this is for rides along here.
      // It is echoed back by Razorpay, not supplied by the browser.
      notes: { userId: user.id, addressId },
    })

    return {
      ok: true,
      keyId: RAZORPAY.keyId,
      razorpayOrderId: rzp.id,
      amountPaise: draft.totalPaise,
      name: BUSINESS.tradingName,
      description: `${basket.lines.length} item${basket.lines.length === 1 ? '' : 's'}`,
      prefill: {
        name: user.name ?? address.name,
        email: user.email ?? '',
        contact: user.phone ?? address.phone,
      },
    }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Could not reach Razorpay.' }
  }
}
