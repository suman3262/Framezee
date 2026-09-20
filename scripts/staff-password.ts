/**
 * Sets a staff password from the database.  npm run staff:password -- you@example.com
 *
 * This is the bootstrap: the first super-admin has no password, and the admin door only
 * accepts passwords, so there has to be one way in that does not go through the app. It
 * is also the reset path if someone locks themselves out.
 *
 * Prints a generated password unless one is given as the second argument.
 */

import { randomBytes } from 'node:crypto'
import { eq } from 'drizzle-orm'
import { createClient } from '@supabase/supabase-js'
import { db } from '../db/index.ts'
import { users } from '../db/schema.ts'

const [email, given] = process.argv.slice(2)
if (!email) {
  console.error('Usage: npm run staff:password -- you@example.com [password]')
  process.exit(1)
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const key = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!url || !key) {
  console.error('SUPABASE_SERVICE_ROLE_KEY is empty in .env. Supabase → Project Settings → API.')
  process.exit(1)
}

const [row] = await db.select().from(users).where(eq(users.email, email)).limit(1)
if (!row) {
  console.error(`No account for ${email}.`)
  process.exit(1)
}
if (row.role === 'customer') {
  console.error(`${email} is a customer. Run: npm run make:admin -- ${email}`)
  process.exit(1)
}

// Ambiguous characters left out so it survives being read down a phone line.
const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789'
const password =
  given ?? Array.from(randomBytes(20), (b) => alphabet[b % alphabet.length]).join('')

const admin = createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } })
const { error } = await admin.auth.admin.updateUserById(row.id, { password })
if (error) {
  console.error(`Could not set the password: ${error.message}`)
  process.exit(1)
}

// A password reset is a good moment to drop a lost authenticator, so the next sign-in
// enrols a fresh one rather than locking the account behind a device nobody has.
if (process.argv.includes('--reset-mfa')) {
  const { data } = await admin.auth.admin.mfa.listFactors({ userId: row.id })
  for (const f of data?.factors ?? [])
    await admin.auth.admin.mfa.deleteFactor({ userId: row.id, id: f.id })
  console.log('Authenticator factors removed — the next sign-in will enrol a new one.')
}

console.log(`\n  ${email}\n  password:  ${password}\n`)
console.log('Sign in at http://localhost:3000/framezee/a/auth/admin')
console.log('You will set up an authenticator app on the first sign-in.\n')
process.exit(0)
