'use server'

import { desc, eq } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'
import { db } from '@/db/index.ts'
import { coupons } from '@/db/schema.ts'
import { requireSuperAdmin } from '@/lib/auth.ts'
import { parseRupees } from '@/lib/rate-input.ts'

export type CouponSaveResult = { error?: string; ok?: string }

function parsePercent(raw: unknown): { ok: true; bp: number } | { ok: false; message: string } {
  const value = Number(String(raw ?? '').trim())
  if (!Number.isFinite(value)) return { ok: false, message: 'Enter a percentage.' }
  if (value <= 0) return { ok: false, message: 'A discount of zero gives nothing away.' }
  if (value > 90) return { ok: false, message: 'Over 90% off is almost certainly a typo.' }
  return { ok: true, bp: Math.round(value * 100) }
}

export async function saveCoupon(_prev: CouponSaveResult, form: FormData): Promise<CouponSaveResult> {
  await requireSuperAdmin()

  const id = String(form.get('id') ?? '')
  const code = String(form.get('code') ?? '').trim().toUpperCase()
  const type = String(form.get('type') ?? 'percent') as 'percent' | 'flat'

  if (!/^[A-Z0-9]{3,20}$/.test(code))
    return { error: 'A code is 3–20 letters and digits, no spaces — customers have to type it.' }
  if (type !== 'percent' && type !== 'flat') return { error: 'Unknown discount type.' }

  let value: number
  if (type === 'percent') {
    const pct = parsePercent(form.get('value'))
    if (!pct.ok) return { error: pct.message }
    value = pct.bp
  } else {
    const flat = parseRupees(form.get('value'), 'value')
    if (!flat.ok) return { error: flat.error.message }
    value = flat.paise
  }

  const min = parseRupees(form.get('minOrder'), 'minOrder', { allowZero: true })
  if (!min.ok) return { error: min.error.message }

  const capRaw = String(form.get('maxDiscount') ?? '').trim()
  let cap: number | null = null
  if (capRaw !== '') {
    const parsed = parseRupees(capRaw, 'maxDiscount')
    if (!parsed.ok) return { error: parsed.error.message }
    cap = parsed.paise
  }

  const limitRaw = String(form.get('usageLimit') ?? '').trim()
  let usageLimit: number | null = null
  if (limitRaw !== '') {
    const n = Number(limitRaw)
    if (!Number.isInteger(n) || n < 1) return { error: 'A usage limit is a whole number of uses.' }
    usageLimit = n
  }

  const endsRaw = String(form.get('endsAt') ?? '').trim()
  const endsAt = endsRaw ? new Date(endsRaw) : null
  if (endsAt && Number.isNaN(endsAt.getTime())) return { error: 'That end date is not valid.' }

  const row = {
    code,
    type,
    value,
    minOrderPaise: min.paise,
    maxDiscountPaise: cap,
    newCustomersOnly: form.get('newCustomersOnly') === 'on',
    endsAt,
    usageLimit,
    active: form.get('active') === 'on',
  }

  if (id) {
    await db.update(coupons).set(row).where(eq(coupons.id, id))
  } else {
    const [clash] = await db.select().from(coupons).where(eq(coupons.code, code)).limit(1)
    if (clash) return { error: `${code} already exists.` }
    await db.insert(coupons).values(row)
  }

  revalidatePath('/admin/coupons')
  revalidatePath('/', 'layout') // the storefront ticker shows codes
  return { ok: `${code} saved.` }
}

export async function toggleCoupon(form: FormData): Promise<void> {
  await requireSuperAdmin()
  const id = String(form.get('id') ?? '')
  const active = String(form.get('active')) === 'true'
  if (!id) return
  await db.update(coupons).set({ active }).where(eq(coupons.id, id))
  revalidatePath('/admin/coupons')
  revalidatePath('/', 'layout')
}
