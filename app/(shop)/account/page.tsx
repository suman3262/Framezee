import { eq, sql } from 'drizzle-orm'
import { db } from '@/db/index.ts'
import { addresses, orders } from '@/db/schema.ts'
import { requireUser } from '@/lib/auth.ts'
import { AccountShell, Panel } from '@/components/account/shell.tsx'
import { ProfileForm } from '@/components/auth/account-forms.tsx'
import { formatPhone } from '@/lib/phone.ts'

export default async function ProfilePage() {
  const user = await requireUser()
  const [[{ orderCount }], [{ addressCount }]] = await Promise.all([
    db.select({ orderCount: sql<number>`count(*)::int` }).from(orders).where(eq(orders.userId, user.id)),
    db.select({ addressCount: sql<number>`count(*)::int` }).from(addresses).where(eq(addresses.userId, user.id)),
  ])

  return (
    <AccountShell
      user={user}
      active="/account"
      counts={{ orders: orderCount, '/account/orders': orderCount, '/account/addresses': addressCount }}
    >
      <Panel>
        <h1 className="font-display text-lg font-bold text-ink">Profile</h1>
        <p className="mt-1 text-xs text-body">
          Manage your personal information and contact details.
        </p>

        <div className="mt-5">
          <ProfileForm name={user.name ?? ''} />
        </div>

        <dl className="mt-6 grid gap-4 border-t border-line pt-5 sm:grid-cols-2">
          <div>
            <dt className="text-[10px] font-bold uppercase tracking-[0.05em] text-faint">Email</dt>
            <dd className="mt-1 text-[13px] text-ink">{user.email ?? '—'}</dd>
          </div>
          <div>
            <dt className="text-[10px] font-bold uppercase tracking-[0.05em] text-faint">
              Phone {user.phone && <span className="text-emerald-700">· verified</span>}
            </dt>
            <dd className="mt-1 text-[13px] text-ink">
              {user.phone ? formatPhone(user.phone) : '—'}
            </dd>
          </div>
        </dl>

        <p className="mt-4 text-[11px] leading-4 text-faint">
          Your email or mobile is how you sign in, so it is changed through the sign-in flow
          rather than here.
        </p>
      </Panel>
    </AccountShell>
  )
}
