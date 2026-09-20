import { asc, eq, ne, sql } from 'drizzle-orm'
import { db } from '@/db/index.ts'
import { users } from '@/db/schema.ts'
import { requireSuperAdmin } from '@/lib/auth.ts'
import { AdminShell, Card, Icon } from '@/components/admin/shell.tsx'
import { CreateAdminForm, StaffControls } from '@/components/admin/staff-forms.tsx'
import { when } from '@/app/(admin)/admin/page.tsx'
import { formatPhone } from '@/lib/phone.ts'
import { createAdminClient } from '@/lib/supabase/admin.ts'

/** What each level can reach. Mirrors the gates in lib/auth.ts, not the menu. */
const CAN = [
  { area: 'Storefront, own account', read: true, write: true, superAdmin: true },
  { area: 'Dashboard, Orders — view', read: true, write: true, superAdmin: true },
  { area: 'Products, Categories — view', read: true, write: true, superAdmin: true },
  { area: 'Move orders, edit catalogue', read: false, write: true, superAdmin: true },
  { area: 'Price & Material Control', read: false, write: false, superAdmin: true },
  { area: 'Coupons', read: false, write: false, superAdmin: true },
  { area: 'Revenue & Analytics', read: false, write: false, superAdmin: true },
  { area: 'Staff & Permissions', read: false, write: false, superAdmin: true },
]

export default async function StaffAdmin() {
  const me = await requireSuperAdmin()

  const [staff, [{ liveSupers }]] = await Promise.all([
    db.select().from(users).where(ne(users.role, 'customer')).orderBy(asc(users.role), asc(users.email)),
    db.execute<{ liveSupers: number }>(sql`
      select count(*)::int as "liveSupers"
      from public.users u join auth.users a on a.id = u.id
      where u.role = 'super_admin' and u.suspended_at is null
    `).then((r) => r as unknown as [{ liveSupers: number }]),
  ])

  const canCreate = createAdminClient() !== null

  return (
    <AdminShell
      staff={me}
      active="/admin/staff"
      eyebrow="Access control"
      title="Staff & permissions"
    >
      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_340px]">
        <Card className="p-0">
          <div className="flex items-center justify-between gap-3 p-4">
            <h2 className="font-display text-[18px] font-semibold text-t1">
              Staff ({staff.length})
            </h2>
            <span className="text-[12px] text-t3">
              {liveSupers} super-admin{liveSupers === 1 ? '' : 's'} who can sign in
            </span>
          </div>

          <ul className="divide-y divide-rule border-t border-rule">
            {staff.map((u) => {
              const isMe = u.id === me.id
              const suspended = u.suspendedAt !== null
              return (
                <li key={u.id} className="flex flex-wrap items-start justify-between gap-3 p-4">
                  <span className="min-w-0">
                    <span className="flex flex-wrap items-center gap-2">
                      <span className="font-display text-[14px] font-bold text-t1">
                        {u.name || u.email}
                      </span>
                      {isMe && <span className="text-[11px] text-t3">you</span>}
                      <Badge tone={u.role === 'super_admin' ? 'super' : 'admin'}>
                        {u.role === 'super_admin' ? 'super admin' : 'admin'}
                      </Badge>
                      {u.role !== 'super_admin' && (
                        <Badge tone={u.permission === 'read_write' ? 'write' : 'read'}>
                          {u.permission === 'read_write' ? 'read + write' : 'read only'}
                        </Badge>
                      )}
                      {suspended && <Badge tone="bad">suspended</Badge>}
                    </span>
                    <span className="mt-[2px] block text-[12px] text-t3">
                      {[u.email, u.phone ? formatPhone(u.phone) : null].filter(Boolean).join(' · ')}
                    </span>
                    <span className="block text-[12px] text-t3">
                      joined {when(u.createdAt)}
                      {u.grantedBy ? ` · granted by ${u.grantedBy}` : ''}
                      {suspended && u.suspendedAt ? ` · suspended ${when(u.suspendedAt)}` : ''}
                    </span>
                  </span>

                  <StaffControls
                    id={u.id}
                    role={u.role}
                    permission={u.permission}
                    suspended={suspended}
                    isMe={isMe}
                    lastSuper={u.role === 'super_admin' && liveSupers <= 1}
                  />
                </li>
              )
            })}
          </ul>
        </Card>

        <div className="flex flex-col gap-5">
          <Card>
            <h2 className="mb-3 font-display text-[18px] font-semibold text-t1">Create an admin</h2>
            {canCreate ? (
              <CreateAdminForm />
            ) : (
              <p className="rounded-lg bg-warn-bg px-3 py-2 text-xs font-medium text-warn">
                <code className="font-mono">SUPABASE_SERVICE_ROLE_KEY</code> is not set in{' '}
                <code className="font-mono">.env</code>, so accounts cannot be created from here.
                Add it and restart the server.
              </p>
            )}
          </Card>

          <Card>
            <h2 className="mb-3 font-display text-[18px] font-semibold text-t1">
              What each level reaches
            </h2>
            <table className="w-full text-left">
              <thead>
                <tr className="text-[10px] font-semibold uppercase tracking-[0.04em] text-t3">
                  <th className="pb-2">Area</th>
                  <th className="pb-2 text-center">Read</th>
                  <th className="pb-2 text-center">Write</th>
                  <th className="pb-2 text-center">Super</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-rule">
                {CAN.map((r) => (
                  <tr key={r.area}>
                    <td className="py-2 text-[12px] text-t2">{r.area}</td>
                    <Mark on={r.read} />
                    <Mark on={r.write} />
                    <Mark on={r.superAdmin} />
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>

          <Card>
            <h2 className="mb-2 flex items-center gap-2 font-display text-[18px] font-semibold text-t1">
              <Icon name="shield_lock" className="text-[18px] text-violet-deep" />
              How the door is held
            </h2>
            <ul className="flex flex-col gap-2 text-[12px] leading-[18px] text-t3">
              <li>
                Staff sign in with a password and an authenticator code. An email link is
                never enough — it would make the second factor the same inbox as the first.
              </li>
              <li>
                Every admin page re-checks role, suspension and second factor on the server.
                Hiding a menu item is not a permission.
              </li>
              <li>
                <span className="font-semibold text-t2">Suspend</span> keeps the role and blocks
                the dashboard, so it can be lifted without retyping anything.{' '}
                <span className="font-semibold text-t2">Revoke</span> puts them back to being a
                customer and leaves their orders alone.
              </li>
              <li>
                The last super-admin who can actually sign in cannot be revoked, demoted or
                suspended — otherwise nobody could let anyone back in.
              </li>
            </ul>
          </Card>
        </div>
      </div>
    </AdminShell>
  )
}

function Badge({ tone, children }: { tone: string; children: React.ReactNode }) {
  const c: Record<string, string> = {
    super: 'bg-violet-tint text-violet-ink',
    admin: 'bg-subtle text-t2',
    write: 'bg-ok-bg text-ok',
    read: 'bg-info-bg text-info',
    bad: 'bg-bad-bg text-bad',
  }
  return (
    <span className={`rounded-full px-2 py-[2px] text-[11px] font-semibold ${c[tone]}`}>
      {children}
    </span>
  )
}

function Mark({ on }: { on: boolean }) {
  return (
    <td className="py-2 text-center">
      <span className={on ? 'text-ok' : 'text-rule'}>{on ? '●' : '○'}</span>
    </td>
  )
}
