import { createAdminClient } from './supabase/admin.ts'

/**
 * Product artwork upload.
 *
 * It goes through the service-role client inside a server action that has already checked
 * the caller is staff, rather than from the browser. That means the catalogue bucket needs
 * no write policy at all: nothing but this code path can put a file in it.
 */

const MAX_BYTES = 5 * 1024 * 1024
const TYPES: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/avif': 'avif',
}

export async function uploadCatalogueImage(
  file: File,
  slugHint: string,
): Promise<{ url: string } | { error: string }> {
  const ext = TYPES[file.type]
  if (!ext) return { error: 'Use a JPEG, PNG, WebP or AVIF image.' }
  if (file.size > MAX_BYTES)
    return { error: `That image is ${(file.size / 1024 / 1024).toFixed(1)} MB. The limit is 5 MB.` }

  const supabase = createAdminClient()
  if (!supabase) return { error: 'SUPABASE_SERVICE_ROLE_KEY is not set, so images cannot be uploaded.' }

  // Date-prefixed so a replaced image never collides with the one it replaces — the old
  // URL keeps working for anything still pointing at it, such as a cached page.
  const safe = slugHint.replace(/[^a-z0-9-]/gi, '').toLowerCase() || 'frame'
  const path = `frames/${safe}-${Date.now()}.${ext}`

  const { error } = await supabase.storage.from('catalogue').upload(path, file, {
    contentType: file.type,
    cacheControl: '31536000',
    upsert: false,
  })
  if (error) return { error: `Upload failed: ${error.message}` }

  const { data } = supabase.storage.from('catalogue').getPublicUrl(path)
  return { url: data.publicUrl }
}
