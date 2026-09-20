'use server'

import { eq } from 'drizzle-orm'
import { db } from '@/db/index.ts'
import { carts, cartItems, customDesigns } from '@/db/schema.ts'
import { getCurrentUser } from '@/lib/auth.ts'
import { thicknessAvailable } from '@/lib/frame-options.ts'
import { loadThicknesses } from '@/lib/frame-catalog.ts'
import { validateCustomSize } from '@/lib/custom-frame.ts'

export type CustomInput = {
  widthTenths: number
  heightTenths: number
  materialId: string
  thicknessTenths: number
  matBoard: boolean
  matColour: string | null
  glazingOptionId: string | null
  /** The photo that gets printed and mounted. The only upload production needs. */
  artworkPath: string | null
}

export type CustomResult = { ok?: true; redirectTo?: string; error?: string }

/**
 * Saves a Custom Studio configuration and puts it in the basket.
 *
 * Stored as its parts — size, moulding, thickness, mat, glazing and the customer's photo
 * — never as a rendered composite. The print file is produced from the original upload
 * when the order reaches the workshop.
 *
 * The wall behind the preview, and where the frame was dragged or rotated on it, are NOT
 * stored. They help someone picture the frame in their room and have no bearing on what
 * gets cut, printed or shipped.
 */
export async function addCustomToCart(input: CustomInput): Promise<CustomResult> {
  const user = await getCurrentUser()
  if (!user) return { redirectTo: '/sign-in?next=/custom' }

  // The browser chose all of this, so the server checks it again.
  const size = validateCustomSize(input.widthTenths, input.heightTenths)
  if (!size.ok) return { error: size.message }
  const thicknesses = await loadThicknesses()
  const chosenThickness = thicknesses.find((t) => t.tenths === input.thicknessTenths)
  if (!chosenThickness || !thicknessAvailable(chosenThickness, input.widthTenths, input.heightTenths))
    return { error: 'That frame thickness is not available at this size.' }

  // An upload path must sit under this user's own folder — the same rule the storage
  // policies enforce, repeated here so a forged path cannot be attached to an order.
  if (input.artworkPath && !input.artworkPath.startsWith(`${user.id}/`))
    return { error: 'That upload is not yours.' }

  const [design] = await db
    .insert(customDesigns)
    .values({
      userId: user.id,
      printImagePath: input.artworkPath,
      widthTenths: input.widthTenths,
      heightTenths: input.heightTenths,
      materialId: input.materialId,
      glazingOptionId: input.glazingOptionId,
      thicknessTenths: input.thicknessTenths,
      matBoard: input.matBoard,
      matColour: input.matBoard ? input.matColour : null,
    })
    .returning()

  const [cart] = await db
    .insert(carts)
    .values({ userId: user.id })
    .onConflictDoUpdate({ target: carts.userId, set: { userId: user.id } })
    .returning()

  await db.insert(cartItems).values({
    cartId: cart.id,
    kind: 'custom',
    customDesignId: design.id,
    widthTenths: input.widthTenths,
    heightTenths: input.heightTenths,
    materialId: input.materialId,
    glazingOptionId: input.glazingOptionId,
    // Printing the customer's own photo is the paid extra; here it is part of the
    // design, so the cart line carries it as the print flag when artwork was uploaded.
    printService: Boolean(input.artworkPath),
    thicknessTenths: input.thicknessTenths,
    matBoard: input.matBoard,
    qty: 1,
  })

  return { ok: true }
}
