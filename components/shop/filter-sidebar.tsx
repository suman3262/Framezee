import Link from 'next/link'
import { fmtIn, fmtInrRupees } from '@/lib/pricing.ts'
import { toggleHref, priceHref, type ShopFilters } from '@/lib/shop-filters.ts'

export type FacetCount = { value: string; label: string; count: number }

/**
 * Filters as links, not form state. Every combination is a real URL, so a filtered view
 * can be shared or bookmarked and the page stays server-rendered.
 */
export function FilterSidebar({
  filters,
  categories,
  kinds,
  finishes,
  sizes,
  priceFloorPaise,
  priceCeilingPaise,
  anyFiltered,
}: {
  filters: ShopFilters
  categories: FacetCount[]
  kinds: FacetCount[]
  finishes: Array<FacetCount & { swatch: string }>
  sizes: Array<{ widthTenths: number; heightTenths: number }>
  priceFloorPaise: number
  priceCeilingPaise: number
  anyFiltered: boolean
}) {
  return (
    <aside className="lg:w-[200px] lg:shrink-0">
      <div className="mb-4 flex items-center justify-between border-b border-line pb-2">
        <h2 className="text-[13px] font-bold text-ink">Filters</h2>
        {anyFiltered && (
          <Link href="/browse" className="text-[11px] font-semibold text-violet-deep">
            Clear all
          </Link>
        )}
      </div>

      <Group label="Category">
        <ul className="flex flex-col gap-[6px]">
          {categories.map((c) => (
            <li key={c.value}>
              <Check
                href={toggleHref(filters, 'category', c.value)}
                on={filters.categories.includes(c.value)}
                label={c.label}
                count={c.count}
              />
            </li>
          ))}
        </ul>
      </Group>

      <Group label="Material">
        <ul className="flex flex-col gap-[6px]">
          {kinds.map((k) => (
            <li key={k.value}>
              <Check
                href={toggleHref(filters, 'kind', k.value)}
                on={filters.kinds.includes(k.value)}
                label={k.label}
                count={k.count}
              />
            </li>
          ))}
        </ul>
      </Group>

      <Group label="Size">
        <div className="flex flex-wrap gap-[6px]">
          {sizes.map((s) => {
            const value = `${s.widthTenths}x${s.heightTenths}`
            const on = filters.sizes.includes(value)
            return (
              <Link
                key={value}
                href={toggleHref(filters, 'size', value)}
                className={`rounded-full px-[10px] py-1 text-[11px] font-semibold ${
                  on ? 'bg-ink text-page' : 'bg-surface text-body hover:text-ink'
                }`}
              >
                {s.widthTenths === s.heightTenths
                  ? `Square ${fmtIn(s.widthTenths)} in`
                  : `${fmtIn(s.widthTenths)} × ${fmtIn(s.heightTenths)} in`}
              </Link>
            )
          })}
        </div>
      </Group>

      <Group label="Finish">
        <div className="flex flex-wrap gap-2">
          {finishes.map((f) => {
            const on = filters.finishes.includes(f.value)
            return (
              <Link
                key={f.value}
                href={toggleHref(filters, 'finish', f.value)}
                title={`${f.label} · ${f.count}`}
                aria-label={f.label}
                className={`size-6 rounded-full ring-offset-2 ${on ? 'ring-2 ring-violet-deep' : 'ring-1 ring-black/10'}`}
                style={{ background: f.swatch }}
              />
            )
          })}
        </div>
      </Group>

      <Group label="Price">
        <div className="flex flex-wrap gap-[6px]">
          {priceBands(priceFloorPaise, priceCeilingPaise).map((band) => {
            const on = filters.maxPricePaise === band
            return (
              <Link
                key={band}
                href={priceHref(filters, on ? null : band)}
                className={`rounded-full px-[10px] py-1 text-[11px] font-semibold ${
                  on ? 'bg-ink text-page' : 'bg-surface text-body hover:text-ink'
                }`}
              >
                under {fmtInrRupees(band)}
              </Link>
            )
          })}
        </div>
        <p className="mt-2 text-[11px] text-faint">
          {fmtInrRupees(priceFloorPaise)} — {fmtInrRupees(priceCeilingPaise)} across the range
        </p>
      </Group>

      <div className="mt-6 rounded-2xl bg-subtle p-4">
        <p className="text-[10px] font-bold uppercase tracking-[0.05em] text-faint">
          Made to measure
        </p>
        <p className="mt-1 text-[13px] font-bold text-ink">Not finding your type of frame?</p>
        <p className="mt-1 text-[11px] leading-4 text-body">
          Build it yourself — pick the size, moulding, mat and glazing, and we cut it to
          order. Any dimension from 4 × 4 to 40 × 60 in.
        </p>
        <Link
          href="/custom"
          className="mt-3 block rounded-full bg-accent px-4 py-2 text-center text-xs font-bold text-accent-ink"
        >
          Build a custom frame
        </Link>
        <p className="mt-2 text-center text-[10px] text-faint">
          Cut and dispatched in five working days
        </p>
      </div>
    </aside>
  )
}

/** Round bands so the options read like money, not like a computed maximum. */
function priceBands(floor: number, ceiling: number): number[] {
  const steps = [50_000, 100_000, 250_000, 500_000, 1_000_000]
  return steps.filter((s) => s > floor && s < ceiling * 1.5).slice(0, 4)
}

function Group({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <section className="mb-5">
      <h3 className="mb-2 text-[10px] font-bold uppercase tracking-[0.05em] text-faint">{label}</h3>
      {children}
    </section>
  )
}

function Check({
  href,
  on,
  label,
  count,
}: {
  href: string
  on: boolean
  label: string
  count: number
}) {
  return (
    <Link href={href} className="flex items-center justify-between gap-2 text-[12px]">
      <span className="flex items-center gap-2">
        <span
          className={`grid size-[14px] shrink-0 place-items-center rounded-[3px] border text-[9px] ${
            on ? 'border-violet-deep bg-violet-deep text-white' : 'border-line bg-surface'
          }`}
        >
          {on ? '✓' : ''}
        </span>
        <span className={on ? 'font-semibold text-ink' : 'text-body'}>{label}</span>
      </span>
      <span className="text-[11px] text-faint">{count}</span>
    </Link>
  )
}
