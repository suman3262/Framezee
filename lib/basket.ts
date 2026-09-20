/**
 * Loads a customer's basket and prices it.
 *
 * One function, used by the basket page, the checkout page and order creation, so the
 * three can never disagree about what something costs. Prices are computed here every
 * time — nothing is read back from a stored number until an order exists.
 */

import { eq } from 'drizzle-orm'
import { db } from '../db/index.ts'
import {
  cartItems,
  carts,
  coupons,
  customDesigns,
  glazingOptions,
  glazingRates,
  materialRates,
  materials,
  paperQualities,
  paperRates,
  products,
  settings,
} from '../db/schema.ts'
import { loadMatBands, MAT_NAME } from './frame-catalog.ts'
import { priceLine, PriceError, type LineBreakdown } from './pricing.ts'
import { applyCoupon, type Coupon, type CouponResult } from './coupons.ts'
import type { DraftLine } from './orders.ts'

export type BasketLine = {
  id: string
  draft: DraftLine | null
  error: string | null
  /** For the UI: what to show even when this line can no longer be priced. */
  display: {
    title: string
    slug: string | null
    artwork: string | null
    materialName: string
    swatch: string
    widthTenths: number
    heightTenths: number
    thicknessTenths: number
    matBoard: boolean
    paperName: string | null
    glazingName: string | null
    qty: number
    printImagePath: string | null
  }
  breakdown: LineBreakdown | null
}

export type Basket = {
  cartId: string | null
  lines: BasketLine[]
  subtotalPaise: number
  coupon: Coupon | null
  couponResult: CouponResult | null
  settings: typeof settings.$inferSelect | null
}

export async function loadBasket(userId: string, customerOrderCount = 0): Promise<Basket> {
  const [cart] = await db.select().from(carts).where(eq(carts.userId, userId)).limit(1)
  const [config] = await db.select().from(settings).limit(1)

  if (!cart)
    return { cartId: null, lines: [], subtotalPaise: 0, coupon: null, couponResult: null, settings: config ?? null }

  const [rows, rateRows, paperRateRows, glazingRateRows, matBands] = await Promise.all([
    db
      .select({
        item: cartItems,
        productSlug: products.slug,
        productArtwork: products.artworkImage,
        productTitle: products.title,
        material: materials,
        paperName: paperQualities.name,
        paperId: paperQualities.id,
        paperHsn: paperQualities.hsnCode,
        glazingName: glazingOptions.name,
        glazingId: glazingOptions.id,
        design: customDesigns,
      })
      .from(cartItems)
      .leftJoin(products, eq(cartItems.productId, products.id))
      .innerJoin(materials, eq(cartItems.materialId, materials.id))
      .leftJoin(paperQualities, eq(cartItems.paperQualityId, paperQualities.id))
      .leftJoin(glazingOptions, eq(cartItems.glazingOptionId, glazingOptions.id))
      .leftJoin(customDesigns, eq(cartItems.customDesignId, customDesigns.id))
      .where(eq(cartItems.cartId, cart.id))
      .orderBy(cartItems.createdAt),
    db.select().from(materialRates).where(eq(materialRates.active, true)),
    db.select().from(paperRates).where(eq(paperRates.active, true)),
    db.select().from(glazingRates).where(eq(glazingRates.active, true)),
    loadMatBands(),
  ])

  const lines: BasketLine[] = rows.map((r) => {
    const display = {
      title: r.productTitle ?? 'Custom frame',
      slug: r.productSlug,
      artwork: r.productArtwork,
      materialName: r.material.name,
      swatch: r.material.swatch,
      widthTenths: r.item.widthTenths,
      heightTenths: r.item.heightTenths,
      thicknessTenths: r.item.thicknessTenths,
      matBoard: r.item.matBoard,
      paperName: r.item.printService ? r.paperName : null,
      glazingName: r.glazingName,
      qty: r.item.qty,
      printImagePath: r.design?.printImagePath ?? null,
    }

    try {
      const breakdown = priceLine({
        widthTenths: r.item.widthTenths,
        heightTenths: r.item.heightTenths,
        qty: r.item.qty,
        material: {
          name: r.material.name,
          // The range was enforced when the item was added; re-pricing only needs bands.
          limits: { minWidthTenths: 0, maxWidthTenths: 100_000, minHeightTenths: 0, maxHeightTenths: 100_000 },
          bands: bandsOf(rateRows, 'materialId', r.material.id),
        },
        paper:
          r.item.printService && r.paperId
            ? { name: r.paperName ?? 'Print', bands: bandsOf(paperRateRows, 'paperQualityId', r.paperId) }
            : undefined,
        glazing: r.glazingId
          ? { name: r.glazingName ?? 'Glazing', bands: bandsOf(glazingRateRows, 'glazingOptionId', r.glazingId) }
          : undefined,
        // Free while mat_rates is empty; the moment a band exists every basket reprices.
        mat: r.item.matBoard ? { name: MAT_NAME, bands: matBands } : undefined,
      })

      const draft: DraftLine = {
        kind: r.item.kind,
        title: display.title,
        widthTenths: r.item.widthTenths,
        heightTenths: r.item.heightTenths,
        materialName: r.material.name,
        paperName: display.paperName,
        glazingName: r.glazingName,
        matColour: r.design?.matColour ?? null,
        matBoard: r.item.matBoard,
        thicknessTenths: r.item.thicknessTenths,
        printService: r.item.printService,
        qty: r.item.qty,
        gstRateBp: r.material.gstRateBp,
        hsnCode: r.material.hsnCode,
        printImagePath: r.design?.printImagePath ?? null,
        breakdown,
      }

      return { id: r.item.id, draft, error: null, display, breakdown }
    } catch (e) {
      return {
        id: r.item.id,
        draft: null,
        error: e instanceof PriceError ? e.message : 'This frame is no longer available.',
        display,
        breakdown: null,
      }
    }
  })

  const subtotalPaise = lines.reduce((a, l) => a + (l.breakdown?.linePaise ?? 0), 0)

  let coupon: Coupon | null = null
  let couponResult: CouponResult | null = null

  if (cart.couponCode) {
    const [row] = await db.select().from(coupons).where(eq(coupons.code, cart.couponCode)).limit(1)
    coupon = row ? toCoupon(row) : null
    couponResult = applyCoupon(coupon, { subtotalPaise, customerOrderCount })
  }

  return { cartId: cart.id, lines, subtotalPaise, coupon, couponResult, settings: config ?? null }
}

export function toCoupon(row: typeof coupons.$inferSelect): Coupon {
  return {
    code: row.code,
    type: row.type,
    value: row.value,
    minOrderPaise: row.minOrderPaise,
    maxDiscountPaise: row.maxDiscountPaise,
    newCustomersOnly: row.newCustomersOnly,
    startsAt: row.startsAt,
    endsAt: row.endsAt,
    usageLimit: row.usageLimit,
    usedCount: row.usedCount,
    active: row.active,
  }
}

/** Shipping, decided after the discount — a coupon can drop an order back under the bar. */
export function shippingFor(
  subtotalPaise: number,
  discountPaise: number,
  config: { flatShippingPaise: number; freeShippingThresholdPaise: number | null } | null,
): number {
  if (!config || subtotalPaise === 0) return 0
  const after = subtotalPaise - discountPaise
  if (config.freeShippingThresholdPaise !== null && after >= config.freeShippingThresholdPaise)
    return 0
  return config.flatShippingPaise
}

function bandsOf<T extends Record<string, unknown>>(rows: T[], key: keyof T, id: string) {
  return rows
    .filter((r) => r[key] === id)
    .map((r) => ({
      maxWidthTenths: r.maxWidthTenths as number,
      maxHeightTenths: r.maxHeightTenths as number,
      ratePaisePerSqIn: r.ratePaisePerSqIn as number,
    }))
}
