'use server'

import { and, eq, isNull, sql } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'
import { db } from '@/db/index.ts'
import { carts, cartItems, coupons, customDesigns, orders } from '@/db/schema.ts'
import { getCurrentUser } from '@/lib/auth.ts'
import { thicknessAvailable } from '@/lib/frame-options.ts'
import { loadThicknesses } from '@/lib/frame-catalog.ts'
import { applyCoupon } from '@/lib/coupons.ts'
import { loadBasket, toCoupon } from '@/lib/basket.ts'

export type AddToCartInput = {
  productId: string
  materialId: string
  widthTenths: number
  heightTenths: number
  thicknessTenths: number
  matBoard: boolean
  printService: boolean
  paperQualityId: string | null
  /** The customer's photograph, when they are paying for it to be printed and mounted. */
  artworkPath: string | null
  qty: number
}

export type AddToCartResult = { ok?: true; redirectTo?: string; error?: string }

/**
 * Adds a configured frame to the signed-in customer's basket.
 *
 * No price is stored. The cart recomputes from the rate cards every time it renders —
 * money only freezes when the order row is created (see ARCHITECTURE.md).
 */
export async function addToCart(input: AddToCartInput): Promise<AddToCartResult> {
  const user = await getCurrentUser()
  if (!user) return { redirectTo: '/sign-in?next=/cart' }

  // The browser chose these, so the server checks them again.
  if (!Number.isInteger(input.qty) || input.qty < 1 || input.qty > 99)
    return { error: 'Choose a quantity between 1 and 99.' }
  if (!Number.isInteger(input.widthTenths) || !Number.isInteger(input.heightTenths))
    return { error: 'That size is not valid.' }
  const thicknesses = await loadThicknesses()
  const chosenThickness = thicknesses.find((t) => t.tenths === input.thicknessTenths)
  if (!chosenThickness || !thicknessAvailable(chosenThickness, input.widthTenths, input.heightTenths))
    return { error: 'That frame thickness is not available at this size.' }
  if (input.printService && !input.paperQualityId)
    return { error: 'Choose a paper for the print.' }

  /*
   * The whole point of the print service is that the workshop receives a file. Without
   * this check a customer could pay for printing and mounting and send us nothing, and
   * nobody would find out until the frame was already on the bench.
   */
  if (input.printService && !input.artworkPath)
    return { error: 'Upload the photograph you want printed, or turn the print service off.' }

  // An upload path must sit under this user's own folder — the same rule the storage
  // policies enforce, repeated here so a forged path cannot be attached to an order.
  if (input.artworkPath && !input.artworkPath.startsWith(`${user.id}/`))
    return { error: 'That upload is not yours.' }

  const [cart] = await db
    .insert(carts)
    .values({ userId: user.id })
    .onConflictDoUpdate({ target: carts.userId, set: { userId: user.id } })
    .returning()

  // Same frame, same options, already in the basket → bump the quantity instead of
  // stacking a duplicate line.
  const [existing] = await db
    .select()
    .from(cartItems)
    .where(
      and(
        eq(cartItems.cartId, cart.id),
        eq(cartItems.productId, input.productId),
        eq(cartItems.materialId, input.materialId),
        eq(cartItems.widthTenths, input.widthTenths),
        eq(cartItems.heightTenths, input.heightTenths),
        eq(cartItems.thicknessTenths, input.thicknessTenths),
        eq(cartItems.matBoard, input.matBoard),
        eq(cartItems.printService, input.printService),
        // Two frames carrying different photographs are different lines, however
        // identical the mouldings are.
        input.artworkPath ? sql`false` : isNull(cartItems.customDesignId),
      ),
    )
    .limit(1)

  if (existing) {
    await db
      .update(cartItems)
      .set({ qty: Math.min(99, existing.qty + input.qty) })
      .where(eq(cartItems.id, existing.id))
    return { ok: true }
  }

  /*
   * A catalogue frame with a photograph still needs somewhere to keep the file, and
   * custom_designs is already that place — lib/basket.ts reads printImagePath from it
   * for every line, whichever kind it is. The item stays kind 'catalog' because it is
   * still a listed frame at a listed size.
   */
  let designId: string | null = null
  if (input.artworkPath) {
    const [design] = await db
      .insert(customDesigns)
      .values({
        userId: user.id,
        printImagePath: input.artworkPath,
        widthTenths: input.widthTenths,
        heightTenths: input.heightTenths,
        materialId: input.materialId,
        paperQualityId: input.paperQualityId,
        thicknessTenths: input.thicknessTenths,
        matBoard: input.matBoard,
      })
      .returning()
    designId = design.id
  }

  await db.insert(cartItems).values({
    cartId: cart.id,
    kind: 'catalog',
    productId: input.productId,
    customDesignId: designId,
    widthTenths: input.widthTenths,
    heightTenths: input.heightTenths,
    materialId: input.materialId,
    paperQualityId: input.printService ? input.paperQualityId : null,
    printService: input.printService,
    thicknessTenths: input.thicknessTenths,
    matBoard: input.matBoard,
    qty: input.qty,
  })

  return { ok: true }
}

export async function removeCartItem(form: FormData): Promise<void> {
  const user = await getCurrentUser()
  if (!user) return
  const id = String(form.get('id') ?? '')
  if (!id) return

  const [cart] = await db.select().from(carts).where(eq(carts.userId, user.id)).limit(1)
  if (!cart) return

  // Scoped to this customer's cart, so a guessed id cannot delete someone else's line.
  await db.delete(cartItems).where(and(eq(cartItems.id, id), eq(cartItems.cartId, cart.id)))
}


/** Quantity stepper on the basket. Bounded, because the input is a trust boundary. */
export async function setCartItemQty(form: FormData): Promise<void> {
  const user = await getCurrentUser()
  if (!user) return

  const id = String(form.get('id') ?? '')
  const qty = Number(form.get('qty'))
  if (!id || !Number.isInteger(qty)) return

  const [cart] = await db.select().from(carts).where(eq(carts.userId, user.id)).limit(1)
  if (!cart) return

  if (qty < 1) {
    await db.delete(cartItems).where(and(eq(cartItems.id, id), eq(cartItems.cartId, cart.id)))
  } else {
    await db
      .update(cartItems)
      .set({ qty: Math.min(99, qty) })
      .where(and(eq(cartItems.id, id), eq(cartItems.cartId, cart.id)))
  }

  revalidatePath('/cart')
  revalidatePath('/checkout')
}

export type CouponFormResult = { error?: string; applied?: string }

/**
 * Stores only the code. The discount itself is recomputed on every render, so a coupon
 * that expires or stops qualifying while the basket sits there simply stops applying.
 */
export async function applyCouponToCart(
  _prev: CouponFormResult,
  form: FormData,
): Promise<CouponFormResult> {
  const user = await getCurrentUser()
  if (!user) return { error: 'Sign in to use a coupon.' }

  const code = String(form.get('code') ?? '').trim().toUpperCase()
  if (!code) return { error: 'Enter a coupon code.' }

  const [cart] = await db.select().from(carts).where(eq(carts.userId, user.id)).limit(1)
  if (!cart) return { error: 'Your basket is empty.' }

  const [row] = await db.select().from(coupons).where(eq(coupons.code, code)).limit(1)

  const basket = await loadBasket(user.id)
  const [{ count: placed }] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(orders)
    .where(eq(orders.userId, user.id))

  const result = applyCoupon(row ? toCoupon(row) : null, {
    subtotalPaise: basket.subtotalPaise,
    customerOrderCount: placed,
  })
  if (!result.ok) return { error: result.message }

  await db.update(carts).set({ couponCode: code }).where(eq(carts.id, cart.id))
  revalidatePath('/cart')
  revalidatePath('/checkout')
  return { applied: code }
}

export async function removeCouponFromCart(): Promise<void> {
  const user = await getCurrentUser()
  if (!user) return
  await db.update(carts).set({ couponCode: null }).where(eq(carts.userId, user.id))
  revalidatePath('/cart')
  revalidatePath('/checkout')
}
