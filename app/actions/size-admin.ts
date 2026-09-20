'use server'

import { and, eq, sql } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'
import { db } from '@/db/index.ts'
import { frameThicknesses, matRates, sizes } from '@/db/schema.ts'
import { requireSuperAdmin } from '@/lib/auth.ts'
import { shapeOf } from '@/lib/frame-options.ts'

export type SizeResult = { error?: string; ok?: string }

/** Inches in the form, tenths in the database. Accepts "12" and "12.5". */
function tenths(v: FormDataEntryValue | null): number | null {
  const n = Number(String(v ?? '').trim())
  if (!Number.isFinite(n) || n <= 0) return null
  const t = Math.round(n * 10)
  return t >= 10 && t <= 12_000 ? t : null
}

const inches = (t: number) => (t / 10).toString()

// ── the "Shop by Size" list ─────────────────────────────────────────────────

/**
 * Sizes are global, not per-product: a frame offers whichever of these its moulding can
 * physically cut. Adding one here offers it on every frame whose moulding covers it.
 */
export async function addSize(_prev: SizeResult, form: FormData): Promise<SizeResult> {
  await requireSuperAdmin()

  const w = tenths(form.get('width'))
  const h = tenths(form.get('height'))
  if (!w || !h) return { error: 'Width and height must be at least 1 inch.' }

  const [clash] = await db
    .select({ id: sizes.id })
    .from(sizes)
    .where(and(eq(sizes.widthTenths, w), eq(sizes.heightTenths, h)))
    .limit(1)
  if (clash) return { error: `${inches(w)} × ${inches(h)} in is already on the list.` }

  const [{ next }] = await db
    .select({ next: sql<number>`coalesce(max(${sizes.sortOrder}), -1) + 1` })
    .from(sizes)

  await db.insert(sizes).values({
    widthTenths: w,
    heightTenths: h,
    sortOrder: Number(next),
    active: String(form.get('active') ?? '') === 'on',
  })

  revalidatePath('/admin/pricing')
  revalidatePath('/sizes')
  revalidatePath('/browse')
  return { ok: `${inches(w)} × ${inches(h)} in added — a ${shapeOf(w, h)} size.` }
}

export async function toggleSize(form: FormData): Promise<void> {
  await requireSuperAdmin()
  const id = String(form.get('id') ?? '')
  if (!id) return
  await db
    .update(sizes)
    .set({ active: String(form.get('active')) === 'true' })
    .where(eq(sizes.id, id))
  revalidatePath('/admin/pricing')
  revalidatePath('/sizes')
  revalidatePath('/browse')
}

/**
 * Deleting a size is safe: order items store their own width and height as numbers, so
 * nothing about a past order depends on this row still existing.
 */
export async function deleteSize(form: FormData): Promise<void> {
  await requireSuperAdmin()
  const id = String(form.get('id') ?? '')
  if (!id) return
  await db.delete(sizes).where(eq(sizes.id, id))
  revalidatePath('/admin/pricing')
  revalidatePath('/sizes')
  revalidatePath('/browse')
}

// ── frame thickness ─────────────────────────────────────────────────────────

export async function addThickness(_prev: SizeResult, form: FormData): Promise<SizeResult> {
  await requireSuperAdmin()

  const t = tenths(form.get('thickness'))
  if (!t) return { error: 'The thickness must be at least 0.1 inch.' }

  const label = String(form.get('label') ?? '').trim()
  if (!label) return { error: 'Give it a label, such as "2 inch".' }

  const [clash] = await db
    .select({ id: frameThicknesses.id })
    .from(frameThicknesses)
    .where(eq(frameThicknesses.tenths, t))
    .limit(1)
  if (clash) return { error: `${inches(t)} inch is already on the list.` }

  // Blank means no limit — most thicknesses fit any frame.
  const maxLong = tenths(form.get('maxLong'))
  const maxShort = tenths(form.get('maxShort'))
  if (maxLong && maxShort && maxShort > maxLong)
    return { error: 'The short-side limit cannot be larger than the long-side one.' }

  const [{ next }] = await db
    .select({ next: sql<number>`coalesce(max(${frameThicknesses.sortOrder}), -1) + 1` })
    .from(frameThicknesses)

  await db.insert(frameThicknesses).values({
    tenths: t,
    label,
    maxLongTenths: maxLong,
    maxShortTenths: maxShort,
    sortOrder: Number(next),
    active: true,
  })

  revalidatePath('/admin/pricing')
  revalidatePath('/custom')
  return { ok: `${label} added.` }
}

export async function updateThickness(_prev: SizeResult, form: FormData): Promise<SizeResult> {
  await requireSuperAdmin()

  const id = String(form.get('id') ?? '')
  const label = String(form.get('label') ?? '').trim()
  if (!label) return { error: 'Give it a label.' }

  const maxLong = tenths(form.get('maxLong'))
  const maxShort = tenths(form.get('maxShort'))
  if (maxLong && maxShort && maxShort > maxLong)
    return { error: 'The short-side limit cannot be larger than the long-side one.' }

  await db
    .update(frameThicknesses)
    .set({ label, maxLongTenths: maxLong, maxShortTenths: maxShort })
    .where(eq(frameThicknesses.id, id))

  revalidatePath('/admin/pricing')
  revalidatePath('/custom')
  return { ok: `${label} saved.` }
}

export async function toggleThickness(form: FormData): Promise<void> {
  await requireSuperAdmin()
  const id = String(form.get('id') ?? '')
  const active = String(form.get('active')) === 'true'
  if (!id) return

  // Turning the last one off would leave every frame with no thickness to choose.
  if (!active) {
    const [{ n }] = await db
      .select({ n: sql<number>`count(*)::int` })
      .from(frameThicknesses)
      .where(eq(frameThicknesses.active, true))
    if (n <= 1) return
  }

  await db.update(frameThicknesses).set({ active }).where(eq(frameThicknesses.id, id))
  revalidatePath('/admin/pricing')
  revalidatePath('/custom')
}

// ── mat board ───────────────────────────────────────────────────────────────

/**
 * The mat is free while this table is empty. Adding the first band starts charging for
 * it across the whole shop at once — baskets reprice on their next load, and orders
 * already placed keep their frozen totals.
 */
export async function addMatBand(_prev: SizeResult, form: FormData): Promise<SizeResult> {
  await requireSuperAdmin()

  const w = tenths(form.get('maxWidth'))
  const h = tenths(form.get('maxHeight'))
  if (!w || !h) return { error: 'Give the size this band covers, in inches.' }

  const rate = Number(String(form.get('rate') ?? '').trim())
  if (!Number.isFinite(rate) || rate <= 0)
    return { error: 'Give a rate in rupees per square inch, or leave the mat free by adding no band.' }
  if (rate > 9999)
    return { error: `₹${rate}/sq-in looks like a typo — a 12 × 16 in mat would cost ₹${Math.round(rate * 192)}.` }

  await db.insert(matRates).values({
    maxWidthTenths: w,
    maxHeightTenths: h,
    ratePaisePerSqIn: Math.round(rate * 100),
    active: true,
  })

  revalidatePath('/admin/pricing')
  revalidatePath('/browse')
  return {
    ok: `Mat board now costs ₹${rate.toFixed(2)}/sq-in up to ${inches(w)} × ${inches(h)} in. Every basket reprices on its next load.`,
  }
}

export async function deleteMatBand(form: FormData): Promise<void> {
  await requireSuperAdmin()
  const id = String(form.get('id') ?? '')
  if (!id) return
  await db.delete(matRates).where(eq(matRates.id, id))
  revalidatePath('/admin/pricing')
  revalidatePath('/browse')
}
