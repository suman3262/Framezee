import { and, eq } from 'drizzle-orm'
import { db } from '../db/index.ts'
import { categories, materialRates, materials, products, sizes } from '../db/schema.ts'
import { priceFrom, fmtIn, type Band, type Limits } from './pricing.ts'

export type FinishBands = { name: string; limits: Limits; bands: Band[] }

/** One load of everything the listing pages price against. */
export async function loadCatalog() {
  const [productRows, materialRows, rateRows, sizeRows, categoryRows] = await Promise.all([
    db
      .select({
        slug: products.slug,
        title: products.title,
        number: products.number,
        isNew: products.isNew,
        artwork: products.artworkImage,
        createdAt: products.createdAt,
        ratingTenths: products.ratingTenths,
        ratingCount: products.ratingCount,
        defaultMaterialId: products.defaultMaterialId,
        categorySlug: categories.slug,
        categoryName: categories.name,
      })
      .from(products)
      .leftJoin(categories, eq(products.categoryId, categories.id))
      .where(eq(products.active, true)),
    db.select().from(materials).where(eq(materials.active, true)),
    db.select().from(materialRates).where(eq(materialRates.active, true)),
    db.select().from(sizes).where(eq(sizes.active, true)).orderBy(sizes.sortOrder),
    db.select().from(categories).where(eq(categories.active, true)).orderBy(categories.sortOrder),
  ])

  const finishById = new Map<string, FinishBands & { swatch: string; kind: string; slug: string }>(
    materialRows.map((m) => [
      m.id,
      {
        name: m.name,
        swatch: m.swatch,
        kind: m.kind,
        slug: m.slug,
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
      },
    ]),
  )

  const sizeList = sizeRows.map((s) => ({
    widthTenths: s.widthTenths,
    heightTenths: s.heightTenths,
  }))

  const items = productRows.map((p) => {
    const finish = p.defaultMaterialId ? finishById.get(p.defaultMaterialId) : undefined
    // Which standard sizes this frame can actually be made at — the shop's size filter
    // asks that question, and it is cheaper to answer once here than per filter click.
    const makeableSizes = finish
      ? sizeList
          .filter((z) => priceFrom([z], finish) !== null)
          .map((z) => `${z.widthTenths}x${z.heightTenths}`)
      : []

    return {
      ...p,
      swatch: finish?.swatch ?? '#cccccc',
      kind: finish?.kind ?? null,
      finishSlug: finish?.slug ?? null,
      finishName: finish?.name ?? null,
      makeableSizes,
      fromPaise: finish ? priceFrom(sizeList, finish) : null,
      toPaise: finish ? dearestForSizes(sizeList, finish) : null,
    }
  })

  return { items, sizeList, categories: categoryRows, finishById, materials: materialRows }
}

/** The dearest makeable size, for the "₹140 – ₹2,800" range on the home page cards. */
function dearestForSizes(
  sizeList: Array<{ widthTenths: number; heightTenths: number }>,
  finish: FinishBands,
): number | null {
  const prices = sizeList.flatMap((s) => {
    const p = priceFrom([s], finish)
    return p === null ? [] : [p]
  })
  return prices.length ? Math.max(...prices) : null
}

/** The cheapest finish that can make a given size — what "from ₹x" means on a size tile. */
export function cheapestForSize(
  finishes: Iterable<FinishBands>,
  widthTenths: number,
  heightTenths: number,
): number | null {
  const prices: number[] = []
  for (const f of finishes) {
    const p = priceFrom([{ widthTenths, heightTenths }], f)
    if (p !== null) prices.push(p)
  }
  return prices.length ? Math.min(...prices) : null
}

/** "7 × 5 in" or "Square 4 in" — how a size is written throughout the shop. */
export const sizeLabel = (widthTenths: number, heightTenths: number) =>
  widthTenths === heightTenths
    ? `Square ${fmtIn(widthTenths)} in`
    : `${fmtIn(widthTenths)} × ${fmtIn(heightTenths)} in`
