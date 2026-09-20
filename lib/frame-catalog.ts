import { asc, eq } from 'drizzle-orm'
import { db } from '../db/index.ts'
import { frameThicknesses, matRates } from '../db/schema.ts'
import type { Thickness } from './frame-options.ts'
import type { Band } from './pricing.ts'

/**
 * The two option sets that used to be constants in code: how thick a moulding can be,
 * and what a mat costs. Both are rows now, so the super-admin changes them without a
 * deploy.
 */

export async function loadThicknesses(): Promise<Thickness[]> {
  const rows = await db
    .select()
    .from(frameThicknesses)
    .where(eq(frameThicknesses.active, true))
    .orderBy(asc(frameThicknesses.sortOrder))

  return rows.map((t) => ({
    tenths: t.tenths,
    label: t.label,
    maxLongTenths: t.maxLongTenths,
    maxShortTenths: t.maxShortTenths,
  }))
}

/** Empty means the mat is free at every size — see lib/pricing.ts. */
export async function loadMatBands(): Promise<Band[]> {
  const rows = await db.select().from(matRates).where(eq(matRates.active, true))
  return rows.map((r) => ({
    maxWidthTenths: r.maxWidthTenths,
    maxHeightTenths: r.maxHeightTenths,
    ratePaisePerSqIn: r.ratePaisePerSqIn,
  }))
}

export const MAT_NAME = 'Acid-free mat board'
