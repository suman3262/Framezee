/**
 * Creates demo customers and orders so the admin screens have something real to show
 * before Razorpay is wired up.  Run:  npm run demo:orders
 *
 * Orders go through the same createOrderFromCart the payment webhook will call, so what
 * the admin displays is a genuinely frozen order, not a fixture.
 *
 * Remove them again with:  npm run demo:clear
 */

import { eq, sql } from 'drizzle-orm'
import { db } from '../db/index.ts'
import {
  addresses,
  cartItems,
  carts,
  glazingOptions,
  materials,
  orders,
  products,
  sizes,
  users,
} from '../db/schema.ts'
import { createOrderFromCart } from '../lib/order-create.ts'

const PEOPLE = [
  { name: 'Om Trivedi', city: 'Krishnagar', state: 'West Bengal', pincode: '741101', phone: '+919812345001' },
  { name: 'Parth Krishnamurthy', city: 'Bengaluru', state: 'Karnataka', pincode: '560001', phone: '+919812345002' },
  { name: 'Ritu Nambiar', city: 'Kochi', state: 'Kerala', pincode: '682001', phone: '+919812345003' },
  { name: 'Ananya Sen', city: 'Kolkata', state: 'West Bengal', pincode: '700019', phone: '+919812345004' },
  { name: 'Vikram Rao', city: 'Pune', state: 'Maharashtra', pincode: '411001', phone: '+919812345005' },
]

const productRows = await db.select().from(products).where(eq(products.active, true))
const materialRows = await db.select().from(materials).where(eq(materials.active, true))
const sizeRows = await db.select().from(sizes).where(eq(sizes.active, true))
const [styrene] = await db.select().from(glazingOptions).where(eq(glazingOptions.included, true)).limit(1)

if (productRows.length === 0) {
  console.error('Seed the catalogue first: npm run seed')
  process.exit(1)
}

let made = 0
for (const [i, person] of PEOPLE.entries()) {
  const email = `demo${i + 1}@framezee.test`

  // Demo customers exist only in our own table — no auth.users row, so nobody can sign in
  // as them. They are here to give the admin realistic rows.
  const [existing] = await db.select().from(users).where(eq(users.email, email)).limit(1)
  const [user] = existing
    ? [existing]
    : await db
        .insert(users)
        .values({ id: crypto.randomUUID(), email, name: person.name, phone: person.phone, role: 'customer' })
        .returning()

  const [address] = await db
    .insert(addresses)
    .values({
      userId: user.id,
      name: person.name,
      phone: person.phone,
      line1: `${10 + i} Demo Street`,
      city: person.city,
      state: person.state,
      pincode: person.pincode,
      isDefault: true,
    })
    .returning()

  const [cart] = await db
    .insert(carts)
    .values({ userId: user.id })
    .onConflictDoUpdate({ target: carts.userId, set: { userId: user.id } })
    .returning()

  const lineCount = 1 + (i % 2)
  for (let n = 0; n < lineCount; n++) {
    const product = productRows[(i + n) % productRows.length]
    const material = materialRows[(i + n) % materialRows.length]
    const size = sizeRows[(i * 3 + n) % sizeRows.length]
    await db.insert(cartItems).values({
      cartId: cart.id,
      kind: 'catalog',
      productId: product.id,
      materialId: material.id,
      glazingOptionId: styrene?.id ?? null,
      widthTenths: size.widthTenths,
      heightTenths: size.heightTenths,
      thicknessTenths: 10,
      matBoard: n % 2 === 0,
      qty: 1 + (n % 2),
    })
  }

  if (i % 3 === 0) await db.update(carts).set({ couponCode: 'FRAME5' }).where(eq(carts.id, cart.id))

  const order = await createOrderFromCart({
    userId: user.id,
    addressId: address.id,
    paymentMethod: i % 4 === 3 ? 'cod' : 'razorpay',
  })

  // Spread them across the lifecycle so the admin has something to filter.
  const status = (['paid', 'ready_to_ship', 'shipped', 'delivered', 'paid'] as const)[i]
  await db
    .update(orders)
    .set({ status, placedAt: new Date(Date.now() - (i + 1) * 36 * 60 * 60 * 1000) })
    .where(eq(orders.id, order.id))

  console.log(`  ${order.orderNo}  ${person.name.padEnd(22)} ${status}`)
  made++
}

const [{ total }] = await db.select({ total: sql<number>`count(*)::int` }).from(orders)
console.log(`\n${made} demo orders created. ${total} in the database.`)
console.log('`npm run seed` will refuse while orders exist — clear them with `npm run demo:clear`.')
process.exit(0)
