'use server'

import { eq } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'
import { db } from '@/db/index.ts'
import { categories, orders, products } from '@/db/schema.ts'
import { requireWrite } from '@/lib/auth.ts'

/**
 * The order lifecycle, as ARCHITECTURE.md defines it:
 *   paid → ready_to_ship → shipped → delivered,  and  → cancelled → refunded
 *
 * Only these moves are allowed. A dropdown listing every status would let a tired
 * operator mark an unpaid order delivered.
 */
import { ALLOWED } from '@/lib/order-status.ts'


export type AdminResult = { error?: string; ok?: true }

export async function advanceOrder(form: FormData): Promise<void> {
  // A read-only admin may open every order and move none of them.
  if ('error' in (await requireWrite())) return

  const id = String(form.get('id') ?? '')
  const to = String(form.get('to') ?? '')
  if (!id || !to) return

  const [order] = await db.select().from(orders).where(eq(orders.id, id)).limit(1)
  if (!order) return
  if (!ALLOWED[order.status]?.includes(to)) return // silently refuse an illegal move

  await db.update(orders).set({ status: to as typeof order.status }).where(eq(orders.id, id))

  revalidatePath('/admin')
  revalidatePath('/admin/orders')
  revalidatePath(`/admin/orders/${id}`)
}

export async function toggleProduct(form: FormData): Promise<void> {
  if ('error' in (await requireWrite())) return
  const id = String(form.get('id') ?? '')
  const active = String(form.get('active')) === 'true'
  if (!id) return
  await db.update(products).set({ active }).where(eq(products.id, id))
  revalidatePath('/admin/products')
  revalidatePath('/browse')
}

export async function toggleCategory(form: FormData): Promise<void> {
  if ('error' in (await requireWrite())) return
  const id = String(form.get('id') ?? '')
  const active = String(form.get('active')) === 'true'
  if (!id) return
  await db.update(categories).set({ active }).where(eq(categories.id, id))
  revalidatePath('/admin/categories')
  revalidatePath('/browse')
}
