import { test } from 'node:test'
import assert from 'node:assert/strict'
import { applyCoupon, discountFor, type Coupon, type CouponContext } from './coupons.ts'
import { calcTax } from './tax.ts'

/** The three coupons from db/seed-data.ts — the two on the mockup's top bar, plus welcome. */
const FRAMES: Coupon = {
  code: 'FRAME5',
  type: 'percent',
  value: 500, // 5%
  minOrderPaise: 20_000, // Rs 200
  maxDiscountPaise: null,
  newCustomersOnly: false,
  active: true,
}

const FRAME10: Coupon = {
  code: 'FRAME10',
  type: 'percent',
  value: 1000, // 10%
  minOrderPaise: 50_000, // Rs 500
  maxDiscountPaise: 75_000, // capped at Rs 750
  newCustomersOnly: false,
  active: true,
}

const NEW15: Coupon = {
  code: 'NEW15',
  type: 'percent',
  value: 1500, // 15%
  minOrderPaise: 0,
  maxDiscountPaise: 50_000,
  newCustomersOnly: true,
  active: true,
}

const returning: CouponContext = { subtotalPaise: 100_000, customerOrderCount: 3 }
const firstTime: CouponContext = { subtotalPaise: 100_000, customerOrderCount: 0 }

const ok = (r: ReturnType<typeof applyCoupon>) => {
  assert.equal(r.ok, true, r.ok ? '' : `rejected: ${r.reason}`)
  return r as Extract<typeof r, { ok: true }>
}

test('FRAME5 takes 5% off an order over Rs 200', () => {
  assert.equal(ok(applyCoupon(FRAMES, returning)).discountPaise, 5_000) // Rs 50 off Rs 1,000
})

test('FRAME10 takes 10% off an order over Rs 500', () => {
  assert.equal(ok(applyCoupon(FRAME10, returning)).discountPaise, 10_000) // Rs 100 off Rs 1,000
})

test('the cap holds on a big order', () => {
  // 10% of Rs 20,000 would be Rs 2,000 — capped at Rs 750
  const r = ok(applyCoupon(FRAME10, { ...returning, subtotalPaise: 2_000_000 }))
  assert.equal(r.discountPaise, 75_000)
  assert.equal(r.cappedAtMax, true)
})

test('below the minimum, the customer is told exactly how much more to add', () => {
  const r = applyCoupon(FRAME10, { ...returning, subtotalPaise: 42_500 }) // Rs 425
  assert.equal(r.ok, false)
  assert.equal(r.ok === false && r.reason, 'below_min_order')
  assert.equal(r.ok === false && r.message, 'Add ₹75 more to use FRAME10.')
})

test('a new-customer coupon works on a first order and not after', () => {
  assert.equal(ok(applyCoupon(NEW15, firstTime)).discountPaise, 15_000) // Rs 150
  const r = applyCoupon(NEW15, returning)
  assert.equal(r.ok, false)
  assert.equal(r.ok === false && r.reason, 'new_customers_only')
})

test('a flat coupon takes off its face value', () => {
  const flat: Coupon = { ...FRAMES, code: 'FLAT100', type: 'flat', value: 10_000 }
  assert.equal(ok(applyCoupon(flat, returning)).discountPaise, 10_000) // Rs 100
})

test('a discount can never exceed the order — no negative totals', () => {
  const huge: Coupon = { ...FRAMES, code: 'FLAT5000', type: 'flat', value: 500_000, minOrderPaise: 0 }
  const r = ok(applyCoupon(huge, { ...returning, subtotalPaise: 30_000 }))
  assert.equal(r.discountPaise, 30_000) // Rs 300 order, Rs 300 off, not Rs 5,000
})

test('an unknown or switched-off code is rejected with a sentence, not an exception', () => {
  const unknown = applyCoupon(null, returning)
  assert.equal(unknown.ok, false)
  assert.equal(unknown.ok === false && unknown.reason, 'unknown_code')

  const off = applyCoupon({ ...FRAMES, active: false }, returning)
  assert.equal(off.ok === false && off.reason, 'inactive')
})

test('the validity window is respected at both ends', () => {
  const window: Coupon = {
    ...FRAMES,
    startsAt: new Date('2026-10-01T00:00:00Z'),
    endsAt: new Date('2026-10-31T23:59:59Z'),
  }
  const at = (iso: string) => {
    const r = applyCoupon(window, { ...returning, now: new Date(iso) })
    return r.ok ? 'ok' : r.reason
  }

  assert.equal(at('2026-09-30T12:00:00Z'), 'not_started')
  assert.equal(at('2026-10-15T12:00:00Z'), 'ok')
  assert.equal(at('2026-11-01T12:00:00Z'), 'expired')
})

test('a limited-run coupon stops once it is fully claimed', () => {
  const limited: Coupon = { ...FRAMES, usageLimit: 100, usedCount: 99 }
  assert.equal(applyCoupon(limited, returning).ok, true)
  assert.equal(applyCoupon({ ...limited, usedCount: 100 }, returning).ok, false)
})

test('percent discounts round to a whole paisa', () => {
  // 5% of Rs 333.33 = Rs 16.6665 -> Rs 16.67
  assert.equal(discountFor(FRAMES, 33_333).discountPaise, 1_667)
})

test('the discount feeds tax cleanly — subtotal, coupon and GST agree', () => {
  const subtotalPaise = 100_000
  const d = ok(applyCoupon(FRAME10, { subtotalPaise, customerOrderCount: 2 }))

  const t = calcTax({
    lines: [{ linePaise: subtotalPaise, gstRateBp: 1200 }],
    discountPaise: d.discountPaise,
    shippingPaise: 7_900,
    sellerState: 'West Bengal',
    shipToState: 'West Bengal',
    gstEnabled: true,
  })

  assert.equal(t.totalPaise, 100_000 - 10_000 + 7_900) // Rs 979
  assert.equal(t.netPaise + t.totalTaxPaise, t.totalPaise)
  assert.equal(t.cgstPaise + t.sgstPaise, t.totalTaxPaise)
})
