import { createClient } from '@supabase/supabase-js'

/**
 * The service-role client. It bypasses Row Level Security completely, so it must never
 * be imported into a client component or a shared helper — only into server actions that
 * have already established the caller is a super-admin.
 *
 * Returns null rather than throwing when the key is absent, so the staff page can
 * explain what is missing instead of crashing.
 */
export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) return null

  return createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
}

export const SERVICE_KEY_MISSING =
  'SUPABASE_SERVICE_ROLE_KEY is not set in .env, so accounts cannot be created from here.'
