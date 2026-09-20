import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  readFilters,
  applyFilters,
  sortItems,
  toggleHref,
  buildHref,
  isFiltered,
  type Filterable,
} from './shop-filters.ts'

const item = (over: Partial<Filterable> & { title: string }): Filterable => ({
  categorySlug: 'anime',
  kind: 'wood',
  finishSlug: 'maple',
  fromPaise: 50_000,
  makeableSizes: ['80x100', '120x160'],
  createdAt: new Date('2026-01-01'),
  ...over,
})

const items = [
  item({ title: 'Oak', categorySlug: 'nature', finishSlug: 'golden', fromPaise: 13_300, createdAt: new Date('2026-03-01') }),
  item({ title: 'Ash', kind: 'wood', finishSlug: 'ash', fromPaise: 9_400, createdAt: new Date('2026-02-01') }),
  item({ title: 'Aluminium', kind: 'metal', finishSlug: 'aluminium', fromPaise: 16_600, createdAt: new Date('2026-04-01') }),
]

test('no filters means nothing is hidden', () => {
  const f = readFilters({})
  assert.equal(isFiltered(f), false)
  assert.equal(applyFilters(items, f).length, 3)
})

test('filters read out of the URL, comma-separated or repeated', () => {
  assert.deepEqual(readFilters({ category: 'anime,nature' }).categories, ['anime', 'nature'])
  assert.deepEqual(readFilters({ category: ['anime', 'nature'] }).categories, ['anime', 'nature'])
})

test('a junk sort falls back to latest rather than breaking the page', () => {
  assert.equal(readFilters({ sort: 'nonsense' }).sort, 'latest')
  assert.equal(readFilters({ sort: 'price-desc' }).sort, 'price-desc')
})

test('a junk size is ignored, not passed through to a query', () => {
  assert.deepEqual(readFilters({ size: "120x80,drop table,9x9" }).sizes, ['120x80', '9x9'])
})

test('every chosen filter must match — they narrow, they do not widen', () => {
  const both = readFilters({ kind: 'wood', finish: 'ash' })
  assert.deepEqual(applyFilters(items, both).map((i) => i.title), ['Ash'])

  // wood + a finish that is metal matches nothing, rather than falling back to "any"
  const impossible = readFilters({ kind: 'wood', finish: 'aluminium' })
  assert.deepEqual(applyFilters(items, impossible), [])
})

test('a price ceiling excludes anything dearer, and anything unpriceable', () => {
  const f = readFilters({ max: '14000' })
  assert.deepEqual(applyFilters(items, f).map((i) => i.title), ['Oak', 'Ash'])

  const unpriceable = [item({ title: 'Ghost', fromPaise: null })]
  assert.deepEqual(applyFilters(unpriceable, f), [])
})

test('size filters match a frame that can be made at any one of them', () => {
  const f = readFilters({ size: '120x160' })
  assert.equal(applyFilters(items, f).length, 3)
  assert.equal(applyFilters(items, readFilters({ size: '999x999' })).length, 0)
})

test('sorting does what the labels promise', () => {
  assert.deepEqual(sortItems(items, 'price-asc').map((i) => i.title), ['Ash', 'Oak', 'Aluminium'])
  assert.deepEqual(sortItems(items, 'price-desc').map((i) => i.title), ['Aluminium', 'Oak', 'Ash'])
  assert.deepEqual(sortItems(items, 'az').map((i) => i.title), ['Aluminium', 'Ash', 'Oak'])
  assert.deepEqual(sortItems(items, 'latest').map((i) => i.title), ['Aluminium', 'Oak', 'Ash'])
})

test('sorting never mutates the list it was given', () => {
  const before = items.map((i) => i.title)
  sortItems(items, 'az')
  assert.deepEqual(items.map((i) => i.title), before)
})

test('toggling a filter keeps every other filter in the link', () => {
  const f = readFilters({ category: 'anime', kind: 'wood', sort: 'az' })
  const href = toggleHref(f, 'category', 'nature')
  assert.match(href, /category=anime%2Cnature/)
  assert.match(href, /kind=wood/)
  assert.match(href, /sort=az/)
})

test('toggling a filter off removes just that one', () => {
  const f = readFilters({ category: 'anime,nature' })
  assert.match(toggleHref(f, 'category', 'anime'), /category=nature/)
})

test('an empty filter set gives the bare url, not a trailing question mark', () => {
  assert.equal(buildHref(readFilters({})), '/browse')
})
