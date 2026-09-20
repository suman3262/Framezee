/**
 * Turning a basket into an order.
 *
 * This is where money stops moving. Everything above it — the basket, the product page,
 * the studio — recomputes from the rate cards on every render. From here on the numbers
 * are a snapshot: material and paper names as text, the full breakdown as JSON, the tax
 * split as it stood. Renaming a material or changing a rate tomorrow must not alter a
 * single rupee of an order placed today.
 *
 * `buildOrderDraft` is pure so it can be tested without a database.
 */

import { applyCoupon, type Coupon } from './coupons.ts'
import { calcTax, type TaxResult } from './tax.ts'
import type { LineBreakdown } from './pricing.ts'

export type DraftLine = {
  kind: 'catalog' | 'custom'
  title: string
  widthTenths: number
  heightTenths: number
  materialName: string
  paperName: string | null
  glazingName: string | null
  matColour: string | null
  matBoard: boolean
  thicknessTenths: number
  printService: boolean
  qty: number
  gstRateBp: number
  hsnCode: string | null
  printImagePath: string | null
  breakdown: LineBreakdown
}

export type DraftInput = {
  lines: DraftLine[]
  coupon: Coupon | null
  customerOrderCount: number
  address: {
    name: string
    phone: string
    line1: string
    line2: string | null
    city: string
    state: string
    pincode: string
  }
  settings: {
    sellerState: string
    sellerGstin: string | null
    gstEnabled: boolean
    flatShippingPaise: number
    freeShippingThresholdPaise: number | null
  }
  paymentMethod: 'razorpay' | 'cod'
  now?: Date
}

export type OrderDraft = {
  orderNo: string
  subtotalPaise: number
  couponCode: string | null
  couponDiscountPaise: number
  couponRejection: string | null
  shippingPaise: number
  tax: TaxResult
  totalPaise: number
  items: Array<
    DraftLine & {
      unitPricePaise: number
      linePaise: number
    }
  >
}

export class OrderError extends Error {}

/** FZ-2FK3P9-4821 — short, unambiguous out loud, and not a guessable sequence. */
export function generateOrderNo(now = new Date(), rand = Math.random): string {
  const ALPHABET = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ' // no 0/O/1/I
  const pick = (n: number) =>
    Array.from({ length: n }, () => ALPHABET[Math.floor(rand() * ALPHABET.length)]).join('')
  const yy = String(now.getFullYear()).slice(2)
  return `FZ-${yy}${pick(4)}-${pick(4)}`
}

export function buildOrderDraft(input: DraftInput): OrderDraft {
  const { lines, settings, address } = input

  if (lines.length === 0) throw new OrderError('Your basket is empty.')
  if (lines.some((l) => l.qty < 1)) throw new OrderError('Every line needs a quantity.')

  const subtotalPaise = lines.reduce((a, l) => a + l.breakdown.linePaise, 0)

  // The coupon is re-checked here, not trusted from the basket. One that expired while
  // the customer was choosing an address simply stops applying.
  let couponDiscountPaise = 0
  let couponCode: string | null = null
  let couponRejection: string | null = null

  if (input.coupon) {
    const result = applyCoupon(input.coupon, {
      subtotalPaise,
      customerOrderCount: input.customerOrderCount,
      now: input.now,
    })
    if (result.ok) {
      couponDiscountPaise = result.discountPaise
      couponCode = result.code
    } else {
      couponRejection = result.message
    }
  }

  const afterDiscount = subtotalPaise - couponDiscountPaise
  const free =
    settings.freeShippingThresholdPaise !== null &&
    afterDiscount >= settings.freeShippingThresholdPaise
  const shippingPaise = free ? 0 : settings.flatShippingPaise

  const tax = calcTax({
    lines: lines.map((l) => ({ linePaise: l.breakdown.linePaise, gstRateBp: l.gstRateBp })),
    discountPaise: couponDiscountPaise,
    shippingPaise,
    sellerState: settings.sellerState,
    shipToState: address.state,
    gstEnabled: settings.gstEnabled,
  })

  return {
    orderNo: generateOrderNo(input.now),
    subtotalPaise,
    couponCode,
    couponDiscountPaise,
    couponRejection,
    shippingPaise,
    tax,
    totalPaise: tax.totalPaise,
    items: lines.map((l) => ({
      ...l,
      unitPricePaise: l.breakdown.unitPaise,
      linePaise: l.breakdown.linePaise,
    })),
  }
}
