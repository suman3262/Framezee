import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

/** Supabase client for server components, actions and route handlers. */
export async function createClient() {
  const cookieStore = await cookies()

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll(list) {
          try {
            for (const { name, value, options } of list) cookieStore.set(name, value, options)
          } catch {
            // Server components cannot set cookies. middleware.ts refreshes the session,
            // so it is safe to ignore here.
          }
        },
      },
    },
  )
}
