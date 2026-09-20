/** Removes everything scripts/demo-orders.ts created.  npm run demo:clear */

import { inArray, like } from 'drizzle-orm'
import { db } from '../db/index.ts'
import { orders, users } from '../db/schema.ts'

const demo = await db.select().from(users).where(like(users.email, 'demo%@framezee.test'))
if (demo.length === 0) {
  console.log('No demo customers found.')
  process.exit(0)
}

const ids = demo.map((u) => u.id)
await db.delete(orders).where(inArray(orders.userId, ids))
await db.delete(users).where(inArray(users.id, ids))

console.log(`Removed ${demo.length} demo customers and their orders.`)
process.exit(0)
