import Link from 'next/link'
import { desc, eq, sql } from 'drizzle-orm'
import { db } from '@/db/index.ts'
import { addresses, orderItems, orders, shipments } from '@/db/schema.ts'
import { requireUser } from '@/lib/auth.ts'
import { AccountShell, Panel } from '@/components/account/shell.tsx'
import { timelineFor } from '@/lib/tracking.ts'
import { fmtIn, fmtInr } from '@/lib/pricing.ts'
import { reorder } from '@/app/actions/wishlist.ts'

const LABEL: Record<string, string> = {
  paid: 'Confirmed',
  ready_to_ship: 'In the workshop',
  shipped: 'Dispatched',
  delivered: 'Delivered',
  cancelled: 'Cancelled',
  refunded: 'Refunded',
}

export default async function OrdersPage() {
  const user = await requireUser('/account/orders')

  const [rows, [{ addressCount }]] = await Promise.all([
    db
      .select({ o: orders, shipment: shipments })
      .from(orders)
      .leftJoin(shipments, eq(shipments.orderId, orders.id))
      .where(eq(orders.userId, user.id))
      .orderBy(desc(orders.placedAt)),
    db.select({ addressCount: sql<number>`count(*)::int` }).from(addresses).where(eq(addresses.userId, user.id)),
  ])

  const items = rows.length
    ? await db.select().from(orderItems).where(
        sql`${orderItems.orderId} in ${sql.raw(`('${rows.map((r) => r.o.id).join("','")}')`)}`,
      )
    : []

  return (
    <AccountShell
      user={user}
      active="/account/orders"
      counts={{ orders: rows.length, '/account/orders': rows.length, '/account/addresses': addressCount }}
    >
      {rows.length === 0 ? (
        <Panel>
          <p className="text-sm text-body">
            No orders yet.{' '}
            <Link href="/browse" className="font-semibold text-violet-deep">Browse frames</Link>.
          </p>
        </Panel>
      ) : (
        <div className="flex flex-col gap-4">
          {rows.map(({ o, shipment }) => {
            const mine = items.filter((i) => i.orderId === o.id)
            const stages = timelineFor(o.status)
            const open = o.status !== 'delivered' && o.status !== 'cancelled' && o.status !== 'refunded'

            return (
              <Panel key={o.id}>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <span>
                    <span className="block font-mono text-sm font-bold text-ink">{o.orderNo}</span>
                    <span className="mt-1 flex flex-wrap items-center gap-2">
                      <span
                        className={`rounded-full px-2 py-[2px] text-[11px] font-bold ${
                          o.status === 'delivered'
                            ? 'bg-emerald-100 text-emerald-900'
                            : o.status === 'cancelled' || o.status === 'refunded'
                              ? 'bg-stone-200 text-stone-700'
                              : 'bg-violet-tint text-violet-ink'
                        }`}
                      >
                        {LABEL[o.status] ?? o.status}
                      </span>
                      <span className="text-[11px] text-body">
                        {mine.length} item{mine.length === 1 ? '' : 's'} ·{' '}
                        {mine.map((i) => i.title).join(', ')}
                      </span>
                    </span>
                  </span>
                  <span className="text-right">
                    <span className="block text-[11px] text-faint">
                      {new Date(o.placedAt).toLocaleDateString('en-IN', {
                        day: 'numeric', month: 'short', year: 'numeric',
                      })}
                    </span>
                    <span className="block font-display text-lg font-extrabold text-ink">
                      {fmtInr(o.totalPaise)}
                    </span>
                  </span>
                </div>

                {open && (
                  <details open className="group mt-4 rounded-xl bg-subtle p-4">
                    <summary className="mb-3 cursor-pointer list-none text-[11px] font-bold text-violet-deep marker:content-['']">
                      <span className="group-open:hidden">Show tracking</span>
                      <span className="hidden group-open:inline">Hide tracking</span>
                    </summary>
                    <div className="mb-3 flex flex-wrap items-center justify-between gap-2 text-[11px]">
                      <span className="font-semibold text-ink">
                        {shipment?.awb ? `Tracking ${shipment.awb}` : 'Tracking starts at dispatch'}
                      </span>
                      <span className="text-body">
                        {shipment?.courier ?? 'Flat-pack courier'}
                      </span>
                    </div>

                    <ol className="flex flex-col">
                      {stages.map((s, i) => (
                        <li key={s.key} className="flex gap-3">
                          <span className="flex flex-col items-center">
                            <span
                              className={`mt-[2px] size-[10px] shrink-0 rounded-full ${
                                s.current
                                  ? 'bg-ink ring-4 ring-ink/15'
                                  : s.reached
                                    ? 'bg-violet'
                                    : 'border border-line bg-surface'
                              }`}
                            />
                            {i < stages.length - 1 && (
                              <span className={`h-7 w-px ${s.reached ? 'bg-violet' : 'bg-line'}`} />
                            )}
                          </span>
                          <span className="pb-3">
                            <span
                              className={`block text-[12px] font-semibold ${
                                s.reached ? 'text-ink' : 'text-faint'
                              }`}
                            >
                              {s.label}
                            </span>
                            <span className="block text-[11px] text-body">{s.detail}</span>
                          </span>
                        </li>
                      ))}
                    </ol>
                  </details>
                )}

                <details className="group mt-4 border-t border-line pt-3">
                  <summary className="cursor-pointer list-none text-[11px] font-bold text-violet-deep marker:content-['']">
                    <span className="group-open:hidden">View items</span>
                    <span className="hidden group-open:inline">Hide items</span>
                  </summary>
                  <ul className="mt-2 flex flex-col gap-1">
                    {mine.map((i) => (
                    <li key={i.id} className="flex items-center justify-between gap-3 text-[12px]">
                      <span className="min-w-0 text-body">
                        {i.title} · {fmtIn(i.widthTenths)} × {fmtIn(i.heightTenths)} in ·{' '}
                        {i.materialName} × {i.qty}
                      </span>
                      <span className="shrink-0 font-semibold text-ink">{fmtInr(i.linePaise)}</span>
                    </li>
                    ))}
                  </ul>
                </details>

                <form action={reorder} className="mt-3">
                  <input type="hidden" name="orderId" value={o.id} />
                  <button className="rounded-full bg-accent px-4 py-2 text-xs font-bold text-accent-ink">
                    Order again
                  </button>
                </form>
              </Panel>
            )
          })}
        </div>
      )}
    </AccountShell>
  )
}
