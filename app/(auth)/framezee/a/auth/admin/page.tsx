import { redirect } from 'next/navigation'
import { AdminSignIn } from '@/components/admin/admin-sign-in.tsx'
import { getCurrentUser, isStaff } from '@/lib/auth.ts'
import { createClient } from '@/lib/supabase/server.ts'

/**
 * The staff door. Its address is not linked from anywhere in the app — not the header,
 * not the footer, not a redirect — so it does not appear in any crawl of the site.
 *
 * Obscurity is not the control though: /admin turns away anyone who is not staff at
 * aal2, whether or not they found this page.
 */
export const metadata = {
  title: 'Sign in',
  robots: { index: false, follow: false },
}

export default async function AdminSignInPage({
  searchParams,
}: {
  searchParams: Promise<{ denied?: string }>
}) {
  const { denied } = await searchParams

  // Already through both factors: skip the form rather than asking a signed-in
  // admin to type their password again.
  const user = await getCurrentUser()
  if (user && isStaff(user) && !user.suspendedAt) {
    const supabase = await createClient()
    const { data } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel()
    if (data?.currentLevel === 'aal2') redirect('/admin')
  }

  return <AdminSignIn denied={denied} />
}
