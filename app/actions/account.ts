'use server'

import { and, eq, ne } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'
import { db } from '@/db/index.ts'
import { addresses, users } from '@/db/schema.ts'
import { requireUser } from '@/lib/auth.ts'
import { normalizePhone } from '@/lib/phone.ts'
import { readPreferences } from '@/lib/preferences.ts'

export type FormResult = { error?: string; ok?: boolean }

export async function saveProfile(_prev: FormResult, form: FormData): Promise<FormResult> {
  const user = await requireUser()
  const name = String(form.get('name') ?? '').trim()

  if (name.length < 2) return { error: 'Enter your name.' }
  if (name.length > 80) return { error: 'That name is too long.' }

  await db.update(users).set({ name }).where(eq(users.id, user.id))
  revalidatePath('/account')
  return { ok: true }
}

export async function addAddress(_prev: FormResult, form: FormData): Promise<FormResult> {
  const user = await requireUser()

  const get = (k: string) => String(form.get(k) ?? '').trim()
  const label = get('label')
  const name = get('name')
  const phone = normalizePhone(get('phone'))
  const line1 = get('line1')
  const city = get('city')
  const state = get('state')
  const pincode = get('pincode')

  // Validated on the server because a form is a trust boundary, whatever the browser did.
  if (name.length < 2) return { error: 'Enter the name for this delivery.' }
  if (!phone) return { error: 'Enter a 10-digit Indian mobile number.' }
  if (line1.length < 4) return { error: 'Enter the street address.' }
  if (city.length < 2) return { error: 'Enter the city.' }
  if (state.length < 2) return { error: 'Choose the state.' }
  if (!/^\d{6}$/.test(pincode)) return { error: 'PIN code must be 6 digits.' }

  const existing = await db.select({ id: addresses.id }).from(addresses).where(eq(addresses.userId, user.id))
  const isFirst = existing.length === 0

  await db.insert(addresses).values({
    userId: user.id,
    label: label || null,
    name,
    phone,
    line1,
    line2: get('line2') || null,
    city,
    state,
    pincode,
    isDefault: isFirst, // the first address you add is the one we ship to
  })

  revalidatePath('/account')
  return { ok: true }
}

export async function setDefaultAddress(form: FormData): Promise<void> {
  const user = await requireUser()
  const id = String(form.get('id') ?? '')
  if (!id) return

  // Scoped to this user's rows, so a guessed id cannot touch anyone else's address.
  await db
    .update(addresses)
    .set({ isDefault: false })
    .where(and(eq(addresses.userId, user.id), ne(addresses.id, id)))
  await db
    .update(addresses)
    .set({ isDefault: true })
    .where(and(eq(addresses.userId, user.id), eq(addresses.id, id)))

  revalidatePath('/account')
}

export async function deleteAddress(form: FormData): Promise<void> {
  const user = await requireUser()
  const id = String(form.get('id') ?? '')
  if (!id) return

  await db.delete(addresses).where(and(eq(addresses.userId, user.id), eq(addresses.id, id)))

  // If we just removed the default, promote whatever is left so checkout always has one.
  const rest = await db.select().from(addresses).where(eq(addresses.userId, user.id))
  if (rest.length > 0 && !rest.some((a) => a.isDefault)) {
    await db.update(addresses).set({ isDefault: true }).where(eq(addresses.id, rest[0].id))
  }

  revalidatePath('/account')
}


export async function savePreferences(_prev: FormResult, form: FormData): Promise<FormResult> {
  const user = await requireUser()

  // Order updates are deliberately not read from the form — they cannot be switched off.
  const next = readPreferences({
    newMouldings: form.get('newMouldings') === 'on',
    offers: form.get('offers') === 'on',
    whatsapp: form.get('whatsapp') === 'on',
  })

  await db.update(users).set({ preferences: next }).where(eq(users.id, user.id))
  revalidatePath('/account/preferences')
  return { ok: true }
}
