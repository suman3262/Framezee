import { test } from 'node:test'
import assert from 'node:assert/strict'
import { buildOrderDraft, generateOrderNo, OrderError, type DraftLine } from './orders.ts'
import { priceLine, type LineInput } from './pricing.ts'
import type { Coupon } from './coupons.ts'

const oak: LineInput['material'] = {
  name: 'Natural Oak',
  limits: { minWidthTenths: 40, maxWidthTenths: 600, minHeightTenths: 40, maxHeightTenths: 600 },
  bands: [{ maxWidthTenths: 600, maxHeightTenths: 600, ratePaisePerSqIn: 400 }], // Rs 4
}

function line(w: number, h: number, qty = 1, gstRateBp = 1200): DraftLine {
  return {
    kind: 'catalog',
    title: 'Natural Oak 001',
    widthTenths: w,
    heightTenths: h,
    materialName: 'Natural Oak',
    paperName: null,
    glazingName: '3 mm styrene',
    matColour: null,
    matBoard: false,
    thicknessTenths: 10,
    printService: false,
    qty,
    gstRateBp,
    hsnCode: '4414',
    printImagePath: null,
    breakdown: priceLine({ widthTenths: w, heightTenths: h, qty, material: oak }),
  }
}

const address = {
  name: 'Suman Dutta',
  phone: '+919876543210',
  line1: '12/A College Road',
  line2: null,
  city: 'Krishnagar',
  state: 'West Bengal',
  pincode: '741101',
}

const settings = {
  sellerState: 'West Bengal',
  sellerGstin: null,
  gstEnabled: true,
  flatShippingPaise: 7_900,
  freeShippingThresholdPaise: 149_900,
}

const base = { address, settings, coupon: null, customerOrderCount: 2, paymentMethod: 'razorpay' as const }

test('the draft totals what the basket showed', () => {
  // 7 x 5 in = 35 sq-in @ Rs 4 = Rs 140, twice = Rs 280
  const d = buildOrderDraft({ ...base, lines: [line(70, 50, 2)] })
  assert.equal(d.subtotalPaise, 28_000)
  assert.equal(d.shippingPaise, 7_900)
  assert.equal(d.totalPaise, 28_000 + 7_900)
})

test('every line carries its own frozen breakdown', () => {
  const d = buildOrderDraft({ ...base, lines: [line(70, 50), line(120, 160)] })
  assert.equal(d.items.length, 2)
  assert.equal(d.items[0].unitPricePaise, 14_000)
  assert.equal(d.items[1].unitPricePaise, 76_800) // 192 sq-in @ Rs 4
  // Names are text on the order, never a lookup back into the live tables.
  assert.equal(d.items[0].materialName, 'Natural Oak')
  assert.equal(d.items[0].glazingName, '3 mm styrene')
})

test('a valid coupon comes off, and the order records what was actually given', () => {
  const coupon: Coupon = {
    code: 'FRAME10',
    type: 'percent',
    value: 1000,
    minOrderPaise: 50_000,
    maxDiscountPaise: 75_000,
    newCustomersOnly: false,
    active: true,
  }
  const d = buildOrderDraft({ ...base, coupon, lines: [line(120, 160)] }) // Rs 768
  assert.equal(d.couponCode, 'FRAME10')
  assert.equal(d.couponDiscountPaise, 7_680) // 10% of Rs 768
  assert.equal(d.couponRejection, null)
  assert.equal(d.totalPaise, 76_800 - 7_680 + 7_900)
})

test('a coupon that stopped applying is dropped, not silently honoured', () => {
  const expired: Coupon = {
    code: 'FRAME10',
    type: 'percent',
    value: 1000,
    minOrderPaise: 0,
    maxDiscountPaise: null,
    newCustomersOnly: false,
    active: true,
    endsAt: new Date('2020-01-01'),
  }
  const d = buildOrderDraft({ ...base, coupon: expired, lines: [line(120, 160)] })
  assert.equal(d.couponDiscountPaise, 0)
  assert.equal(d.couponCode, null)
  assert.match(d.couponRejection ?? '', /expired/i)
})

test('a new-customer coupon is refused for a returning customer at checkout', () => {
  const welcome: Coupon = {
    code: 'NEW15',
    type: 'percent',
    value: 1500,
    minOrderPaise: 0,
    maxDiscountPaise: 50_000,
    newCustomersOnly: true,
    active: true,
  }
  const first = buildOrderDraft({ ...base, customerOrderCount: 0, coupon: welcome, lines: [line(120, 160)] })
  assert.equal(first.couponDiscountPaise, 11_520) // 15% of Rs 768

  const again = buildOrderDraft({ ...base, customerOrderCount: 1, coupon: welcome, lines: [line(120, 160)] })
  assert.equal(again.couponDiscountPaise, 0)
})

test('the free-shipping threshold is measured after the discount, not before', () => {
  // Rs 1,536 of goods clears Rs 1,499 on its own...
  const noCoupon = buildOrderDraft({ ...base, lines: [line(120, 160, 2)] })
  assert.equal(noCoupon.shippingPaise, 0)

  // ...but a 10% coupon drops it to Rs 1,382.40, which does not.
  const coupon: Coupon = {
    code: 'FRAME10',
    type: 'percent',
    value: 1000,
    minOrderPaise: 0,
    maxDiscountPaise: null,
    newCustomersOnly: false,
    active: true,
  }
  const withCoupon = buildOrderDraft({ ...base, coupon, lines: [line(120, 160, 2)] })
  assert.equal(withCoupon.shippingPaise, 7_900)
})

test('shipping to another state becomes IGST, and the customer pays the same', () => {
  const wb = buildOrderDraft({ ...base, lines: [line(120, 160)] })
  const mh = buildOrderDraft({
    ...base,
    address: { ...address, state: 'Maharashtra' },
    lines: [line(120, 160)],
  })
  assert.equal(wb.tax.cgstPaise + wb.tax.sgstPaise, mh.tax.igstPaise)
  assert.equal(wb.totalPaise, mh.totalPaise)
})

test('the order always reconciles: net + tax = total = subtotal - discount + shipping', () => {
  const coupon: Coupon = {
    code: 'FRAME5',
    type: 'percent',
    value: 500,
    minOrderPaise: 0,
    maxDiscountPaise: null,
    newCustomersOnly: false,
    active: true,
  }
  const d = buildOrderDraft({
    ...base,
    coupon,
    lines: [line(70, 50, 3), line(120, 160, 1, 1800)],
  })
  assert.equal(d.tax.netPaise + d.tax.totalTaxPaise, d.totalPaise)
  assert.equal(d.totalPaise, d.subtotalPaise - d.couponDiscountPaise + d.shippingPaise)
})

test('an empty basket cannot become an order', () => {
  assert.throws(() => buildOrderDraft({ ...base, lines: [] }), OrderError)
})

test('order numbers avoid characters that are misread aloud', () => {
  const no = generateOrderNo(new Date('2026-01-01'))
  assert.match(no, /^FZ-26[23456789A-HJ-NP-Z]{4}-[23456789A-HJ-NP-Z]{4}$/)
  assert.ok(!/[01OI]/.test(no.slice(3)))

  // and they do not collide in bulk
  const seen = new Set(Array.from({ length: 2000 }, () => generateOrderNo()))
  assert.ok(seen.size > 1990, `only ${seen.size} unique`)
})
