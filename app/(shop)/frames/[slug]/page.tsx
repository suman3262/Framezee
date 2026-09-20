import Link from 'next/link'
import { loadThicknesses, loadMatBands } from '@/lib/frame-catalog.ts'
import { notFound } from 'next/navigation'
import { and, desc, eq, isNotNull, ne, sql } from 'drizzle-orm'
import { db } from '@/db/index.ts'
import {
  categories,
  materialRates,
  materials,
  paperQualities,
  paperRates,
  products,
  reviews,
  settings,
  sizes,
} from '@/db/schema.ts'
import { Container } from '@/components/home/section-heading.tsx'
import { Configurator, type FinishOption } from '@/components/pdp/configurator.tsx'
import { FramePreview } from '@/components/pdp/frame-preview.tsx'
import { ReviewsSection } from '@/components/pdp/reviews.tsx'
import { Stars } from '@/components/pdp/stars.tsx'
import { artworkFor } from '@/lib/artwork.ts'
import { priceFrom, fmtInrRupees } from '@/lib/pricing.ts'
import { wallPresets } from '@/db/seed-data.ts'

export default async function ProductPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params

  const [product] = await db
    .select({
      id: products.id,
      slug: products.slug,
      title: products.title,
      artworkImage: products.artworkImage,
      number: products.number,
      description: products.description,
      isNew: products.isNew,
      specs: products.specs,
      ratingTenths: products.ratingTenths,
      ratingCount: products.ratingCount,
      defaultMaterialId: products.defaultMaterialId,
      categoryName: categories.name,
    })
    .from(products)
    .leftJoin(categories, eq(products.categoryId, categories.id))
    .where(and(eq(products.slug, slug), eq(products.active, true)))
    .limit(1)

  if (!product) notFound()

  const [finishRows, rateRows, sizeRows, paperRows, paperRateRows, [config], thicknesses, matBands] = await Promise.all([
    db.select().from(materials).where(eq(materials.active, true)),
    db.select().from(materialRates).where(eq(materialRates.active, true)),
    db.select().from(sizes).where(eq(sizes.active, true)).orderBy(sizes.sortOrder),
    db.select().from(paperQualities).where(eq(paperQualities.active, true)),
    db.select().from(paperRates).where(eq(paperRates.active, true)),
    db.select().from(settings).limit(1),
    loadThicknesses(),
    loadMatBands(),
  ])

  const finishes: FinishOption[] = finishRows.map((m) => ({
    id: m.id,
    slug: m.slug,
    name: m.name,
    swatch: m.swatch,
    limits: {
      minWidthTenths: m.minWidthTenths,
      maxWidthTenths: m.maxWidthTenths,
      minHeightTenths: m.minHeightTenths,
      maxHeightTenths: m.maxHeightTenths,
    },
    bands: rateRows
      .filter((r) => r.materialId === m.id)
      .map((r) => ({
        maxWidthTenths: r.maxWidthTenths,
        maxHeightTenths: r.maxHeightTenths,
        ratePaisePerSqIn: r.ratePaisePerSqIn,
      })),
  }))

  const defaultFinish =
    finishes.find((f) => f.id === product.defaultMaterialId) ?? finishes[0]

  const papers = paperRows.map((p) => ({
    id: p.id,
    name: p.name,
    bands: paperRateRows
      .filter((r) => r.paperQualityId === p.id)
      .map((r) => ({
        maxWidthTenths: r.maxWidthTenths,
        maxHeightTenths: r.maxHeightTenths,
        ratePaisePerSqIn: r.ratePaisePerSqIn,
      })),
  }))

  const [written, histRows, related] = await Promise.all([
    db
      .select()
      .from(reviews)
      .where(and(eq(reviews.productId, product.id), ne(reviews.title, '')))
      .orderBy(desc(reviews.createdAt))
      .limit(6),
    db
      .select({ rating: reviews.rating, n: sql<number>`count(*)::int` })
      .from(reviews)
      .where(eq(reviews.productId, product.id))
      .groupBy(reviews.rating),
    db
      .select({
        slug: products.slug,
        title: products.title,
        artwork: products.artworkImage,
        defaultMaterialId: products.defaultMaterialId,
      })
      .from(products)
      .where(and(eq(products.active, true), ne(products.id, product.id), isNotNull(products.defaultMaterialId)))
      .limit(4),
  ])

  const histogram = Object.fromEntries(histRows.map((h) => [h.rating, h.n])) as Record<number, number>
  const artwork = artworkFor(product.slug, product.artworkImage)
  // Ordered pairs, because jsonb does not preserve object key order.
  const specs = (product.specs ?? []) as [string, string][]

  return (
    <Container className="pb-10">
      <nav className="flex items-center gap-2 py-4 text-xs text-body">
        <Link href="/" className="hover:text-ink">Home</Link>
        <span className="text-faint">›</span>
        <Link href="/browse" className="hover:text-ink">Frames</Link>
        <span className="text-faint">›</span>
        <span className="text-ink">{product.title}</span>
      </nav>

      <div>
          <div className="mt-0">
            <Configurator
              thicknesses={thicknesses}
              matBands={matBands}
              productId={product.id}
              finishes={finishes}
              defaultFinishSlug={defaultFinish.slug}
              sizes={sizeRows.map((s) => ({
                widthTenths: s.widthTenths,
                heightTenths: s.heightTenths,
              }))}
              papers={papers}
              artwork={artwork}
              wallPresets={[...wallPresets]}
              header={
                <div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-body">
                    No. {product.number} · {product.categoryName}
                  </span>
                  {product.isNew && (
                    <span className="rounded-full bg-accent px-2 py-[2px] text-[11px] font-bold uppercase tracking-[0.04em] text-accent-ink">
                      New
                    </span>
                  )}
                </div>

                <h1 className="mt-2 font-display text-[28px] font-bold leading-9 tracking-[-0.025em] text-ink">
                  {product.title}
                </h1>

                {product.ratingTenths !== null && product.ratingCount > 0 && (
                  <div className="mt-2 flex items-center gap-2">
                    <Stars tenths={product.ratingTenths} />
                    <span className="text-[13px] font-semibold text-ink">
                      {(product.ratingTenths / 10).toFixed(1)}
                    </span>
                    <span className="text-xs text-body">({product.ratingCount} ratings)</span>
                  </div>
                )}

                <p className="mt-4 text-sm leading-[22px] text-body">{product.description}</p>

                <p className="mt-2 text-[13px] font-semibold text-violet-deep">
                  In stock — dispatched in 3 working days
                </p>
                </div>
              }
              freeShippingThresholdPaise={config?.freeShippingThresholdPaise ?? null}
            />
          </div>

          <section className="mt-6 bg-surface p-5 shadow-[0_1px_1px_rgba(0,0,0,0.05)]">
            <h2 className="text-[11px] font-bold uppercase tracking-[0.05em] text-faint">
              Product specifications
            </h2>
            <dl className="mt-3 flex flex-col gap-[10px]">
              {specs.map(([k, v], i, arr) => (
                <div
                  key={k}
                  className={`flex items-center justify-between gap-4 ${
                    i < arr.length - 1 ? 'border-b border-subtle pb-[7px]' : ''
                  }`}
                >
                  <dt className="text-xs text-body">{k}</dt>
                  <dd className="text-right text-xs font-medium text-ink">{v}</dd>
                </div>
              ))}
            </dl>
          </section>
      </div>

      {product.ratingTenths !== null && product.ratingCount > 0 && (
        <ReviewsSection
          ratingTenths={product.ratingTenths}
          ratingCount={product.ratingCount}
          histogram={histogram}
          reviews={written}
        />
      )}

      <section className="py-4">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-display text-2xl font-bold tracking-[-0.02em] text-ink">
            You may also like
          </h2>
          <Link href="/browse" className="text-xs font-semibold text-violet-deep">
            All frames
          </Link>
        </div>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {related.map((r) => {
            const finish = finishes.find((f) => f.id === r.defaultMaterialId) ?? finishes[0]
            const from = priceFrom(
              sizeRows.map((s) => ({ widthTenths: s.widthTenths, heightTenths: s.heightTenths })),
              { name: finish.name, limits: finish.limits, bands: finish.bands },
            )
            return (
              <Link
                key={r.slug}
                href={`/frames/${r.slug}`}
                className="rounded-2xl bg-surface p-3 shadow-[0_1px_1px_rgba(0,0,0,0.05)] hover:shadow-md"
              >
                <FramePreview
                  widthTenths={70}
                  heightTenths={50}
                  swatch={finish.swatch}
                  thicknessTenths={10}
                  matBoard={false}
                  artwork={artworkFor(r.slug, r.artwork)}
                  className="h-[150px] rounded-xl bg-subtle p-4"
                />
                <p className="mt-3 text-[13px] font-semibold text-ink">{r.title}</p>
                <p className="text-xs text-body">
                  {from === null ? 'Made to order' : `from ${fmtInrRupees(from)}`}
                </p>
              </Link>
            )
          })}
        </div>
      </section>
    </Container>
  )
}
