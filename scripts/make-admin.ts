/**
 * Promotes an existing account to staff.  npm run make:admin -- you@example.com [role]
 *
 * There is no way to do this from the app, by design: the first admin has to be made by
 * someone with database access. Sign in at /sign-in first so the account exists.
 */

import { eq } from 'drizzle-orm'
import { db } from '../db/index.ts'
import { users } from '../db/schema.ts'

const [email, role = 'super_admin'] = process.argv.slice(2)

if (!email) {
  console.error('Usage: npm run make:admin -- you@example.com [admin|super_admin|customer]')
  process.exit(1)
}
if (!['admin', 'super_admin', 'customer'].includes(role)) {
  console.error(`Unknown role "${role}". Use admin, super_admin or customer.`)
  process.exit(1)
}

const [user] = await db.select().from(users).where(eq(users.email, email)).limit(1)
if (!user) {
  console.error(`No account for ${email}. Sign in at /sign-in first, then run this again.`)
  const all = await db.select({ email: users.email, role: users.role }).from(users)
  if (all.length) console.error('\nAccounts that do exist:\n' + all.map((u) => `  ${u.email} (${u.role})`).join('\n'))
  process.exit(1)
}

await db.update(users).set({ role: role as 'admin' }).where(eq(users.id, user.id))
console.log(`${email} is now ${role}. Open /admin.`)
process.exit(0)
