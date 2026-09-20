import { test } from 'node:test'
import assert from 'node:assert/strict'
import { calcTax, apportion, extractTax, TaxError, type TaxInput } from './tax.ts'

const base = {
  sellerState: 'West Bengal',
  shipToState: 'West Bengal',
  gstEnabled: true,
} satisfies Omit<TaxInput, 'lines'>

const wood = (linePaise: number) => ({ linePaise, gstRateBp: 1200 }) // 12%
const metal = (linePaise: number) => ({ linePaise, gstRateBp: 1800 }) // 18%

test('tax is worked backwards out of the price, not added on top', () => {
  // Rs 154 inclusive @ 12% -> net Rs 137.50 + GST Rs 16.50
  const { netPaise, taxPaise } = extractTax(15_400, 1200)
  assert.equal(netPaise, 13_750)
  assert.equal(taxPaise, 1_650)
  assert.equal(netPaise + taxPaise, 15_400)
})

test('net plus tax equals the price exactly, at every rate and amount', () => {
  for (const gross of [1, 7, 99, 15_400, 96_873, 1_234_567]) {
    for (const rate of [0, 500, 1200, 1800, 2800]) {
      const { netPaise, taxPaise } = extractTax(gross, rate)
      assert.equal(netPaise + taxPaise, gross, `${gross} @ ${rate}bp`)
    }
  }
})

test('the customer total is the listed price — GST changes nothing', () => {
  const lines = [wood(100_000)]
  const off = calcTax({ ...base, lines, gstEnabled: false })
  const on = calcTax({ ...base, lines, gstEnabled: true })
  assert.equal(off.totalPaise, 100_000)
  assert.equal(on.totalPaise, 100_000) // identical — only the breakdown appears
  assert.equal(on.netPaise, 89_286)
  assert.equal(on.totalTaxPaise, 10_714)
})

test('within West Bengal the tax splits into equal CGST and SGST', () => {
  const r = calcTax({ ...base, lines: [wood(112_000)] })
  assert.equal(r.intraState, true)
  assert.equal(r.totalTaxPaise, 12_000) // Rs 1,120 inclusive holds Rs 120 of GST
  assert.equal(r.netPaise, 100_000)
  assert.equal(r.cgstPaise, 6_000)
  assert.equal(r.sgstPaise, 6_000)
  assert.equal(r.igstPaise, 0)
})

test('outside West Bengal the same tax becomes IGST', () => {
  const r = calcTax({ ...base, shipToState: 'Maharashtra', lines: [wood(112_000)] })
  assert.equal(r.intraState, false)
  assert.equal(r.igstPaise, 12_000)
  assert.equal(r.cgstPaise, 0)
  assert.equal(r.sgstPaise, 0)
  assert.equal(r.totalPaise, 112_000) // customer pays the same either way
})

test('CGST and SGST always sum to the total tax, even on an odd paisa', () => {
  const r = calcTax({ ...base, lines: [{ linePaise: 12_345, gstRateBp: 1200 }] })
  assert.equal(r.cgstPaise + r.sgstPaise, r.totalTaxPaise)
  assert.equal(r.totalTaxPaise % 2, 1) // genuinely odd, so the guard is doing work
})

test('state matching ignores case and stray spacing', () => {
  assert.equal(calcTax({ ...base, shipToState: '  west   bengal ', lines: [wood(100_000)] }).intraState, true)
})

test('discount comes off before the tax is extracted', () => {
  const r = calcTax({ ...base, lines: [wood(100_000)], discountPaise: 20_000 })
  assert.equal(r.totalPaise, 80_000) // exactly what the customer expects to pay
  assert.equal(r.netPaise + r.totalTaxPaise, 80_000)
  assert.equal(r.totalTaxPaise, 8_571) // the GST inside Rs 800, not inside Rs 1,000
})

test('shipping carries the tax rate of the goods it ships', () => {
  const r = calcTax({ ...base, lines: [wood(100_000)], shippingPaise: 7_900 })
  assert.equal(r.totalPaise, 107_900)
  assert.equal(r.netPaise + r.totalTaxPaise, 107_900)
})

test('each line is taxed at its own rate', () => {
  const r = calcTax({ ...base, lines: [wood(112_000), metal(118_000)] })
  assert.equal(r.lines[0].taxPaise, 12_000) // 12% inside Rs 1,120
  assert.equal(r.lines[1].taxPaise, 18_000) // 18% inside Rs 1,180
  assert.equal(r.totalTaxPaise, 30_000)
})

test('discount and shipping spread across lines by value, not evenly', () => {
  const r = calcTax({
    ...base,
    lines: [wood(75_000), wood(25_000)], // 3:1
    discountPaise: 10_000,
    shippingPaise: 8_000,
  })
  assert.deepEqual(
    r.lines.map((l) => l.discountSharePaise),
    [7_500, 2_500],
  )
  assert.deepEqual(
    r.lines.map((l) => l.shippingSharePaise),
    [6_000, 2_000],
  )
})

test('the parts always add up to the whole — no lost paisa', () => {
  // 3 lines, mixed rates, a discount that does not divide evenly by 3
  const r = calcTax({
    ...base,
    lines: [wood(33_333), metal(33_333), wood(33_334)],
    discountPaise: 10_000,
    shippingPaise: 7_900,
  })
  assert.equal(
    r.lines.reduce((a, l) => a + l.discountSharePaise, 0),
    10_000,
  )
  assert.equal(
    r.lines.reduce((a, l) => a + l.shippingSharePaise, 0),
    7_900,
  )
  assert.equal(r.totalPaise, r.subtotalPaise - r.discountPaise + r.shippingPaise)
  assert.equal(r.netPaise + r.totalTaxPaise, r.totalPaise)
  assert.equal(r.cgstPaise + r.sgstPaise + r.igstPaise, r.totalTaxPaise)
})

test('apportion never loses or invents a paisa', () => {
  for (const total of [1, 7, 99, 10_000, 12_345]) {
    for (const weights of [[1, 1, 1], [3, 1], [5, 5, 5, 5, 5, 5, 5], [1]]) {
      const shares = apportion(total, weights)
      assert.equal(
        shares.reduce((a, b) => a + b, 0),
        total,
        `total ${total} across ${weights.length} lines`,
      )
      assert.ok(shares.every(Number.isInteger))
    }
  }
})

test('before GST registration the switch is off and no tax is shown', () => {
  const r = calcTax({ ...base, gstEnabled: false, lines: [wood(100_000)], shippingPaise: 7_900 })
  assert.equal(r.totalTaxPaise, 0)
  assert.equal(r.cgstPaise, 0)
  assert.equal(r.sgstPaise, 0)
  assert.equal(r.netPaise, 107_900) // the whole amount is untaxed value
  assert.equal(r.totalPaise, 107_900)
})

test('nonsense is rejected rather than producing a negative invoice', () => {
  assert.throws(() => calcTax({ ...base, lines: [] }), TaxError)
  assert.throws(() => calcTax({ ...base, lines: [wood(10_000)], discountPaise: 20_000 }), TaxError)
  assert.throws(() => calcTax({ ...base, lines: [wood(10_000)], shippingPaise: -1 }), TaxError)
})
