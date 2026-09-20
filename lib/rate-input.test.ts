import { test } from 'node:test'
import assert from 'node:assert/strict'
import { parseRupees, parseInches, checkBandSet } from './rate-input.ts'

test('rupees are read however a human types them', () => {
  for (const [input, paise] of [['4', 400], ['4.5', 450], ['₹4.50', 450], ['1,250', 125_000], [' 6.05 ', 605]] as const) {
    const r = parseRupees(input, 'rate')
    assert.equal(r.ok && r.paise, paise, String(input))
  }
})

test('a rate of zero is refused, because it would make every frame free', () => {
  const r = parseRupees('0', 'rate')
  assert.equal(r.ok, false)
  assert.match(r.ok === false ? r.error.message : '', /free/)
})

test('zero is allowed where it is a real answer, like a shipping charge', () => {
  const r = parseRupees('0', 'shipping', { allowZero: true })
  assert.equal(r.ok && r.paise, 0)
})

test('negatives, blanks and nonsense are refused', () => {
  for (const bad of ['-4', '', '   ', 'four', 'abc']) {
    assert.equal(parseRupees(bad, 'rate').ok, false, bad)
  }
})

test('an absurd amount is caught as a typo rather than saved', () => {
  // A stray zero on Rs 4/sq-in is Rs 40,000 on a small frame.
  const r = parseRupees('200000', 'rate')
  assert.equal(r.ok, false)
  assert.match(r.ok === false ? r.error.message : '', /typo/)
})

test('inches convert to tenths and reject the impossible', () => {
  const twelve = parseInches('12', 'w')
  assert.equal(twelve.ok && twelve.tenths, 120)
  const sevenHalf = parseInches('7.5', 'w')
  assert.equal(sevenHalf.ok && sevenHalf.tenths, 75)
  for (const bad of ['0', '-3', '', 'wide', '900']) {
    assert.equal(parseInches(bad, 'w').ok, false, bad)
  }
})

test('a material with no rate bands is refused', () => {
  const errs = checkBandSet([])
  assert.equal(errs.length, 1)
  assert.match(errs[0].message, /at least one/)
})

test('two bands with the same ceiling are flagged as ambiguous', () => {
  const errs = checkBandSet([
    { maxWidthTenths: 100, maxHeightTenths: 100, ratePaisePerSqIn: 400 },
    { maxWidthTenths: 100, maxHeightTenths: 100, ratePaisePerSqIn: 500 },
  ])
  assert.ok(errs.some((e) => /both stop at/.test(e.message)))
})

test('bands that do not reach the sizes the moulding is offered at are flagged', () => {
  // Offered up to 60 in, but the widest band stops at 20 in — everything between is
  // unpriceable, and the frame would vanish from the shop without explanation.
  const errs = checkBandSet(
    [{ maxWidthTenths: 200, maxHeightTenths: 200, ratePaisePerSqIn: 400 }],
    { maxWidthTenths: 600, maxHeightTenths: 600 },
  )
  assert.equal(errs.length, 1)
  assert.match(errs[0].message, /cannot be priced/)
})

test('a sound band set passes', () => {
  const errs = checkBandSet(
    [
      { maxWidthTenths: 100, maxHeightTenths: 100, ratePaisePerSqIn: 690 },
      { maxWidthTenths: 600, maxHeightTenths: 600, ratePaisePerSqIn: 400 },
    ],
    { maxWidthTenths: 600, maxHeightTenths: 600 },
  )
  assert.deepEqual(errs, [])
})
