'use server'

import { and, eq } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'
import { db } from '@/db/index.ts'
import { carts, cartItems, wishlistItems } from '@/db/schema.ts'
import { getCurrentUser } from '@/lib/auth.ts'
import { thicknessAvailable } from '@/lib/frame-options.ts'
import { loadThicknesses } from '@/lib/frame-catalog.ts'

export type WishResult = { ok?: true; redirectTo?: string; error?: string }

export async function saveToWishlist(input: {
  productId: string | null
  materialId: string
  widthTenths: number
  heightTenths: number
  thicknessTenths: number
  matBoard: boolean
  glazingOptionId: string | null
}): Promise<WishResult> {
  const user = await getCurrentUser()
  if (!user) return { redirectTo: '/sign-in?next=/wishlist' }

  const thicknesses = await loadThicknesses()
  const chosenThickness = thicknesses.find((t) => t.tenths === input.thicknessTenths)
  if (!chosenThickness || !thicknessAvailable(chosenThickness, input.widthTenths, input.heightTenths))
    return { error: 'That frame thickness is not available at this size.' }

  // Saving the same configuration twice is a no-op, not a second row.
  await db
    .insert(wishlistItems)
    .values({ userId: user.id, ...input })
    .onConflictDoNothing()

  revalidatePath('/wishlist')
  return { ok: true }
}

export async function removeFromWishlist(form: FormData): Promise<void> {
  const user = await getCurrentUser()
  if (!user) return
  const id = String(form.get('id') ?? '')
  if (!id) return
  await db.delete(wishlistItems).where(and(eq(wishlistItems.id, id), eq(wishlistItems.userId, user.id)))
  revalidatePath('/wishlist')
}

export async function clearWishlist(): Promise<void> {
  const user = await getCurrentUser()
  if (!user) return
  await db.delete(wishlistItems).where(eq(wishlistItems.userId, user.id))
  revalidatePath('/wishlist')
}

/** Move one saved frame into the basket. The saved row stays until explicitly removed. */
export async function moveToBasket(form: FormData): Promise<void> {
  const user = await getCurrentUser()
  if (!user) return
  const id = String(form.get('id') ?? '')
  if (!id) return

  const [saved] = await db
    .select()
    .from(wishlistItems)
    .where(and(eq(wishlistItems.id, id), eq(wishlistItems.userId, user.id)))
    .limit(1)
  if (!saved) return

  await addOne(user.id, saved)
  await db.delete(wishlistItems).where(eq(wishlistItems.id, id))

  revalidatePath('/wishlist')
  revalidatePath('/cart')
}

export async function moveAllToBasket(): Promise<void> {
  const user = await getCurrentUser()
  if (!user) return

  const saved = await db.select().from(wishlistItems).where(eq(wishlistItems.userId, user.id))
  for (const row of saved) await addOne(user.id, row)
  await db.delete(wishlistItems).where(eq(wishlistItems.userId, user.id))

  revalidatePath('/wishlist')
  revalidatePath('/cart')
}

async function addOne(userId: string, saved: typeof wishlistItems.$inferSelect) {
  const [cart] = await db
    .insert(carts)
    .values({ userId })
    .onConflictDoUpdate({ target: carts.userId, set: { userId } })
    .returning()

  const [existing] = await db
    .select()
    .from(cartItems)
    .where(
      and(
        eq(cartItems.cartId, cart.id),
        eq(cartItems.materialId, saved.materialId),
        eq(cartItems.widthTenths, saved.widthTenths),
        eq(cartItems.heightTenths, saved.heightTenths),
        eq(cartItems.thicknessTenths, saved.thicknessTenths),
        eq(cartItems.matBoard, saved.matBoard),
      ),
    )
    .limit(1)

  if (existing) {
    await db
      .update(cartItems)
      .set({ qty: Math.min(99, existing.qty + 1) })
      .where(eq(cartItems.id, existing.id))
    return
  }

  await db.insert(cartItems).values({
    cartId: cart.id,
    kind: 'catalog',
    productId: saved.productId,
    materialId: saved.materialId,
    glazingOptionId: saved.glazingOptionId,
    widthTenths: saved.widthTenths,
    heightTenths: saved.heightTenths,
    thicknessTenths: saved.thicknessTenths,
    matBoard: saved.matBoard,
    qty: 1,
  })
}

/**
 * "Order again" — puts everything from a past order back in the basket.
 *
 * Deliberately re-prices from today's rate cards rather than reusing the frozen figures:
 * the old order keeps what it was charged, and the new basket charges what the frame
 * costs now.
 */
export async function reorder(form: FormData): Promise<void> {
  const user = await getCurrentUser()
  if (!user) return
  const orderId = String(form.get('orderId') ?? '')
  if (!orderId) return

  const { orders, orderItems, materials } = await import('@/db/schema.ts')
  const { eq, and } = await import('drizzle-orm')

  const [order] = await db
    .select()
    .from(orders)
    .where(and(eq(orders.id, orderId), eq(orders.userId, user.id)))
    .limit(1)
  if (!order) return

  const items = await db.select().from(orderItems).where(eq(orderItems.orderId, order.id))
  const allMaterials = await db.select().from(materials)

  const [cart] = await db
    .insert(carts)
    .values({ userId: user.id })
    .onConflictDoUpdate({ target: carts.userId, set: { userId: user.id } })
    .returning()

  for (const i of items) {
    // Names were snapshotted as text; match them back to a moulding that still exists.
    const material = allMaterials.find((m) => m.name === i.materialName)
    if (!material || !material.active) continue

    await db.insert(cartItems).values({
      cartId: cart.id,
      kind: 'catalog',
      materialId: material.id,
      widthTenths: i.widthTenths,
      heightTenths: i.heightTenths,
      thicknessTenths: i.thicknessTenths,
      matBoard: i.matBoard,
      qty: i.qty,
    })
  }

  revalidatePath('/cart')
  revalidatePath('/account/orders')
}
