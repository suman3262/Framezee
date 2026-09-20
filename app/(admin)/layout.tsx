import { requireStaff } from '@/lib/auth.ts'

/**
 * Every admin page renders inside this, so the role check runs before any of them.
 * Middleware only guarantees a session exists; this is what makes it staff-only.
 */
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  await requireStaff()
  return children
}
