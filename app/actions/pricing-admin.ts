'use server'

import { and, eq } from 'drizzle-orm'
import { revalidatePath, revalidateTag } from 'next/cache'
import { db } from '@/db/index.ts'
import {
  glazingOptions,
  glazingRates,
  materialRates,
  materials,
  paperQualities,
  paperRates,
  settings,
} from '@/db/schema.ts'
import { requireSuperAdmin } from '@/lib/auth.ts'
import { parseInches, parseRupees, checkBandSet } from '@/lib/rate-input.ts'

export type SaveResult = { error?: string; ok?: string }

/** Everything priced here changes the shop, so every page that shows a price is refreshed. */
function refreshPricedPages() {
  revalidatePath('/admin/pricing')
  revalidatePath('/', 'layout')
}

const TABLES = {
  material: { rates: materialRates, fk: materialRates.materialId },
  paper: { rates: paperRates, fk: paperRates.paperQualityId },
  glazing: { rates: glazingRates, fk: glazingRates.glazingOptionId },
} as const

type Kind = keyof typeof TABLES

export async function addRateBand(_prev: SaveResult, form: FormData): Promise<SaveResult> {
  await requireSuperAdmin()

  const kind = String(form.get('kind') ?? '') as Kind
  const ownerId = String(form.get('ownerId') ?? '')
  if (!TABLES[kind] || !ownerId) return { error: 'Unknown rate card.' }

  const w = parseInches(form.get('maxWidth'), 'maxWidth')
  if (!w.ok) return { error: w.error.message }
  const h = parseInches(form.get('maxHeight'), 'maxHeight')
  if (!h.ok) return { error: h.error.message }
  const rate = parseRupees(form.get('rate'), 'rate')
  if (!rate.ok) return { error: rate.error.message }

  const t = TABLES[kind]
  const existing = await db.select().from(t.rates).where(eq(t.fk, ownerId))
  const problems = checkBandSet([
    ...existing.map((b) => ({
      maxWidthTenths: b.maxWidthTenths,
      maxHeightTenths: b.maxHeightTenths,
      ratePaisePerSqIn: b.ratePaisePerSqIn,
    })),
    { maxWidthTenths: w.tenths, maxHeightTenths: h.tenths, ratePaisePerSqIn: rate.paise },
  ])
  const clash = problems.find((p) => /both stop at/.test(p.message))
  if (clash) return { error: clash.message }

  await db.insert(t.rates).values({
    [kind === 'material' ? 'materialId' : kind === 'paper' ? 'paperQualityId' : 'glazingOptionId']: ownerId,
    maxWidthTenths: w.tenths,
    maxHeightTenths: h.tenths,
    ratePaisePerSqIn: rate.paise,
  } as never)

  refreshPricedPages()
  return { ok: `Band added at ₹${(rate.paise / 100).toFixed(2)}/sq·in.` }
}

export async function updateRateBand(_prev: SaveResult, form: FormData): Promise<SaveResult> {
  await requireSuperAdmin()

  const kind = String(form.get('kind') ?? '') as Kind
  const id = String(form.get('id') ?? '')
  if (!TABLES[kind] || !id) return { error: 'Unknown rate band.' }

  const rate = parseRupees(form.get('rate'), 'rate')
  if (!rate.ok) return { error: rate.error.message }

  await db.update(TABLES[kind].rates).set({ ratePaisePerSqIn: rate.paise }).where(eq(TABLES[kind].rates.id, id))
  refreshPricedPages()
  return { ok: 'Rate saved.' }
}

export async function deleteRateBand(form: FormData): Promise<void> {
  await requireSuperAdmin()
  const kind = String(form.get('kind') ?? '') as Kind
  const id = String(form.get('id') ?? '')
  const ownerId = String(form.get('ownerId') ?? '')
  if (!TABLES[kind] || !id) return

  const t = TABLES[kind]
  const remaining = await db.select().from(t.rates).where(and(eq(t.fk, ownerId)))
  // A moulding with no bands cannot be priced at all, so the last one cannot be removed.
  if (kind === 'material' && remaining.length <= 1) return

  await db.delete(t.rates).where(eq(t.rates.id, id))
  refreshPricedPages()
}

export async function saveStoreSettings(_prev: SaveResult, form: FormData): Promise<SaveResult> {
  await requireSuperAdmin()

  const shipping = parseRupees(form.get('flatShipping'), 'flatShipping', { allowZero: true })
  if (!shipping.ok) return { error: shipping.error.message }

  const thresholdRaw = String(form.get('freeThreshold') ?? '').trim()
  let threshold: number | null = null
  if (thresholdRaw !== '') {
    const parsed = parseRupees(thresholdRaw, 'freeThreshold', { allowZero: true })
    if (!parsed.ok) return { error: parsed.error.message }
    threshold = parsed.paise
  }

  const gstin = String(form.get('sellerGstin') ?? '').trim().toUpperCase()
  const gstEnabled = form.get('gstEnabled') === 'on'

  // Turning GST on without a GSTIN would put a blank number on every invoice.
  if (gstEnabled && !/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][0-9A-Z]{3}$/.test(gstin))
    return { error: 'Enter a valid 15-character GSTIN before switching GST on.' }

  await db
    .update(settings)
    .set({
      flatShippingPaise: shipping.paise,
      freeShippingThresholdPaise: threshold,
      sellerGstin: gstin || null,
      sellerState: String(form.get('sellerState') ?? 'West Bengal').trim(),
      gstEnabled,
      codEnabled: form.get('codEnabled') === 'on',
    })
    .where(eq(settings.id, 1))

  refreshPricedPages()
  return { ok: 'Store settings saved.' }
}

export async function toggleMaterial(form: FormData): Promise<void> {
  await requireSuperAdmin()
  const id = String(form.get('id') ?? '')
  const active = String(form.get('active')) === 'true'
  if (!id) return
  await db.update(materials).set({ active }).where(eq(materials.id, id))
  refreshPricedPages()
}

export async function toggleGlazing(form: FormData): Promise<void> {
  await requireSuperAdmin()
  const id = String(form.get('id') ?? '')
  const active = String(form.get('active')) === 'true'
  if (!id) return
  await db.update(glazingOptions).set({ active }).where(eq(glazingOptions.id, id))
  refreshPricedPages()
}

export async function togglePaper(form: FormData): Promise<void> {
  await requireSuperAdmin()
  const id = String(form.get('id') ?? '')
  const active = String(form.get('active')) === 'true'
  if (!id) return
  await db.update(paperQualities).set({ active }).where(eq(paperQualities.id, id))
  refreshPricedPages()
}
