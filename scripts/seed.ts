/**
 * Loads db/seed-data.ts into a real database.  Run:  npm run seed
 *
 * Idempotent by truncate-and-reload, so it is safe to re-run while developing.
 * It refuses to run against a database that already holds orders.
 */

import { sql } from 'drizzle-orm'
import { db } from '../db/index.ts'
import {
  categories,
  sizes,
  materials,
  materialRates,
  paperQualities,
  paperRates,
  products,
  coupons,
  settings,
  orders,
  reviews,
  glazingOptions,
  glazingRates,
} from '../db/schema.ts'
import * as seed from '../db/seed-data.ts'

const [{ count: orderCount }] = await db
  .select({ count: sql<number>`count(*)::int` })
  .from(orders)

if (orderCount > 0) {
  console.error(`Refusing to seed: this database has ${orderCount} orders in it.`)
  process.exit(1)
}

console.log('Clearing catalog and pricing tables…')
await db.execute(sql`
  truncate table
    ${reviews}, ${materialRates}, ${paperRates}, ${glazingRates}, ${glazingOptions},
    ${products}, ${materials},
    ${paperQualities}, ${categories}, ${sizes}, ${coupons}, ${settings}
  restart identity cascade
`)

const insertedCategories = await db.insert(categories).values(seed.categories).returning()
const categoryBySlug = new Map(insertedCategories.map((c) => [c.slug, c.id]))
console.log(`  categories      ${insertedCategories.length}`)

const insertedSizes = await db.insert(sizes).values(seed.sizes).returning()
console.log(`  sizes           ${insertedSizes.length}`)

const insertedMaterials = await db
  .insert(materials)
  .values(
    seed.materials.map((m) => ({
      slug: m.key,
      name: m.name,
      kind: m.kind,
      swatch: m.swatch,
      description: m.description,
      gstRateBp: m.gstRateBp,
      hsnCode: m.hsnCode,
      ...seed.materialLimits[m.key],
      active: true,
    })),
  )
  .returning()
const materialByName = new Map(insertedMaterials.map((m) => [m.name, m.id]))
console.log(`  materials       ${insertedMaterials.length}`)

const rateRows = seed.materials.flatMap((m) =>
  seed.materialRates[m.key].map((b) => ({
    materialId: materialByName.get(m.name)!,
    maxWidthTenths: b.maxWidthTenths,
    maxHeightTenths: b.maxHeightTenths,
    ratePaisePerSqIn: b.ratePaisePerSqIn,
  })),
)
await db.insert(materialRates).values(rateRows)
console.log(`  material rates  ${rateRows.length}`)

const insertedPapers = await db
  .insert(paperQualities)
  .values(
    seed.paperQualities.map((p) => ({
      name: p.name,
      description: p.description,
      gstRateBp: p.gstRateBp,
      hsnCode: p.hsnCode,
      active: true,
    })),
  )
  .returning()
const paperByName = new Map(insertedPapers.map((p) => [p.name, p.id]))
console.log(`  papers          ${insertedPapers.length}`)

const paperRateRows = seed.paperQualities.flatMap((p) =>
  seed.paperRates[p.key].map((b) => ({
    paperQualityId: paperByName.get(p.name)!,
    maxWidthTenths: b.maxWidthTenths,
    maxHeightTenths: b.maxHeightTenths,
    ratePaisePerSqIn: b.ratePaisePerSqIn,
  })),
)
await db.insert(paperRates).values(paperRateRows)
console.log(`  paper rates     ${paperRateRows.length}`)

const insertedGlazing = await db
  .insert(glazingOptions)
  .values(
    seed.glazingOptions.map((g, i) => ({
      slug: g.key,
      name: g.name,
      description: g.description,
      included: g.included,
      gstRateBp: g.gstRateBp,
      hsnCode: g.hsnCode,
      sortOrder: i,
      active: true,
    })),
  )
  .returning()
const glazingBySlug = new Map(insertedGlazing.map((g) => [g.slug, g.id]))

// Only the upgrade gets a rate. The included one is free at every size.
const glazingRateRows = seed.glazingOptions
  .filter((g) => g.ratePaisePerSqIn > 0)
  .map((g) => ({
    glazingOptionId: glazingBySlug.get(g.key)!,
    maxWidthTenths: 600,
    maxHeightTenths: 600,
    ratePaisePerSqIn: g.ratePaisePerSqIn,
  }))
if (glazingRateRows.length) await db.insert(glazingRates).values(glazingRateRows)
console.log(`  glazing         ${insertedGlazing.length} (+${glazingRateRows.length} rate)`)

const materialByKey = new Map(
  seed.materials.map((m) => [m.key, materialByName.get(m.name)!]),
)
const insertedProducts = await db
  .insert(products)
  .values(
    seed.products.map((p) => ({
      slug: p.slug,
      title: p.title,
      categoryId: categoryBySlug.get(p.category) ?? null,
      artworkImage: p.artworkImage,
      defaultMaterialId: materialByKey.get(p.finish) ?? null,
      number: p.number,
      description: p.description,
      isNew: p.isNew,
      specs: p.specs,
      active: true,
    })),
  )
  .returning()
const productBySlug = new Map(insertedProducts.map((p) => [p.slug, p.id]))
console.log(`  products        ${insertedProducts.length}`)

// Reviews: the written ones from the design, then rating-only rows so the histogram
// on the product page matches the 219 ratings it was drawn with.
const day = 24 * 60 * 60 * 1000
const reviewRows = seed.writtenReviews.map((r) => ({
  productId: productBySlug.get(r.product)!,
  authorName: r.authorName,
  rating: r.rating,
  title: r.title,
  body: r.body,
  verified: true,
  createdAt: new Date(Date.now() - r.daysAgo * day),
}))

const hero = productBySlug.get('white-maple-003')!
const written = new Map<number, number>()
for (const r of seed.writtenReviews) written.set(r.rating, (written.get(r.rating) ?? 0) + 1)

for (const [stars, total] of Object.entries(seed.ratingHistogram)) {
  const remaining = total - (written.get(Number(stars)) ?? 0)
  for (let i = 0; i < remaining; i++) {
    reviewRows.push({
      productId: hero,
      authorName: 'Verified buyer',
      rating: Number(stars),
      title: '',
      body: '',
      verified: true,
      createdAt: new Date(Date.now() - (5 + (i % 300)) * day),
    })
  }
}
await db.insert(reviews).values(reviewRows)
console.log(`  reviews         ${reviewRows.length}`)

// Aggregates are derived, never typed in.
await db.execute(sql`
  update products p set
    rating_count = agg.n,
    rating_tenths = agg.avg_tenths
  from (
    select product_id, count(*)::int n, round(avg(rating) * 10)::int avg_tenths
    from reviews group by product_id
  ) agg
  where agg.product_id = p.id
`)

await db.insert(coupons).values(seed.coupons)
console.log(`  coupons         ${seed.coupons.length}`)

await db.insert(settings).values(seed.settings)
console.log(`  settings        1`)

console.log('\nSeeded. Staff accounts are not seeded — they are created by signing in.')
process.exit(0)
