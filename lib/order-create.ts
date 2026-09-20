/**
 * Writes a basket into an order. The moment money stops moving.
 *
 * Kept apart from lib/orders.ts so that file stays pure and testable without a database.
 * When the Razorpay webhook lands it calls this and nothing else — the webhook decides
 * *whether* an order exists, this decides *what* it says.
 *
 * Everything happens in one transaction: an order with no items, or a coupon marked used
 * against an order that never got written, would both be worse than a failed checkout.
 */

import { eq, sql } from 'drizzle-orm'
import { db } from '../db/index.ts'
import {
  addresses,
  cartItems,
  carts,
  couponRedemptions,
  coupons,
  orderItems,
  orders,
  payments,
} from '../db/schema.ts'
import { loadBasket } from './basket.ts'
import { buildOrderDraft, OrderError } from './orders.ts'

export type CreateOrderInput = {
  userId: string
  addressId: string
  paymentMethod: 'razorpay' | 'cod'
  /** Razorpay's ids, once a payment is confirmed. Absent for COD and for demo data. */
  payment?: {
    razorpayOrderId: string
    razorpayPaymentId: string
    signature: string
  }
}

export async function createOrderFromCart(input: CreateOrderInput) {
  const [{ count: placed }] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(orders)
    .where(eq(orders.userId, input.userId))

  const basket = await loadBasket(input.userId, placed)
  if (basket.lines.length === 0) throw new OrderError('Your basket is empty.')

  const unpriceable = basket.lines.find((l) => l.error !== null)
  if (unpriceable) throw new OrderError(unpriceable.error!)

  const [address] = await db.select().from(addresses).where(eq(addresses.id, input.addressId)).limit(1)
  if (!address || address.userId !== input.userId) throw new OrderError('That address is not yours.')
  if (!basket.settings) throw new OrderError('Store settings are missing.')

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
    paymentMethod: input.paymentMethod,
  })

  return db.transaction(async (tx) => {
    const [order] = await tx
      .insert(orders)
      .values({
        orderNo: draft.orderNo,
        userId: input.userId,
        status: 'paid',
        paymentMethod: input.paymentMethod,
        address: {
          name: address.name,
          phone: address.phone,
          line1: address.line1,
          line2: address.line2,
          city: address.city,
          state: address.state,
          pincode: address.pincode,
        },
        subtotalPaise: draft.subtotalPaise,
        couponCode: draft.couponCode,
        couponDiscountPaise: draft.couponDiscountPaise,
        shippingPaise: draft.shippingPaise,
        cgstPaise: draft.tax.cgstPaise,
        sgstPaise: draft.tax.sgstPaise,
        igstPaise: draft.tax.igstPaise,
        totalPaise: draft.totalPaise,
        sellerGstin: basket.settings!.sellerGstin,
      })
      .returning()

    await tx.insert(orderItems).values(
      draft.items.map((i) => ({
        orderId: order.id,
        kind: i.kind,
        title: i.title,
        widthTenths: i.widthTenths,
        heightTenths: i.heightTenths,
        materialName: i.materialName,
        paperName: i.paperName,
        glazingName: i.glazingName,
        matColour: i.matColour,
        matBoard: i.matBoard,
        thicknessTenths: i.thicknessTenths,
        printService: i.printService,
        qty: i.qty,
        unitPricePaise: i.unitPricePaise,
        linePaise: i.linePaise,
        priceBreakdown: i.breakdown,
        hsnCode: i.hsnCode,
        gstRateBp: i.gstRateBp,
        printImagePath: i.printImagePath,
      })),
    )

    if (input.payment) {
      await tx.insert(payments).values({
        orderId: order.id,
        provider: 'razorpay',
        razorpayOrderId: input.payment.razorpayOrderId,
        razorpayPaymentId: input.payment.razorpayPaymentId,
        signature: input.payment.signature,
        amountPaise: draft.totalPaise,
        status: 'captured',
      })
    }

    // Only record a redemption for a coupon that actually came off the total.
    if (draft.couponCode && draft.couponDiscountPaise > 0) {
      const [coupon] = await tx.select().from(coupons).where(eq(coupons.code, draft.couponCode)).limit(1)
      if (coupon) {
        await tx.insert(couponRedemptions).values({
          couponId: coupon.id,
          userId: input.userId,
          orderId: order.id,
        })
        await tx
          .update(coupons)
          .set({ usedCount: sql`${coupons.usedCount} + 1` })
          .where(eq(coupons.id, coupon.id))
      }
    }

    // The basket is emptied inside the same transaction, so a customer cannot pay once
    // and still have the items sitting there.
    if (basket.cartId) {
      await tx.delete(cartItems).where(eq(cartItems.cartId, basket.cartId))
      await tx.update(carts).set({ couponCode: null }).where(eq(carts.id, basket.cartId))
    }

    return order
  })
}
