import Link from 'next/link'
import { and, desc, eq, ilike, or, sql, type SQL } from 'drizzle-orm'
import { db } from '@/db/index.ts'
import { orderItems, orders, users } from '@/db/schema.ts'
import { requireStaff } from '@/lib/auth.ts'
import { AdminShell, Card, Icon, StatusPill } from '@/components/admin/shell.tsx'
import { when } from '@/app/(admin)/admin/page.tsx'
import { advanceOrder } from '@/app/actions/admin.ts'
import { ALLOWED } from '@/lib/order-status.ts'
import { fmtInr } from '@/lib/pricing.ts'

const FILTERS = ['all', 'paid', 'ready_to_ship', 'shipped', 'delivered', 'cancelled'] as const

/** What the next move is called on a button, rather than the raw status name. */
const MOVE_LABEL: Record<string, string> = {
  ready_to_ship: 'Mark cut & ready',
  shipped: 'Mark shipped',
  delivered: 'Mark delivered',
  cancelled: 'Cancel',
  refunded: 'Refund',
}

export default async function AdminOrders({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; q?: string }>
}) {
  const staff = await requireStaff()
  const readOnly = staff.role !== 'super_admin' && staff.permission !== 'read_write'

  const { status, q } = await searchParams
  const active = FILTERS.includes(status as (typeof FILTERS)[number]) ? status! : 'all'
  const search = (q ?? '').trim()

  const where: SQL[] = []
  if (active !== 'all') where.push(eq(orders.status, active as 'paid'))
  if (search)
    where.push(
      or(
        ilike(orders.orderNo, `%${search}%`),
        ilike(users.name, `%${search}%`),
        ilike(users.email, `%${search}%`),
        ilike(users.phone, `%${search}%`),
      )!,
    )

  const rows = await db
    .select({
      id: orders.id,
      orderNo: orders.orderNo,
      status: orders.status,
      paymentMethod: orders.paymentMethod,
      totalPaise: orders.totalPaise,
      placedAt: orders.placedAt,
      address: orders.address,
      customer: users.name,
      phone: users.phone,
      items: sql<number>`(select count(*)::int from ${orderItems} where ${orderItems.orderId} = ${orders.id})`,
      units: sql<number>`(select coalesce(sum(${orderItems.qty}),0)::int from ${orderItems} where ${orderItems.orderId} = ${orders.id})`,
      // The workshop needs to know before opening the order whether a file is waiting.
      prints: sql<number>`(select count(*)::int from ${orderItems}
                            where ${orderItems.orderId} = ${orders.id}
                              and ${orderItems.printImagePath} is not null)`,
    })
    .from(orders)
    .leftJoin(users, eq(orders.userId, users.id))
    .where(where.length ? and(...where) : undefined)
    .orderBy(desc(orders.placedAt))

  const counts = Object.fromEntries(
    (
      await db
        .select({ status: orders.status, n: sql<number>`count(*)::int` })
        .from(orders)
        .groupBy(orders.status)
    ).map((r) => [r.status, r.n]),
  )
  const total = Object.values(counts).reduce((a, b) => a + b, 0)

  return (
    <AdminShell
      staff={staff}
      active="/admin/orders"
      eyebrow="Fulfilment"
      title="Orders"
      pendingCount={(counts.paid ?? 0) + (counts.ready_to_ship ?? 0) || undefined}
      actions={
        <form className="flex items-center gap-2">
          {active !== 'all' && <input type="hidden" name="status" value={active} />}
          <span className="relative flex items-center">
            <Icon name="search" className="absolute left-3 text-[18px] text-t3" />
            <input
              name="q"
              type="search"
              defaultValue={search}
              placeholder="Order number, name, phone…"
              className="h-9 w-[240px] rounded-lg border border-rule bg-card pl-10 pr-3 text-[12px] text-t1 outline-none focus:ring-2 focus:ring-violet/40"
            />
          </span>
          <button className="rounded-lg bg-violet px-3 py-[7px] text-[12px] font-bold text-white">
            Search
          </button>
          {search && (
            <Link
              href={active === 'all' ? '/admin/orders' : `/admin/orders?status=${active}`}
              className="text-[12px] font-semibold text-t3"
            >
              Clear
            </Link>
          )}
        </form>
      }
    >
      <ul className="flex flex-wrap gap-2">
        {FILTERS.map((f) => {
          const n = f === 'all' ? total : (counts[f] ?? 0)
          const href = new URLSearchParams()
          if (f !== 'all') href.set('status', f)
          if (search) href.set('q', search)
          return (
            <li key={f}>
              <Link
                href={`/admin/orders${href.toString() ? `?${href}` : ''}`}
                className={`flex items-center gap-[6px] whitespace-nowrap rounded-full px-3 py-[6px] text-[12px] font-semibold ${
                  active === f ? 'bg-violet text-white' : 'bg-card text-t2 shadow-sm'
                }`}
              >
                {f === 'all' ? 'All' : f.replace(/_/g, ' ')}
                <span
                  className={`rounded-full px-[6px] text-[11px] ${
                    active === f ? 'bg-white/20' : 'bg-subtle text-t3'
                  }`}
                >
                  {n}
                </span>
              </Link>
            </li>
          )
        })}
      </ul>

      <Card className="p-0">
        {rows.length === 0 ? (
          <p className="px-4 py-10 text-center text-[13px] text-t3">
            {search ? `Nothing matches “${search}”.` : 'No orders with this status.'}
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[980px] text-left">
              <thead>
                <tr className="border-b border-rule bg-subtle text-[11px] font-semibold uppercase tracking-[0.03em] text-t3">
                  <Th>Order</Th>
                  <Th>Customer</Th>
                  <Th>Ship to</Th>
                  <Th>Contents</Th>
                  <Th>Payment</Th>
                  <Th>Status</Th>
                  <Th right>Total</Th>
                  {!readOnly && <Th right>Next step</Th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-rule">
                {rows.map((o) => {
                  const addr = o.address as { city?: string; state?: string } | null
                  const moves = ALLOWED[o.status] ?? []
                  return (
                    <tr key={o.id} className="hover:bg-subtle/60">
                      <Td>
                        <Link
                          href={`/admin/orders/${o.id}`}
                          className="font-mono text-[12px] font-semibold text-violet-deep hover:underline"
                        >
                          {o.orderNo}
                        </Link>
                        <span className="block text-[11px] text-t3">{when(o.placedAt)}</span>
                      </Td>
                      <Td>
                        <span className="block text-[13px] font-medium text-t1">
                          {o.customer || '—'}
                        </span>
                        {o.phone && <span className="block text-[11px] text-t3">{o.phone}</span>}
                      </Td>
                      <Td>
                        <span className="text-[12px] text-t3">
                          {addr?.city}, {addr?.state}
                        </span>
                      </Td>
                      <Td>
                        <span className="text-[13px] text-t2">
                          {o.items} line{o.items === 1 ? '' : 's'} · {o.units} unit
                          {o.units === 1 ? '' : 's'}
                        </span>
                        {o.prints > 0 && (
                          <span className="mt-[2px] flex items-center gap-1 text-[11px] font-semibold text-violet-deep">
                            <Icon name="photo_library" className="text-[13px]" />
                            {o.prints} photo{o.prints === 1 ? '' : 's'} to print
                          </span>
                        )}
                      </Td>
                      <Td>
                        <span className="text-[12px] uppercase text-t3">{o.paymentMethod}</span>
                      </Td>
                      <Td>
                        <StatusPill status={o.status} />
                      </Td>
                      <Td right>
                        <span className="font-display text-[13px] font-bold text-t1">
                          {fmtInr(o.totalPaise)}
                        </span>
                      </Td>

                      {!readOnly && (
                        <Td right>
                          {moves.length === 0 ? (
                            <span className="text-[11px] text-t3">Closed</span>
                          ) : (
                            <span className="flex flex-wrap justify-end gap-1">
                              {moves.map((to) => (
                                <form key={to} action={advanceOrder}>
                                  <input type="hidden" name="id" value={o.id} />
                                  <input type="hidden" name="to" value={to} />
                                  <button
                                    className={`whitespace-nowrap rounded-lg px-2 py-[5px] text-[11px] font-bold ${
                                      to === 'cancelled' || to === 'refunded'
                                        ? 'bg-bad-bg text-bad'
                                        : 'bg-violet text-white'
                                    }`}
                                  >
                                    {MOVE_LABEL[to] ?? to.replace(/_/g, ' ')}
                                  </button>
                                </form>
                              ))}
                            </span>
                          )}
                        </Td>
                      )}
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {readOnly && (
        <p className="rounded-lg bg-info-bg px-3 py-2 text-[12px] font-medium text-info">
          Your access is read-only, so orders can be viewed but not moved.
        </p>
      )}
    </AdminShell>
  )
}

function Th({ children, right }: { children: React.ReactNode; right?: boolean }) {
  return <th className={`px-4 py-3 ${right ? 'text-right' : ''}`}>{children}</th>
}

function Td({ children, right }: { children: React.ReactNode; right?: boolean }) {
  return (
    <td className={`px-4 py-3 align-top text-[13px] text-t2 ${right ? 'text-right' : ''}`}>
      {children}
    </td>
  )
}
