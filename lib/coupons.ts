/**
 * Coupon validation and discount. The third and final piece of the money path
 * (lib/pricing.ts prices a line, this discounts the order, lib/tax.ts splits the GST).
 *
 * The discount applies to the goods subtotal only — never to shipping.
 *
 * Returns a result instead of throwing, because "this code doesn't apply" is a normal
 * thing for a customer to do and the checkout needs a sentence to show them.
 *
 * Units are paise. Percent values are basis points: 10% -> 1000.
 */

export type Coupon = {
  code: string
  type: 'percent' | 'flat'
  value: number // percent -> basis points, flat -> paise
  minOrderPaise: number
  maxDiscountPaise: number | null
  newCustomersOnly: boolean
  startsAt?: Date | null
  endsAt?: Date | null
  usageLimit?: number | null
  usedCount?: number
  active: boolean
}

export type CouponContext = {
  subtotalPaise: number
  /** Orders this customer has already placed. 0 means new customer. */
  customerOrderCount: number
  now?: Date
}

export type CouponRejection =
  | 'unknown_code'
  | 'inactive'
  | 'not_started'
  | 'expired'
  | 'below_min_order'
  | 'new_customers_only'
  | 'usage_limit_reached'

export type CouponResult =
  | { ok: true; code: string; discountPaise: number; cappedAtMax: boolean }
  | { ok: false; reason: CouponRejection; message: string }

const rupees = (paise: number) => '₹' + Math.ceil(paise / 100).toLocaleString('en-IN')

/** The raw discount, before any eligibility check. Exported for admin previews. */
export function discountFor(coupon: Coupon, subtotalPaise: number): { discountPaise: number; cappedAtMax: boolean } {
  const raw =
    coupon.type === 'percent' ? Math.round((subtotalPaise * coupon.value) / 10_000) : coupon.value

  const capped = coupon.maxDiscountPaise !== null ? Math.min(raw, coupon.maxDiscountPaise) : raw

  // Never let a discount exceed the order — a negative total is not a refund policy.
  const discountPaise = Math.min(capped, subtotalPaise)

  return { discountPaise, cappedAtMax: coupon.maxDiscountPaise !== null && raw > coupon.maxDiscountPaise }
}

export function applyCoupon(coupon: Coupon | null | undefined, ctx: CouponContext): CouponResult {
  const now = ctx.now ?? new Date()

  if (!coupon) return { ok: false, reason: 'unknown_code', message: 'That coupon code is not valid.' }

  if (!coupon.active)
    return { ok: false, reason: 'inactive', message: `${coupon.code} is no longer available.` }

  if (coupon.startsAt && now < coupon.startsAt)
    return { ok: false, reason: 'not_started', message: `${coupon.code} is not active yet.` }

  if (coupon.endsAt && now > coupon.endsAt)
    return { ok: false, reason: 'expired', message: `${coupon.code} has expired.` }

  if (coupon.usageLimit != null && (coupon.usedCount ?? 0) >= coupon.usageLimit)
    return { ok: false, reason: 'usage_limit_reached', message: `${coupon.code} has been fully claimed.` }

  if (coupon.newCustomersOnly && ctx.customerOrderCount > 0)
    return {
      ok: false,
      reason: 'new_customers_only',
      message: `${coupon.code} is for first orders only.`,
    }

  if (ctx.subtotalPaise < coupon.minOrderPaise)
    return {
      ok: false,
      reason: 'below_min_order',
      message: `Add ${rupees(coupon.minOrderPaise - ctx.subtotalPaise)} more to use ${coupon.code}.`,
    }

  const { discountPaise, cappedAtMax } = discountFor(coupon, ctx.subtotalPaise)

  return { ok: true, code: coupon.code, discountPaise, cappedAtMax }
}
