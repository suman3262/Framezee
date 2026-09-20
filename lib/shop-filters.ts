/**
 * Reading, applying and describing the shop filters (design: framezee_shop_desktop).
 *
 * Filters live in the URL, not in component state, so a filtered view can be shared,
 * bookmarked and rendered on the server. Everything here is pure, so it can be tested
 * without a database or a browser.
 */

export type SortKey = 'latest' | 'price-asc' | 'price-desc' | 'az'

export const SORTS: Array<{ key: SortKey; label: string }> = [
  { key: 'latest', label: 'Latest' },
  { key: 'price-asc', label: 'Price ↑' },
  { key: 'price-desc', label: 'Price ↓' },
  { key: 'az', label: 'A–Z' },
]

export type ShopFilters = {
  categories: string[]
  kinds: string[]
  finishes: string[]
  sizes: string[] // "120x80"
  maxPricePaise: number | null
  sort: SortKey
}

type Params = Record<string, string | string[] | undefined>

const list = (v: string | string[] | undefined): string[] =>
  v === undefined ? [] : Array.isArray(v) ? v.flatMap((x) => x.split(',')) : v.split(',')

export function readFilters(params: Params): ShopFilters {
  const sort = String(params.sort ?? 'latest')
  const max = Number(params.max)

  return {
    categories: list(params.category).filter(Boolean),
    kinds: list(params.kind).filter(Boolean),
    finishes: list(params.finish).filter(Boolean),
    sizes: list(params.size).filter((s) => /^\d+x\d+$/.test(s)),
    maxPricePaise: Number.isFinite(max) && max > 0 ? Math.round(max) : null,
    sort: SORTS.some((s) => s.key === sort) ? (sort as SortKey) : 'latest',
  }
}

/** Builds the href for toggling one value, preserving everything else. */
export function toggleHref(
  current: ShopFilters,
  key: 'category' | 'kind' | 'finish' | 'size',
  value: string,
): string {
  const field = ({ category: 'categories', kind: 'kinds', finish: 'finishes', size: 'sizes' } as const)[key]
  const set = new Set(current[field])
  set.has(value) ? set.delete(value) : set.add(value)

  return buildHref({ ...current, [field]: [...set] })
}

export function sortHref(current: ShopFilters, sort: SortKey): string {
  return buildHref({ ...current, sort })
}

export function priceHref(current: ShopFilters, maxPricePaise: number | null): string {
  return buildHref({ ...current, maxPricePaise })
}

export function buildHref(f: ShopFilters): string {
  const q = new URLSearchParams()
  if (f.categories.length) q.set('category', f.categories.join(','))
  if (f.kinds.length) q.set('kind', f.kinds.join(','))
  if (f.finishes.length) q.set('finish', f.finishes.join(','))
  if (f.sizes.length) q.set('size', f.sizes.join(','))
  if (f.maxPricePaise !== null) q.set('max', String(f.maxPricePaise))
  if (f.sort !== 'latest') q.set('sort', f.sort)
  const s = q.toString()
  return s ? `/browse?${s}` : '/browse'
}

export const isFiltered = (f: ShopFilters): boolean =>
  f.categories.length > 0 ||
  f.kinds.length > 0 ||
  f.finishes.length > 0 ||
  f.sizes.length > 0 ||
  f.maxPricePaise !== null

export type Filterable = {
  categorySlug: string | null
  kind: string | null
  finishSlug: string | null
  fromPaise: number | null
  makeableSizes: string[]
  createdAt: Date
  title: string
}

/** Every chosen filter must match — narrowing, not widening. */
export function applyFilters<T extends Filterable>(items: T[], f: ShopFilters): T[] {
  return items.filter((i) => {
    if (f.categories.length && (!i.categorySlug || !f.categories.includes(i.categorySlug))) return false
    if (f.kinds.length && (!i.kind || !f.kinds.includes(i.kind))) return false
    if (f.finishes.length && (!i.finishSlug || !f.finishes.includes(i.finishSlug))) return false
    if (f.sizes.length && !f.sizes.some((s) => i.makeableSizes.includes(s))) return false
    // A frame with no priceable size cannot satisfy a price ceiling.
    if (f.maxPricePaise !== null && (i.fromPaise === null || i.fromPaise > f.maxPricePaise)) return false
    return true
  })
}

export function sortItems<T extends Filterable>(items: T[], sort: SortKey): T[] {
  const out = [...items]
  switch (sort) {
    case 'price-asc':
      return out.sort((a, b) => (a.fromPaise ?? Infinity) - (b.fromPaise ?? Infinity))
    case 'price-desc':
      return out.sort((a, b) => (b.fromPaise ?? -Infinity) - (a.fromPaise ?? -Infinity))
    case 'az':
      return out.sort((a, b) => a.title.localeCompare(b.title))
    default:
      return out.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
  }
}
