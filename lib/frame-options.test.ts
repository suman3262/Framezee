import { test } from 'node:test'
import assert from 'node:assert/strict'
import { shapeOf, thicknessAvailable, resolveThickness, thicknessNote, type Thickness } from './frame-options.ts'

const half: Thickness = { tenths: 5, label: '1/2 inch', maxLongTenths: 120, maxShortTenths: 80 }
const one: Thickness = { tenths: 10, label: '1 inch', maxLongTenths: null, maxShortTenths: null }
const list = [half, one]

test('shape is derived from the size, never stored', () => {
  assert.equal(shapeOf(70, 50), 'horizontal')
  assert.equal(shapeOf(50, 70), 'vertical')
  assert.equal(shapeOf(80, 80), 'square')
})

test('the half-inch rule from the design still holds', () => {
  assert.equal(thicknessAvailable(half, 80, 120), true)  // 8 x 12
  assert.equal(thicknessAvailable(half, 120, 80), true)  // rotated
  assert.equal(thicknessAvailable(half, 80, 80), true)   // 8 x 8
  assert.equal(thicknessAvailable(half, 140, 100), false) // 14 x 10 — too long
  assert.equal(thicknessAvailable(half, 100, 100), false) // 10 x 10 — short side too big
})

test('a thickness with no limits fits anything', () => {
  assert.equal(thicknessAvailable(one, 600, 600), true)
})

test('an unavailable thickness falls back instead of quoting a frame we cannot make', () => {
  assert.equal(resolveThickness(5, 200, 140, list), 10)
  assert.equal(resolveThickness(5, 80, 120, list), 5)
})

test('the note is built from the rule, so editing the limit rewrites the sentence', () => {
  assert.equal(thicknessNote(list), '1/2 inch is only available up to 8 in x 12 in.')
  assert.equal(thicknessNote([one]), null)
})
