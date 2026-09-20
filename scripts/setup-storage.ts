/**
 * Creates the storage buckets the app expects.  npm run setup:storage
 *
 * Idempotent, so it is safe on every deploy.
 *
 *   studio     private — customers' own photos, readable only by the owner
 *   catalogue  public  — product artwork, which every visitor has to see
 */

import { createClient } from '@supabase/supabase-js'

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const key = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!url || !key) {
  console.error('NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set in .env')
  process.exit(1)
}

const admin = createClient(url, key, { auth: { persistSession: false } })

const WANTED = [
  {
    id: 'studio',
    public: false,
    fileSizeLimit: 25 * 1024 * 1024,
    allowedMimeTypes: ['image/jpeg', 'image/png', 'image/webp', 'image/avif', 'image/tiff'],
  },
  {
    id: 'catalogue',
    public: true,
    fileSizeLimit: 5 * 1024 * 1024,
    allowedMimeTypes: ['image/jpeg', 'image/png', 'image/webp', 'image/avif'],
  },
]

const { data: existing, error } = await admin.storage.listBuckets()
if (error) {
  console.error(`Could not list buckets: ${error.message}`)
  process.exit(1)
}
const have = new Set(existing.map((b) => b.id))

for (const b of WANTED) {
  if (have.has(b.id)) {
    const { error } = await admin.storage.updateBucket(b.id, b)
    console.log(`  ${b.id.padEnd(10)} ${error ? `unchanged (${error.message})` : 'updated'}`)
  } else {
    const { error } = await admin.storage.createBucket(b.id, b)
    console.log(`  ${b.id.padEnd(10)} ${error ? `FAILED: ${error.message}` : 'created'}`)
  }
}
process.exit(0)
