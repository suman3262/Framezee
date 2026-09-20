import { eq, sql } from 'drizzle-orm'
import { db } from '@/db/index.ts'
import { addresses, orders } from '@/db/schema.ts'
import { requireUser } from '@/lib/auth.ts'
import { AccountShell, Panel } from '@/components/account/shell.tsx'
import { PreferenceForm } from '@/components/account/preference-form.tsx'
import { readPreferences } from '@/lib/preferences.ts'

export default async function PreferencesPage() {
  const user = await requireUser('/account/preferences')

  const [[{ orderCount }], [{ addressCount }]] = await Promise.all([
    db.select({ orderCount: sql<number>`count(*)::int` }).from(orders).where(eq(orders.userId, user.id)),
    db.select({ addressCount: sql<number>`count(*)::int` }).from(addresses).where(eq(addresses.userId, user.id)),
  ])

  return (
    <AccountShell
      user={user}
      active="/account/preferences"
      counts={{ orders: orderCount, '/account/orders': orderCount, '/account/addresses': addressCount }}
    >
      <Panel>
        <h1 className="font-display text-lg font-bold text-ink">Email preferences</h1>
        <p className="mt-1 text-xs text-body">Manage notifications and updates.</p>
        <div className="mt-4">
          <PreferenceForm preferences={readPreferences(user.preferences)} />
        </div>
      </Panel>
    </AccountShell>
  )
}
