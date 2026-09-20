import Link from 'next/link'
import { Container } from '@/components/home/section-heading.tsx'
import { FilterSidebar } from '@/components/shop/filter-sidebar.tsx'
import { ShopCard } from '@/components/shop/shop-card.tsx'
import { loadCatalog } from '@/lib/storefront.ts'
import {
  readFilters,
  applyFilters,
  sortItems,
  sortHref,
  isFiltered,
  SORTS,
} from '@/lib/shop-filters.ts'

export default async function BrowsePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const params = await searchParams
  const filters = readFilters(params)
  const { items, sizeList, categories, materials } = await loadCatalog()

  const shown = sortItems(applyFilters(items, filters), filters.sort)

  // Counts come from the unfiltered set, so a facet never reads zero just because
  // something else is selected.
  const count = <T,>(all: T[], pick: (t: T) => string | null) =>
    (value: string) => all.filter((t) => pick(t) === value).length

  const byCategory = count(items, (i) => i.categorySlug)
  const byKind = count(items, (i) => i.kind)
  const byFinish = count(items, (i) => i.finishSlug)

  const prices = items.map((i) => i.fromPaise).filter((p): p is number => p !== null)
  const floor = prices.length ? Math.min(...prices) : 0
  const ceiling = prices.length ? Math.max(...items.map((i) => i.toPaise ?? 0)) : 0

  return (
    <Container className="py-6">
      <nav className="flex items-center gap-2 text-xs text-body">
        <Link href="/" className="hover:text-ink">Home</Link>
        <span className="text-faint">/</span>
        <span className="text-ink">Frames</span>
      </nav>

      <div className="mt-3 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold tracking-[-0.02em] text-ink">
            All frames
          </h1>
          <p className="mt-1 text-xs text-body">
            {shown.length} of {items.length} frames · flat-packed, glazed, ready to hang
          </p>
        </div>

        <div className="flex items-center gap-1">
          <span className="mr-1 text-[11px] text-faint">Sort by</span>
          {SORTS.map((s) => (
            <Link
              key={s.key}
              href={sortHref(filters, s.key)}
              className={`rounded-full px-3 py-1 text-[11px] font-semibold ${
                filters.sort === s.key ? 'bg-ink text-page' : 'bg-surface text-body hover:text-ink'
              }`}
            >
              {s.label}
            </Link>
          ))}
        </div>
      </div>

      <div className="mt-5 flex flex-col gap-6 lg:flex-row">
        <FilterSidebar
          filters={filters}
          categories={categories.map((c) => ({ value: c.slug, label: c.name, count: byCategory(c.slug) }))}
          kinds={[...new Set(materials.map((m) => m.kind))].map((k) => ({
            value: k,
            label: k[0].toUpperCase() + k.slice(1),
            count: byKind(k),
          }))}
          finishes={materials.map((m) => ({
            value: m.slug,
            label: m.name,
            count: byFinish(m.slug),
            swatch: m.swatch,
          }))}
          sizes={sizeList}
          priceFloorPaise={floor}
          priceCeilingPaise={ceiling}
          anyFiltered={isFiltered(filters)}
        />

        <div className="min-w-0 flex-1">
          {shown.length === 0 ? (
            <div className="rounded-2xl bg-surface p-10 text-center shadow-[0_1px_1px_rgba(0,0,0,0.05)]">
              <p className="text-sm font-semibold text-ink">No frames match those filters.</p>
              <p className="mt-1 text-xs text-body">
                Try removing one, or have any size cut to order.
              </p>
              <div className="mt-4 flex flex-wrap justify-center gap-2">
                <Link href="/browse" className="rounded-full bg-ink px-4 py-2 text-xs font-bold text-page">
                  Clear filters
                </Link>
                <Link href="/custom" className="rounded-full bg-accent px-4 py-2 text-xs font-bold text-accent-ink">
                  Build a custom frame
                </Link>
              </div>
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {shown.map((item) => (
                <ShopCard key={item.slug} item={item} />
              ))}
            </div>
          )}

          <section className="mt-8 border-t border-line pt-5">
            <h2 className="text-[13px] font-bold text-ink">Not sure of the size?</h2>
            <p className="mt-1 max-w-md text-xs leading-4 text-body">
              Send us the picture&rsquo;s measurements and we&rsquo;ll come back with two
              options.
            </p>
            <Link href="/help" className="mt-2 inline-block text-xs font-semibold text-violet-deep">
              Ask the workshop →
            </Link>
          </section>
        </div>
      </div>
    </Container>
  )
}
