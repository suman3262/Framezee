'use server'

import { and, eq, ne, sql } from 'drizzle-orm'
import { revalidatePath, revalidateTag } from 'next/cache'
import { CATALOG_TAG } from '@/lib/storefront.ts'
import { db } from '@/db/index.ts'
import {
  glazingOptions,
  glazingRates,
  materialRates,
  materials,
  orderItems,
  paperQualities,
  paperRates,
  products,
} from '@/db/schema.ts'
import { requireSuperAdmin } from '@/lib/auth.ts'

export type MaterialResult = { error?: string; ok?: string }

function slugify(v: string): string {
  return v.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40)
}

async function freeSlug(table: typeof materials | typeof glazingOptions, base: string, exceptId?: string) {
  for (let n = 0; n < 50; n++) {
    const slug = n === 0 ? base : `${base}-${n + 1}`
    const clash = await db
      .select({ id: table.id })
      .from(table)
      .where(exceptId ? and(eq(table.slug, slug), ne(table.id, exceptId)) : eq(table.slug, slug))
      .limit(1)
    if (clash.length === 0) return slug
  }
  return `${base}-${Date.now()}`
}

/** Inches in the form, tenths in the database. "12.5" → 125. */
function tenths(v: FormDataEntryValue | null): number | null {
  const n = Number(String(v ?? '').trim())
  if (!Number.isFinite(n) || n <= 0) return null
  const t = Math.round(n * 10)
  return t > 0 && t <= 12_000 ? t : null
}

/** "12" (percent) → 1200 basis points. */
function basisPoints(v: FormDataEntryValue | null): number | null {
  const n = Number(String(v ?? '').trim())
  if (!Number.isFinite(n) || n < 0 || n > 100) return null
  return Math.round(n * 100)
}

const text = (v: FormDataEntryValue | null) => {
  const s = String(v ?? '').trim()
  return s === '' ? null : s
}

// ── mouldings ───────────────────────────────────────────────────────────────

type MaterialFields = {
  name: string
  kind: string
  swatch: string
  description: string | null
  gstRateBp: number
  hsnCode: string | null
  minWidthTenths: number
  maxWidthTenths: number
  minHeightTenths: number
  maxHeightTenths: number
}

function readMaterial(form: FormData): MaterialFields | string {
  const name = String(form.get('name') ?? '').trim().replace(/\s+/g, ' ')
  if (name.length < 2 || name.length > 40) return 'Give the moulding a name between 2 and 40 characters.'

  const gstRateBp = basisPoints(form.get('gstRate'))
  if (gstRateBp === null) return 'GST must be a percentage between 0 and 100.'

  const minW = tenths(form.get('minWidth'))
  const maxW = tenths(form.get('maxWidth'))
  const minH = tenths(form.get('minHeight'))
  const maxH = tenths(form.get('maxHeight'))
  if (!minW || !maxW || !minH || !maxH) return 'Every size limit must be a positive number of inches.'
  if (minW > maxW || minH > maxH) return 'A minimum size cannot be larger than its maximum.'

  const swatch = String(form.get('swatch') ?? '').trim()
  if (!/^#[0-9a-fA-F]{6}$/.test(swatch)) return 'The swatch must be a colour like #8b5e3c.'

  return {
    name,
    kind: String(form.get('kind') ?? 'wood').trim() || 'wood',
    swatch,
    description: text(form.get('description')),
    gstRateBp,
    hsnCode: text(form.get('hsnCode')),
    minWidthTenths: minW,
    maxWidthTenths: maxW,
    minHeightTenths: minH,
    maxHeightTenths: maxH,
  }
}

/**
 * A new moulding starts hidden with one rate band.
 *
 * Hidden matters: the instant a moulding is offered it appears as a finish chip on every
 * frame in the shop, so one with no considered rate would start selling at whatever was
 * typed first. Offer it once the rate card is right.
 */
export async function createMaterial(_prev: MaterialResult, form: FormData): Promise<MaterialResult> {
  await requireSuperAdmin()

  const f = readMaterial(form)
  if (typeof f === 'string') return { error: f }

  const rate = Number(String(form.get('rate') ?? '').trim())
  if (!Number.isFinite(rate) || rate <= 0) return { error: 'Give a starting rate in rupees per square inch.' }
  if (rate > 9999) return { error: `₹${rate}/sq-in looks like a typo — a 12 × 16 in frame would cost ₹${Math.round(rate * 192)}.` }

  const slug = await freeSlug(materials, slugify(f.name))

  await db.transaction(async (tx) => {
    const [made] = await tx.insert(materials).values({ ...f, slug, active: false }).returning()
    await tx.insert(materialRates).values({
      materialId: made.id,
      maxWidthTenths: f.maxWidthTenths,
      maxHeightTenths: f.maxHeightTenths,
      ratePaisePerSqIn: Math.round(rate * 100),
    })
  })

  revalidatePath('/admin/pricing')
  return { ok: `${f.name} added, hidden for now. Check the rate card, then mark it Offered.` }
}

export async function updateMaterial(_prev: MaterialResult, form: FormData): Promise<MaterialResult> {
  await requireSuperAdmin()

  const id = String(form.get('id') ?? '')
  const [before] = await db.select().from(materials).where(eq(materials.id, id)).limit(1)
  if (!before) return { error: 'That moulding no longer exists.' }

  const f = readMaterial(form)
  if (typeof f === 'string') return { error: f }

  await db.update(materials).set(f).where(eq(materials.id, id))

  revalidatePath('/admin/pricing')
  revalidatePath('/browse')
  revalidateTag(CATALOG_TAG, 'max')
  return {
    ok:
      f.name === before.name
        ? `${f.name} saved.`
        : `Renamed to ${f.name}. Past orders keep the old name on their invoice.`,
  }
}

/**
 * Deleting a moulding is refused while anything still points at it.
 *
 * Order items store the name as frozen text, so an invoice survives — but a product whose
 * preselected finish vanished would have no price at all, and its rate bands would go with
 * it. Hiding removes it from the shop and keeps every existing frame priceable.
 */
export async function deleteMaterial(_prev: MaterialResult, form: FormData): Promise<MaterialResult> {
  await requireSuperAdmin()

  const id = String(form.get('id') ?? '')
  const [row] = await db.select().from(materials).where(eq(materials.id, id)).limit(1)
  if (!row) return { error: 'That moulding no longer exists.' }

  const [{ n }] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(products)
    .where(eq(products.defaultMaterialId, id))
  if (n > 0)
    return {
      error: `${n} frame${n === 1 ? ' uses' : 's use'} ${row.name} as their preselected finish. Point them elsewhere first, or hide this one.`,
    }

  const [{ sold }] = await db
    .select({ sold: sql<number>`count(*)::int` })
    .from(orderItems)
    .where(eq(orderItems.materialName, row.name))
  if (sold > 0)
    return {
      error: `${row.name} appears on ${sold} order line${sold === 1 ? '' : 's'}. Hide it instead — deleting loses the rate card behind those invoices.`,
    }

  await db.delete(materials).where(eq(materials.id, id))
  revalidatePath('/admin/pricing')
  revalidatePath('/browse')
  revalidateTag(CATALOG_TAG, 'max')
  return { ok: `${row.name} deleted.` }
}

// ── glazing ─────────────────────────────────────────────────────────────────

export async function createGlazing(_prev: MaterialResult, form: FormData): Promise<MaterialResult> {
  await requireSuperAdmin()

  const name = String(form.get('name') ?? '').trim()
  if (name.length < 2) return { error: 'Give the glazing a name.' }

  const gstRateBp = basisPoints(form.get('gstRate'))
  if (gstRateBp === null) return { error: 'GST must be a percentage between 0 and 100.' }

  const included = String(form.get('included') ?? '') === 'on'
  const rate = Number(String(form.get('rate') ?? '').trim())
  if (!included && (!Number.isFinite(rate) || rate <= 0))
    return { error: 'An upgrade needs a rate. Tick "included in the frame price" if it is free.' }

  const [{ n }] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(glazingOptions)
    .where(eq(glazingOptions.included, true))
  if (included && n > 0)
    return { error: 'There is already an included glazing. Only one can be part of the frame price.' }

  const slug = await freeSlug(glazingOptions, slugify(name))
  const [{ next }] = await db
    .select({ next: sql<number>`coalesce(max(${glazingOptions.sortOrder}), -1) + 1` })
    .from(glazingOptions)

  await db.transaction(async (tx) => {
    const [made] = await tx
      .insert(glazingOptions)
      .values({
        slug,
        name,
        description: text(form.get('description')),
        included,
        gstRateBp,
        hsnCode: text(form.get('hsnCode')),
        sortOrder: Number(next),
        active: true,
      })
      .returning()

    // An included glazing carries no bands at all — that absence is what makes it free.
    if (!included)
      await tx.insert(glazingRates).values({
        glazingOptionId: made.id,
        maxWidthTenths: 600,
        maxHeightTenths: 600,
        ratePaisePerSqIn: Math.round(rate * 100),
      })
  })

  revalidatePath('/admin/pricing')
  return { ok: `${name} added.` }
}

export async function deleteGlazing(_prev: MaterialResult, form: FormData): Promise<MaterialResult> {
  await requireSuperAdmin()

  const id = String(form.get('id') ?? '')
  const [row] = await db.select().from(glazingOptions).where(eq(glazingOptions.id, id)).limit(1)
  if (!row) return { error: 'That glazing no longer exists.' }

  if (row.included)
    return {
      error: 'This is the glazing included in the frame price. Every frame needs one, so it cannot be deleted.',
    }

  const [{ sold }] = await db
    .select({ sold: sql<number>`count(*)::int` })
    .from(orderItems)
    .where(eq(orderItems.glazingName, row.name))
  if (sold > 0)
    return { error: `${row.name} is on ${sold} order line${sold === 1 ? '' : 's'}. Hide it instead.` }

  await db.delete(glazingOptions).where(eq(glazingOptions.id, id))
  revalidatePath('/admin/pricing')
  return { ok: `${row.name} deleted.` }
}

// ── print papers ────────────────────────────────────────────────────────────

export async function createPaper(_prev: MaterialResult, form: FormData): Promise<MaterialResult> {
  await requireSuperAdmin()

  const name = String(form.get('name') ?? '').trim()
  if (name.length < 2) return { error: 'Give the paper a name.' }

  const gstRateBp = basisPoints(form.get('gstRate'))
  if (gstRateBp === null) return { error: 'GST must be a percentage between 0 and 100.' }

  const rate = Number(String(form.get('rate') ?? '').trim())
  if (!Number.isFinite(rate) || rate <= 0) return { error: 'Give a rate in rupees per square inch.' }

  await db.transaction(async (tx) => {
    const [made] = await tx
      .insert(paperQualities)
      .values({
        name,
        description: text(form.get('description')),
        gstRateBp,
        hsnCode: text(form.get('hsnCode')),
        active: true,
      })
      .returning()
    await tx.insert(paperRates).values({
      paperQualityId: made.id,
      maxWidthTenths: 600,
      maxHeightTenths: 600,
      ratePaisePerSqIn: Math.round(rate * 100),
    })
  })

  revalidatePath('/admin/pricing')
  return { ok: `${name} added.` }
}

export async function deletePaper(_prev: MaterialResult, form: FormData): Promise<MaterialResult> {
  await requireSuperAdmin()

  const id = String(form.get('id') ?? '')
  const [row] = await db.select().from(paperQualities).where(eq(paperQualities.id, id)).limit(1)
  if (!row) return { error: 'That paper no longer exists.' }

  const [{ sold }] = await db
    .select({ sold: sql<number>`count(*)::int` })
    .from(orderItems)
    .where(eq(orderItems.paperName, row.name))
  if (sold > 0)
    return { error: `${row.name} is on ${sold} order line${sold === 1 ? '' : 's'}. Hide it instead.` }

  await db.delete(paperQualities).where(eq(paperQualities.id, id))
  revalidatePath('/admin/pricing')
  return { ok: `${row.name} deleted.` }
}
