import { test } from 'node:test'
import assert from 'node:assert/strict'
import { priceLine, priceFrom, PriceError, fmtInr, type LineInput } from './pricing.ts'

const teak: LineInput['material'] = {
  name: 'Teak Wood',
  limits: { minWidthTenths: 40, maxWidthTenths: 600, minHeightTenths: 40, maxHeightTenths: 600 },
  bands: [{ maxWidthTenths: 1000, maxHeightTenths: 1000, ratePaisePerSqIn: 400 }], // under 100x100 -> Rs 4
}

const paperA = {
  name: 'A quality',
  bands: [{ maxWidthTenths: 1000, maxHeightTenths: 1000, ratePaisePerSqIn: 200 }], // Rs 2
}

const line = (w: number, h: number, extra: Partial<LineInput> = {}) =>
  priceLine({ widthTenths: w, heightTenths: h, qty: 1, material: teak, ...extra })

test('area x rate — the worked example from ARCHITECTURE.md', () => {
  // 40 x 60 in = 2,400 sq-in @ Rs 4 = Rs 9,600
  assert.equal(line(400, 600).framePaise, 960_000)
  assert.equal(fmtInr(line(400, 600).framePaise), '₹9,600.00')
})

test('band dimensions select the rate, they never multiply', () => {
  // A 7x5 in frame in the same "under 100x100" band is 35 sq-in, not 10,000
  assert.equal(line(70, 50).unitPaise, 14_000) // Rs 140
})

test('print service charges the same area against the paper rate', () => {
  const b = line(400, 600, { paper: paperA })
  assert.equal(b.framePaise, 960_000) // Rs 9,600
  assert.equal(b.printPaise, 480_000) // Rs 4,800
  assert.equal(b.unitPaise, 1_440_000) // Rs 14,400
})

test('no paper chosen means no print charge', () => {
  const b = line(400, 600)
  assert.equal(b.printPaise, 0)
  assert.equal(b.paperName, null)
})

test('smallest fitting band wins, whatever order they were entered in', () => {
  const tiered = {
    ...teak,
    bands: [
      { maxWidthTenths: 1000, maxHeightTenths: 1000, ratePaisePerSqIn: 400 }, // Rs 4
      { maxWidthTenths: 100, maxHeightTenths: 100, ratePaisePerSqIn: 690 }, // Rs 6.90 under 10x10
    ],
  }
  // 4x4 in square -> 16 sq-in @ Rs 6.90 = Rs 110.40
  assert.equal(priceLine({ widthTenths: 40, heightTenths: 40, qty: 1, material: tiered }).unitPaise, 11_040)
  // 40x60 falls through to the Rs 4 band
  assert.equal(priceLine({ widthTenths: 400, heightTenths: 600, qty: 1, material: tiered }).frameRatePaise, 400)
})

test('a rotated frame fits a rotated band', () => {
  const portraitBand = { ...teak, bands: [{ maxWidthTenths: 300, maxHeightTenths: 600, ratePaisePerSqIn: 400 }] }
  // 50x25 in must fit a 30x60 in band — long side to long side
  assert.equal(priceLine({ widthTenths: 500, heightTenths: 250, qty: 1, material: portraitBand }).framePaise, 500_000)
})

test('quantity multiplies the unit price, not the rounding', () => {
  const b = line(70, 50, { qty: 3 })
  assert.equal(b.unitPaise, 14_000)
  assert.equal(b.linePaise, 42_000)
})

test('sizes outside the material range are rejected, not silently clamped', () => {
  assert.throws(() => line(700, 400), PriceError) // 70 in wide, max is 60
  assert.throws(() => line(20, 400), PriceError) // 2 in wide, min is 4
})

test('a size no band covers is rejected rather than priced at zero', () => {
  const narrow = { ...teak, bands: [{ maxWidthTenths: 100, maxHeightTenths: 100, ratePaisePerSqIn: 400 }] }
  assert.throws(() => priceLine({ widthTenths: 400, heightTenths: 600, qty: 1, material: narrow }), PriceError)
})

test('junk input is rejected', () => {
  assert.throws(() => line(0, 400), PriceError)
  assert.throws(() => line(405.5, 400), PriceError)
  assert.throws(() => line(400, 600, { qty: 0 }), PriceError)
})

test('money stays exact at a fractional rate', () => {
  const odd = { ...teak, bands: [{ maxWidthTenths: 1000, maxHeightTenths: 1000, ratePaisePerSqIn: 437 }] }
  // 8x6 in = 48 sq-in @ Rs 4.37 = Rs 209.76
  assert.equal(priceLine({ widthTenths: 80, heightTenths: 60, qty: 1, material: odd }).framePaise, 20_976)
})

test('"from Rs x" is the cheapest makeable size, skipping ones this material cannot make', () => {
  const sizes = [
    { widthTenths: 70, heightTenths: 50 }, // 35 sq-in -> Rs 140
    { widthTenths: 400, heightTenths: 600 }, // Rs 9,600
    { widthTenths: 900, heightTenths: 900 }, // outside the material limits — skipped
  ]
  assert.equal(priceFrom(sizes, teak), 14_000)
  assert.equal(priceFrom([{ widthTenths: 900, heightTenths: 900 }], teak), null)
})

test('upgraded glazing is charged on the same area, standard glazing is free', () => {
  const uvAcrylic = {
    name: 'UV acrylic, 99% filtration',
    bands: [{ maxWidthTenths: 600, maxHeightTenths: 600, ratePaisePerSqIn: 605 }],
  }
  const styrene = { name: '3 mm styrene', bands: [] }

  // 12 x 16 in = 192 sq-in @ Rs 6.05 = Rs 1,161.60, the design's "+Rs 1,162"
  const upgraded = priceLine({ widthTenths: 120, heightTenths: 160, qty: 1, material: teak, glazing: uvAcrylic })
  assert.equal(upgraded.glazingPaise, 116_160)
  assert.equal(upgraded.glazingName, 'UV acrylic, 99% filtration')

  const included = priceLine({ widthTenths: 120, heightTenths: 160, qty: 1, material: teak, glazing: styrene })
  assert.equal(included.glazingPaise, 0)
  assert.equal(included.glazingName, '3 mm styrene') // still named on the invoice
  assert.equal(included.unitPaise, upgraded.unitPaise - 116_160)
})

test('frame, print and glazing all add into the unit price', () => {
  const b = priceLine({
    widthTenths: 120,
    heightTenths: 160,
    qty: 2,
    material: teak,
    paper: paperA,
    glazing: { name: 'UV', bands: [{ maxWidthTenths: 600, maxHeightTenths: 600, ratePaisePerSqIn: 605 }] },
  })
  assert.equal(b.unitPaise, b.framePaise + b.printPaise + b.glazingPaise)
  assert.equal(b.linePaise, b.unitPaise * 2)
})

test('a mat with no rate bands is free, and still named', () => {
  const b = priceLine({
    widthTenths: 120, heightTenths: 160, qty: 1, material: teak,
    mat: { name: 'Acid-free mat board', bands: [] },
  })
  assert.equal(b.matPaise, 0)
  assert.equal(b.matName, 'Acid-free mat board')
  assert.equal(b.unitPaise, line(120, 160).unitPaise)
})

test('giving the mat a band starts charging for it everywhere', () => {
  // 12 x 16 in = 192 sq-in @ Rs 1.50 = Rs 288
  const b = priceLine({
    widthTenths: 120, heightTenths: 160, qty: 2, material: teak,
    mat: { name: 'Acid-free mat board', bands: [{ maxWidthTenths: 600, maxHeightTenths: 600, ratePaisePerSqIn: 150 }] },
  })
  assert.equal(b.matPaise, 28_800)
  assert.equal(b.unitPaise, b.framePaise + b.printPaise + b.glazingPaise + b.matPaise)
  assert.equal(b.linePaise, b.unitPaise * 2)
})

test('no mat chosen means no mat charge at all', () => {
  const b = line(120, 160)
  assert.equal(b.matPaise, 0)
  assert.equal(b.matName, null)
})
