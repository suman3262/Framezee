import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  validateCustomSize,
  outerSizeTenths,
  areaSqIn,
  toTenths,
  fromTenths,
} from './custom-frame.ts'

test('the design\'s own example: 12 x 16 in is 192 sq in', () => {
  assert.equal(areaSqIn(120, 160), 192)
})

test('a 1 inch moulding around 12 x 16 in measures 13.6 x 17.6 in', () => {
  // The figure printed under the basket button in Figma 3:1391.
  assert.deepEqual(outerSizeTenths(120, 160, 10), { widthTenths: 136, heightTenths: 176 })
})

test('a thinner moulding adds less to the outer size', () => {
  assert.deepEqual(outerSizeTenths(120, 160, 5), { widthTenths: 128, heightTenths: 168 })
})

test('sizes inside 4 x 4 to 40 x 60 in are accepted, either way round', () => {
  for (const [w, h] of [
    [40, 40], // the minimum
    [120, 160],
    [400, 600], // 40 x 60
    [600, 400], // and rotated
    [300, 450],
  ]) {
    assert.equal(validateCustomSize(w, h).ok, true, `${w}x${h}`)
  }
})

test('a side under 4 in is refused, naming the field that is wrong', () => {
  const tooNarrow = validateCustomSize(30, 160)
  assert.equal(tooNarrow.ok, false)
  assert.equal(tooNarrow.ok === false && tooNarrow.field, 'width')
  assert.equal(tooNarrow.ok === false && tooNarrow.message, 'Width must be at least 4 in.')

  const tooShort = validateCustomSize(120, 10)
  assert.equal(tooShort.ok === false && tooShort.field, 'height')
})

test('the long side is capped at 60 in and the short side at 40 in', () => {
  const tooLong = validateCustomSize(120, 700)
  assert.equal(tooLong.ok === false && tooLong.message, 'The longer side can be at most 60 in.')

  // 50 x 60 is inside the long-side cap but its short side is over 40 in
  const tooWide = validateCustomSize(500, 600)
  assert.equal(tooWide.ok === false && tooWide.message, 'The shorter side can be at most 40 in.')
})

test('centimetres convert to tenths of an inch and back', () => {
  assert.equal(toTenths(12, 'in'), 120)
  assert.equal(toTenths(30.48, 'cm'), 120) // 30.48 cm is exactly 12 in
  assert.equal(fromTenths(120, 'in'), 12)
  assert.equal(fromTenths(120, 'cm'), 30.5)
})

test('switching units does not drift the size', () => {
  // A customer toggling in -> cm -> in must land back on the same frame.
  for (const tenths of [40, 120, 175, 400, 600]) {
    const asCm = fromTenths(tenths, 'cm')
    assert.ok(Math.abs(toTenths(asCm, 'cm') - tenths) <= 1, `${tenths} drifted`)
  }
})
