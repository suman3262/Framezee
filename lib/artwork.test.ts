import { test } from 'node:test'
import assert from 'node:assert/strict'
import { artworkFor, toBackground } from './artwork.ts'

test('a stored CSS value is used as-is', () => {
  assert.equal(artworkFor('anything', 'linear-gradient(90deg,#000,#fff)'), 'linear-gradient(90deg,#000,#fff)')
})

test('a stored URL becomes a cover background', () => {
  assert.equal(artworkFor('x', 'https://cdn.example/a.jpg'), 'center / cover no-repeat url("https://cdn.example/a.jpg")')
  assert.equal(artworkFor('x', '/uploads/a.png'), 'center / cover no-repeat url("/uploads/a.png")')
})

test('the dead seed paths are ignored, so seeded frames keep their gradient', () => {
  const seeded = artworkFor('natural-oak-001', '/mock/art/natural-oak-001.jpg')
  assert.equal(seeded, artworkFor('natural-oak-001'))
  assert.match(seeded, /^linear-gradient/)
})

test('a product with no stored value and no gradient still gets something', () => {
  assert.match(artworkFor('brand-new-frame-007'), /^linear-gradient/)
})

test('blank and whitespace are treated as absent', () => {
  assert.equal(artworkFor('natural-oak-001', '   '), artworkFor('natural-oak-001'))
  assert.equal(artworkFor('natural-oak-001', null), artworkFor('natural-oak-001'))
})

test('a quote in a URL cannot break out of the css url()', () => {
  // Stored values come from an admin form, so this is a guard, not a threat model.
  assert.equal(toBackground('/a.jpg'), 'center / cover no-repeat url("/a.jpg")')
})
