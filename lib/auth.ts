import { eq } from 'drizzle-orm'
import { redirect } from 'next/navigation'
import { db } from '../db/index.ts'
import { users } from '../db/schema.ts'
import { createClient } from './supabase/server.ts'
import { ADMIN_SIGN_IN } from './env.ts'

export type AppUser = typeof users.$inferSelect

/** Re-exported so `@/lib/auth.ts` stays the one import for anything gate-related. */
export { ADMIN_SIGN_IN } from './env.ts'

/**
 * The signed-in user, or null. Reads the profile row from our own tables — the auth.users
 * trigger guarantees it exists by the time a session does.
 */
export async function getCurrentUser(): Promise<AppUser | null> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return null

  const [row] = await db.select().from(users).where(eq(users.id, user.id)).limit(1)
  return row ?? null
}

export async function requireUser(next = '/account'): Promise<AppUser> {
  const user = await getCurrentUser()
  if (!user) redirect(`/sign-in?next=${encodeURIComponent(next)}`)
  return user
}

export const isStaff = (u: AppUser) => u.role === 'admin' || u.role === 'super_admin'

/**
 * Staff, signed in with a second factor and not suspended.
 *
 * The MFA check is the important one. Without it, a staff member could sign in through
 * the customer's email OTP form and reach the dashboard having never touched their
 * authenticator — the password and the secret URL would both be beside the point.
 * Supabase reports that as an assurance level, so asking for aal2 closes the hole no
 * matter which door was used.
 */
export async function requireStaff(): Promise<AppUser> {
  const user = await getCurrentUser()
  if (!user || !isStaff(user)) redirect(ADMIN_SIGN_IN)
  if (user.suspendedAt) redirect(`${ADMIN_SIGN_IN}?denied=suspended`)

  const supabase = await createClient()
  const { data } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel()
  if (data?.currentLevel !== 'aal2') redirect(`${ADMIN_SIGN_IN}?denied=mfa`)

  return user
}

export async function requireSuperAdmin(): Promise<AppUser> {
  const user = await requireStaff()
  if (user.role !== 'super_admin') redirect('/admin')
  return user
}

/**
 * Anything that changes data calls this instead of requireStaff. A read-only admin can
 * open every page their role allows and change nothing on any of them.
 *
 * It returns a message rather than redirecting, because these run inside server actions
 * where the caller wants to show the reason next to the button that was pressed.
 */
export async function requireWrite(): Promise<{ user: AppUser } | { error: string }> {
  const user = await requireStaff()
  if (user.role !== 'super_admin' && user.permission !== 'read_write')
    return { error: 'Your access is read-only. Ask a super-admin to change it.' }
  return { user }
}
