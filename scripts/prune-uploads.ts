/**
 * Deletes uploaded photographs that no basket or order refers to.
 *
 *   npm run prune:uploads            # report only
 *   npm run prune:uploads -- --apply # actually delete
 *
 * Why this exists: a customer uploads a photo, then abandons the basket. The file sits in
 * storage forever, paid for, referenced by nothing. This is the sweep that reclaims it.
 *
 * It only removes files older than the grace period AND unreferenced by any custom design
 * that a cart or order still points at, so a basket someone comes back to next week is
 * never gutted.
 */

import { sql } from 'drizzle-orm'
import { createClient } from '@supabase/supabase-js'
import { db } from '../db/index.ts'

const APPLY = process.argv.includes('--apply')
const GRACE_DAYS = Number(process.env.PRUNE_GRACE_DAYS ?? 30)

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const key = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!url || !key) {
  console.error('NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set in .env')
  process.exit(1)
}
const admin = createClient(url, key, { auth: { persistSession: false } })

// Every path still spoken for: attached to an order line, or to a design a live cart
// still holds. Order lines are the important half — those files must never be touched.
const referenced = new Set(
  (
    await db.execute<{ path: string }>(sql`
      select print_image_path as path from order_items where print_image_path is not null
      union
      select d.print_image_path from custom_designs d
        join cart_items ci on ci.custom_design_id = d.id
       where d.print_image_path is not null
    `)
  ).map((r) => r.path),
)

const cutoff = Date.now() - GRACE_DAYS * 24 * 60 * 60 * 1000
let scanned = 0
const orphans: string[] = []

// One folder per user, which is how the storage policies are written.
const { data: folders, error } = await admin.storage.from('studio').list('', { limit: 1000 })
if (error) {
  console.error(`Could not list storage: ${error.message}`)
  process.exit(1)
}

for (const folder of folders ?? []) {
  const { data: files } = await admin.storage.from('studio').list(folder.name, { limit: 1000 })
  for (const f of files ?? []) {
    scanned++
    const path = `${folder.name}/${f.name}`
    if (referenced.has(path)) continue
    if (new Date(f.created_at ?? 0).getTime() > cutoff) continue
    orphans.push(path)
  }
}

console.log(`\n  scanned      ${scanned} files`)
console.log(`  referenced   ${referenced.size} paths in carts and orders`)
console.log(`  unreferenced ${orphans.length} older than ${GRACE_DAYS} days`)

if (orphans.length === 0) {
  console.log('\nNothing to reclaim.\n')
  process.exit(0)
}

if (!APPLY) {
  for (const p of orphans.slice(0, 20)) console.log(`    ${p}`)
  if (orphans.length > 20) console.log(`    … and ${orphans.length - 20} more`)
  console.log('\nRe-run with --apply to delete them.\n')
  process.exit(0)
}

// Storage takes a hundred at a time comfortably.
for (let i = 0; i < orphans.length; i += 100) {
  const batch = orphans.slice(i, i + 100)
  const { error } = await admin.storage.from('studio').remove(batch)
  if (error) {
    console.error(`Batch failed: ${error.message}`)
    process.exit(1)
  }
}
console.log(`\nDeleted ${orphans.length} files.\n`)
process.exit(0)
