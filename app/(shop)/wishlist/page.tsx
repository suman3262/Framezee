import Link from 'next/link'
import { desc, eq } from 'drizzle-orm'
import { db } from '@/db/index.ts'
import {
  categories,
  glazingOptions,
  glazingRates,
  materialRates,
  materials,
  products,
  wishlistItems,
} from '@/db/schema.ts'
import { requireUser } from '@/lib/auth.ts'
import { Container } from '@/components/home/section-heading.tsx'
import { FramePreview } from '@/components/pdp/frame-preview.tsx'
import { artworkFor } from '@/lib/artwork.ts'
import { priceLine, fmtIn, fmtInr, PriceError } from '@/lib/pricing.ts'
import { removeFromWishlist, moveToBasket, moveAllToBasket, clearWishlist } from '@/app/actions/wishlist.ts'
import { ShareList } from '@/components/shop/share-list.tsx'

const SORTS = [
  { key: 'recent', label: 'Recently Added' },
  { key: 'price-asc', label: 'Price: Low to High' },
  { key: 'price-desc', label: 'Price: High to Low' },
] as const

export default async function WishlistPage({
  searchParams,
}: {
  searchParams: Promise<{ sort?: string }>
}) {
  const { sort: sortParam } = await searchParams
  const sort = SORTS.some((s) => s.key === sortParam) ? sortParam! : 'recent'
  const user = await requireUser('/wishlist')

  const [rows, rateRows, glazingRateRows] = await Promise.all([
    db
      .select({
        w: wishlistItems,
        productSlug: products.slug,
        productArtwork: products.artworkImage,
        productTitle: products.title,
        categoryName: categories.name,
        material: materials,
        glazingName: glazingOptions.name,
      })
      .from(wishlistItems)
      .leftJoin(products, eq(wishlistItems.productId, products.id))
      .leftJoin(categories, eq(products.categoryId, categories.id))
      .innerJoin(materials, eq(wishlistItems.materialId, materials.id))
      .leftJoin(glazingOptions, eq(wishlistItems.glazingOptionId, glazingOptions.id))
      .where(eq(wishlistItems.userId, user.id))
      .orderBy(desc(wishlistItems.createdAt)),
    db.select().from(materialRates).where(eq(materialRates.active, true)),
    db.select().from(glazingRates).where(eq(glazingRates.active, true)),
  ])

  const priced = rows.map((r) => {
    try {
      return {
        ...r,
        unitPaise: priceLine({
          widthTenths: r.w.widthTenths,
          heightTenths: r.w.heightTenths,
          qty: 1,
          material: {
            name: r.material.name,
            limits: { minWidthTenths: 0, maxWidthTenths: 100_000, minHeightTenths: 0, maxHeightTenths: 100_000 },
            bands: rateRows
              .filter((b) => b.materialId === r.material.id)
              .map((b) => ({
                maxWidthTenths: b.maxWidthTenths,
                maxHeightTenths: b.maxHeightTenths,
                ratePaisePerSqIn: b.ratePaisePerSqIn,
              })),
          },
          glazing: r.w.glazingOptionId
            ? {
                name: r.glazingName ?? 'Glazing',
                bands: glazingRateRows
                  .filter((g) => g.glazingOptionId === r.w.glazingOptionId)
                  .map((g) => ({
                    maxWidthTenths: g.maxWidthTenths,
                    maxHeightTenths: g.maxHeightTenths,
                    ratePaisePerSqIn: g.ratePaisePerSqIn,
                  })),
              }
            : undefined,
        }).unitPaise,
        error: null as string | null,
      }
    } catch (e) {
      return { ...r, unitPaise: null, error: e instanceof PriceError ? e.message : 'Unavailable' }
    }
  })

  const ordered = [...priced].sort((a, b) => {
    if (sort === 'price-asc') return (a.unitPaise ?? Infinity) - (b.unitPaise ?? Infinity)
    if (sort === 'price-desc') return (b.unitPaise ?? -Infinity) - (a.unitPaise ?? -Infinity)
    return b.w.createdAt.getTime() - a.w.createdAt.getTime()
  })

  const total = priced.reduce((a, p) => a + (p.unitPaise ?? 0), 0)

  return (
    <Container className="py-6 pb-24 md:pb-10">
      <nav className="flex flex-wrap items-center justify-between gap-3 text-xs text-body">
        <span className="flex items-center gap-2">
          <Link href="/browse" className="hover:text-ink">← Back to catalog</Link>
          <span className="text-faint">/</span>
          <span className="text-ink">Wishlist</span>
        </span>
        {rows.length > 0 && (
          <span className="flex items-center gap-4">
            <ShareList />
            <form action={clearWishlist}>
              <button className="font-semibold text-faint hover:text-red-600">Clear all</button>
            </form>
            <form action={moveAllToBasket}>
              <button className="font-semibold text-violet-deep">Move all to basket</button>
            </form>
          </span>
        )}
      </nav>

      <h1 className="mt-3 font-display text-2xl font-bold tracking-[-0.02em] text-ink sm:text-3xl">
        Your wishlist
      </h1>
      <p className="mt-1 text-xs text-body">
        {rows.length} saved. Move straight to your basket, adjust the spec, or keep them for
        later. All sizes are handcrafted with archival cotton backing and wall-mount hardware.
      </p>

      {rows.length > 1 && (
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <span className="text-[11px] text-faint">Sort by</span>
          {SORTS.map((s) => (
            <Link
              key={s.key}
              href={s.key === 'recent' ? '/wishlist' : `/wishlist?sort=${s.key}`}
              className={`rounded-full px-3 py-1 text-[11px] font-semibold ${
                sort === s.key ? 'bg-ink text-page' : 'bg-surface text-body hover:text-ink'
              }`}
            >
              {s.label}
            </Link>
          ))}
        </div>
      )}

      {rows.length === 0 ? (
        <div className="mt-8 rounded-2xl bg-surface p-10 text-center shadow-[0_1px_1px_rgba(0,0,0,0.05)]">
          <p className="font-display text-base font-bold text-ink">Your wishlist is empty</p>
          <p className="mt-1 text-xs text-body">
            Tap the heart on any frame to keep it here, or have one cut to your own size.
          </p>
          <div className="mt-4 flex flex-wrap justify-center gap-2">
            <Link href="/browse" className="rounded-full bg-ink px-4 py-2 text-xs font-bold text-page">
              Browse frames
            </Link>
            <Link href="/custom" className="rounded-full bg-accent px-4 py-2 text-xs font-bold text-accent-ink">
              Build a custom frame
            </Link>
          </div>
        </div>
      ) : (
        <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {ordered.map((p) => (
            <article
              key={p.w.id}
              className="flex flex-col rounded-2xl bg-surface p-4 shadow-[0_1px_1px_rgba(0,0,0,0.05)]"
            >
              <div className="mb-3 flex items-start justify-between gap-2">
                <span className="text-[10px] font-bold uppercase tracking-[0.05em] text-faint">
                  Saved item
                </span>
                <form action={removeFromWishlist}>
                  <input type="hidden" name="id" value={p.w.id} />
                  <button aria-label="Remove from wishlist" className="text-sm text-faint hover:text-red-600">
                    ✕
                  </button>
                </form>
              </div>

              <FramePreview
                widthTenths={p.w.widthTenths}
                heightTenths={p.w.heightTenths}
                swatch={p.material.swatch}
                thicknessTenths={p.w.thicknessTenths}
                matBoard={p.w.matBoard}
                artwork={artworkFor(p.productSlug ?? '', p.productArtwork)}
                className="h-[180px] rounded-xl bg-subtle p-4"
              />

              <p className="mt-3 text-[10px] font-bold uppercase tracking-[0.05em] text-faint">
                {p.categoryName ?? 'Custom'}
              </p>
              <h2 className="text-[13px] font-bold text-ink">
                {p.productTitle ?? 'Custom frame'}
              </h2>

              <dl className="mt-2 flex flex-col gap-1 text-[11px] leading-4">
                <Spec k="Size" v={`${fmtIn(p.w.widthTenths)} × ${fmtIn(p.w.heightTenths)} in`} />
                <Spec k="Moulding" v={`${p.w.thicknessTenths === 5 ? '1/2"' : '1"'} ${p.material.name}`} />
                <Spec k="Mount & glaze" v={`${p.w.matBoard ? 'Mat' : 'No mat'} · ${p.glazingName ?? 'Styrene'}`} />
              </dl>

              <div className="mt-3 flex items-end justify-between border-t border-line pt-3">
                <span>
                  <span className="block text-[10px] text-faint">Unit price</span>
                  <span className="font-display text-base font-extrabold text-ink">
                    {p.unitPaise === null ? '—' : fmtInr(p.unitPaise)}
                  </span>
                </span>
                {p.productSlug && (
                  <Link href={`/frames/${p.productSlug}`} className="text-[11px] font-semibold text-violet-deep">
                    Customise
                  </Link>
                )}
              </div>

              {p.error && <p className="mt-2 text-[11px] text-red-600">{p.error}</p>}

              <form action={moveToBasket} className="mt-3">
                <input type="hidden" name="id" value={p.w.id} />
                <button
                  disabled={p.unitPaise === null}
                  className="w-full rounded-full bg-accent px-4 py-2 text-xs font-bold text-accent-ink disabled:opacity-50"
                >
                  Move to basket
                </button>
              </form>
            </article>
          ))}
        </div>
      )}

      {rows.length > 0 && (
        <section className="mt-8 rounded-2xl bg-violet-tint/40 p-5">
          <h2 className="text-sm font-bold text-ink">
            Have an unconventional art dimension or personal photo?
          </h2>
          <p className="mt-1 max-w-2xl text-xs leading-4 text-body">
            Any size we don&rsquo;t list off the shelf can be cut to 1 mm precision in our
            workshop, from the same mouldings with museum-grade glazing.
          </p>
          <Link
            href="/custom"
            className="mt-3 inline-block rounded-full bg-accent px-4 py-2 text-xs font-bold text-accent-ink"
          >
            Build a custom frame
          </Link>
        </section>
      )}

      {rows.length > 0 && (
        <div className="fixed inset-x-0 bottom-[57px] z-30 flex items-center justify-between gap-3 border-t border-line bg-page/95 px-4 py-3 backdrop-blur-[12px] md:hidden">
          <span>
            <span className="block text-[10px] font-bold uppercase tracking-[0.05em] text-faint">
              Total if moved
            </span>
            <span className="font-display text-base font-extrabold text-ink">{fmtInr(total)}</span>
          </span>
          <form action={moveAllToBasket}>
            <button className="rounded-full bg-accent px-5 py-[10px] text-sm font-bold text-accent-ink">
              Move all to basket →
            </button>
          </form>
        </div>
      )}
    </Container>
  )
}

function Spec({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex justify-between gap-3">
      <dt className="text-faint">{k}</dt>
      <dd className="text-right font-medium text-ink">{v}</dd>
    </div>
  )
}
