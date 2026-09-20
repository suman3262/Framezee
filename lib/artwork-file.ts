import { createAdminClient } from './supabase/admin.ts'

/**
 * A short-lived link to a customer's uploaded photograph, for the workshop.
 *
 * The studio bucket is private and its policies only let the owner read their own folder,
 * which is right for customers and useless for staff. The service-role client signs past
 * that, so this must only ever be called from a page that has already required staff.
 */
export async function signArtwork(path: string, seconds = 60 * 60): Promise<string | null> {
  const supabase = createAdminClient()
  if (!supabase) return null
  const { data } = await supabase.storage.from('studio').createSignedUrl(path, seconds)
  return data?.signedUrl ?? null
}

/** Signs several at once, keyed by path, so a page with many items makes one pass. */
export async function signArtworks(paths: (string | null)[]): Promise<Map<string, string>> {
  const wanted = [...new Set(paths.filter((p): p is string => Boolean(p)))]
  const pairs = await Promise.all(
    wanted.map(async (p) => [p, await signArtwork(p)] as const),
  )
  return new Map(pairs.filter((x): x is [string, string] => x[1] !== null))
}
