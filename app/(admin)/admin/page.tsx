import Link from 'next/link'
import { desc, eq, inArray, sql } from 'drizzle-orm'
import { db } from '@/db/index.ts'
import { categories, orderItems, orders, products, users } from '@/db/schema.ts'
import { requireStaff } from '@/lib/auth.ts'
import { AdminShell, Card, Icon, StatusPill } from '@/components/admin/shell.tsx'
import { IntakeChart } from '@/components/admin/intake-chart.tsx'
import { fmtIn, fmtInr, fmtInrRupees } from '@/lib/pricing.ts'

/**
 * Figma: framezee_super_admin_dashboard_desktop — six metric cards beside an intake
 * chart, then the workshop backlog.
 *
 * The design fills these with invented numbers (1,842 orders, 14 artisans). Every figure
 * here is the real query instead, so an empty database honestly reads zero.
 */
export default async function AdminDashboard() {
  const staff = await requireStaff()

  const [[totals], byStatus, pending, pendingItems, [catalogue], daily, topCategory, topProduct] =
    await Promise.all([
      db
        .select({
          orders: sql<number>`count(*)::int`,
          revenue: sql<number>`coalesce(sum(${orders.totalPaise}), 0)::int`,
          customers: sql<number>`count(distinct ${orders.userId})::int`,
        })
        .from(orders)
        .where(sql`${orders.status} not in ('cancelled','refunded')`),

      db
        .select({ status: orders.status, n: sql<number>`count(*)::int` })
        .from(orders)
        .groupBy(orders.status),

      // The backlog: paid or cut but not yet handed to a courier, oldest first — the
      // order the workshop should actually work through.
      db
        .select({
          id: orders.id,
          orderNo: orders.orderNo,
          status: orders.status,
          totalPaise: orders.totalPaise,
          placedAt: orders.placedAt,
          paymentMethod: orders.paymentMethod,
          customer: users.name,
          phone: users.phone,
          address: orders.address,
        })
        .from(orders)
        .leftJoin(users, eq(orders.userId, users.id))
        .where(sql`${orders.status} in ('paid','ready_to_ship')`)
        .orderBy(orders.placedAt)
        .limit(6),

      // Every line of those six orders in one go. This used to be a query per row, fired
      // from inside the row component — which made the page's fan-out grow with the
      // backlog, and a wide fan-out is exactly what the connection pool cannot take.
      db
        .select({
          orderId: orderItems.orderId,
          title: orderItems.title,
          qty: orderItems.qty,
          w: orderItems.widthTenths,
          h: orderItems.heightTenths,
          material: orderItems.materialName,
          glazing: orderItems.glazingName,
          mat: orderItems.matBoard,
          print: orderItems.printService,
        })
        .from(orderItems)
        .where(
          inArray(
            orderItems.orderId,
            db
              .select({ id: orders.id })
              .from(orders)
              .where(sql`${orders.status} in ('paid','ready_to_ship')`)
              .orderBy(orders.placedAt)
              .limit(6),
          ),
        ),

      db.select({ n: sql<number>`count(*)::int` }).from(products).where(eq(products.active, true)),

      // Seven days of intake for the chart. generate_series keeps quiet days at zero
      // rather than dropping them, so the line does not lie about the shape of a week.
      db.execute<{ day: string; n: number; revenue: number }>(sql`
        select to_char(d.day, 'Dy') as day,
               count(o.id)::int as n,
               coalesce(sum(o.total_paise), 0)::int as revenue
        from generate_series(current_date - interval '6 days', current_date, interval '1 day') d(day)
        left join orders o
          on o.created_at >= d.day and o.created_at < d.day + interval '1 day'
         and o.status not in ('cancelled','refunded')
        group by d.day order by d.day
      `),

      // Item titles are frozen text, so the category comes back through the product
      // title. A retired product simply drops out rather than breaking the query.
      db
        .select({ name: categories.name, revenue: sql<number>`sum(${orderItems.linePaise})::int` })
        .from(orderItems)
        .innerJoin(orders, eq(orderItems.orderId, orders.id))
        .innerJoin(products, eq(products.title, orderItems.title))
        .innerJoin(categories, eq(products.categoryId, categories.id))
        .where(sql`${orders.status} not in ('cancelled','refunded')`)
        .groupBy(categories.name)
        .orderBy(desc(sql`sum(${orderItems.linePaise})`))
        .limit(1),

      db
        .select({
          title: orderItems.title,
          material: orderItems.materialName,
          units: sql<number>`sum(${orderItems.qty})::int`,
          w: sql<number>`max(${orderItems.widthTenths})::int`,
          h: sql<number>`max(${orderItems.heightTenths})::int`,
        })
        .from(orderItems)
        .innerJoin(orders, eq(orderItems.orderId, orders.id))
        .where(sql`${orders.status} not in ('cancelled','refunded')`)
        .groupBy(orderItems.title, orderItems.materialName)
        .orderBy(desc(sql`sum(${orderItems.qty})`))
        .limit(1),
    ])

  const itemsByOrder = new Map<string, typeof pendingItems>()
  for (const it of pendingItems) {
    const list = itemsByOrder.get(it.orderId)
    if (list) list.push(it)
    else itemsByOrder.set(it.orderId, [it])
  }

  const counts = Object.fromEntries(byStatus.map((s) => [s.status, s.n]))
  const placed = Object.values(counts).reduce((a, b) => a + b, 0)
  const needsAction = (counts.paid ?? 0) + (counts.ready_to_ship ?? 0)
  const lost = (counts.cancelled ?? 0) + (counts.refunded ?? 0)
  const lostRate = placed > 0 ? (lost / placed) * 100 : 0
  const avg = totals.orders > 0 ? Math.round(totals.revenue / totals.orders) : 0

  const series = daily.map((d) => ({ day: d.day.trim(), n: Number(d.n), revenue: Number(d.revenue) }))
  const peak = series.reduce((a, b) => (b.n >= a.n ? b : a), series[0] ?? { day: '—', n: 0, revenue: 0 })
  const categoryRevenue = topCategory[0]?.revenue ?? 0
  const categoryShare = totals.revenue > 0 ? Math.round((categoryRevenue / totals.revenue) * 100) : 0

  return (
    <AdminShell
      staff={staff}
      active="/admin"
      eyebrow="Operations cockpit"
      title="Studio & order control"
      pendingCount={needsAction || undefined}
      actions={
        <span className="flex flex-wrap items-center gap-2">
          <span className="flex items-center gap-[6px] rounded-lg bg-card px-3 py-[6px] shadow-sm">
            <Icon name="calendar_month" className="text-[18px] text-violet-deep" />
            <span className="text-[12px] font-medium text-t2">Last 7 days</span>
          </span>
          <span className="flex items-center gap-[6px] rounded-lg bg-ok-bg px-3 py-[6px]">
            <span className="size-2 animate-pulse rounded-full bg-ok" />
            <span className="text-[11px] font-semibold uppercase tracking-[0.03em] text-ok">
              {needsAction} in the workshop
            </span>
          </span>
        </span>
      }
    >
      <div className="grid gap-5 lg:grid-cols-12">
        <div className="grid gap-5 sm:grid-cols-2 md:grid-cols-3 lg:col-span-7">
          <Metric
            label="Total orders"
            icon="shopping_bag"
            value={String(totals.orders)}
            foot={<span className="text-[12px] text-t3">{totals.customers} customers</span>}
          />
          <Metric
            label="Pending orders"
            icon="pending_actions"
            value={String(needsAction)}
            tone={needsAction > 0 ? 'warn' : undefined}
            foot={
              needsAction > 0 ? (
                <Tag tone="warn">Action required</Tag>
              ) : (
                <span className="text-[12px] text-t3">Nothing waiting</span>
              )
            }
          />
          <Metric
            label="Cancelled & refunded"
            icon="cancel"
            value={String(lost)}
            foot={
              <span className="flex items-center gap-2">
                <Tag tone={lostRate > 5 ? 'bad' : 'ok'}>{lostRate.toFixed(2)}% rate</Tag>
                <span className="text-[12px] text-t3">{lostRate > 5 ? 'Worth a look' : 'Safe range'}</span>
              </span>
            }
          />
          <Metric
            label="Top category"
            icon="water_drop"
            value={topCategory[0]?.name ?? '—'}
            small
            foot={
              topCategory[0] ? (
                <span className="flex flex-col gap-[6px]">
                  <span className="text-[12px] text-t3">
                    {fmtInrRupees(categoryRevenue)} · {categoryShare}% share
                  </span>
                  <span className="h-1 w-full rounded-full bg-subtle">
                    <span
                      className="block h-1 rounded-full bg-violet"
                      style={{ width: `${Math.min(100, categoryShare)}%` }}
                    />
                  </span>
                </span>
              ) : (
                <span className="text-[12px] text-t3">No sales yet</span>
              )
            }
          />
          <Metric
            label="Top frame"
            icon="star"
            value={topProduct[0]?.title ?? '—'}
            small
            foot={
              topProduct[0] ? (
                <span className="flex flex-col gap-[2px]">
                  <span className="text-[12px] text-t3">
                    {topProduct[0].units} units · {topProduct[0].material}
                  </span>
                  <span className="text-[12px] text-t3">
                    up to {fmtIn(topProduct[0].w)} × {fmtIn(topProduct[0].h)} in
                  </span>
                </span>
              ) : (
                <span className="text-[12px] text-t3">No sales yet</span>
              )
            }
          />
          <Metric
            label="Total earnings"
            icon="currency_rupee"
            value={fmtInrRupees(totals.revenue)}
            foot={
              <span className="flex items-center gap-2">
                <Tag tone="ok">Avg {fmtInrRupees(avg)}</Tag>
                <span className="text-[12px] text-t3">GST inclusive</span>
              </span>
            }
          />
        </div>

        <Card className="lg:col-span-5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <span className="flex items-center gap-[6px] text-[11px] font-semibold uppercase tracking-[0.03em] text-violet-deep">
                <span className="size-2 rounded-full bg-violet" />
                Volume velocity
              </span>
              <h2 className="mt-1 font-display text-[18px] font-semibold text-t1">
                Order intake &amp; rate
              </h2>
            </div>
            {peak.n > 0 && (
              <Tag tone="ok">Peak {peak.day}</Tag>
            )}
          </div>

          <IntakeChart series={series} />

          <div className="mt-3 grid grid-cols-3 gap-2 rounded-lg bg-subtle p-3">
            <Figure label="Avg basket" value={fmtInrRupees(avg)} />
            <Figure label="Peak day" value={peak.n > 0 ? `${peak.n} orders` : '—'} accent />
            <Figure
              label="Fulfilled"
              value={placed > 0 ? `${(100 - lostRate).toFixed(1)}%` : '—'}
            />
          </div>
        </Card>
      </div>

      <Card className="mt-1 p-0">
        <div className="flex flex-col gap-3 p-4 md:flex-row md:items-start md:justify-between">
          <div>
            <h2 className="flex flex-wrap items-center gap-2 font-display text-[18px] font-semibold text-t1">
              Pending orders (not yet dispatched)
              {needsAction > 0 && <Tag tone="warn">{needsAction} requiring workshop action</Tag>}
            </h2>
            <p className="mt-1 max-w-lg text-[12px] text-t3">
              Live fabrication backlog across joinery, mount matting and glazing, oldest first.
            </p>
          </div>
          <Link
            href="/admin/orders"
            className="flex shrink-0 items-center gap-1 self-start rounded-lg bg-violet px-3 py-[6px] font-display text-[13px] font-semibold text-white"
          >
            <Icon name="list_alt" className="text-[16px]" />
            All orders
          </Link>
        </div>

        {pending.length === 0 ? (
          <p className="border-t border-rule px-4 py-10 text-center text-[13px] text-t3">
            Nothing waiting on the workshop. Run{' '}
            <code className="font-mono text-t2">npm run demo:orders</code> for realistic data, or
            wait for the first real checkout.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[820px] border-collapse text-left">
              <thead>
                <tr className="border-y border-rule bg-subtle">
                  {['Order & customer', 'Craft specifications', 'Placed', 'Workshop status', 'Order value', ''].map(
                    (h) => (
                      <th
                        key={h}
                        className="px-4 py-3 text-[11px] font-semibold uppercase tracking-[0.03em] text-t3"
                      >
                        {h}
                      </th>
                    ),
                  )}
                </tr>
              </thead>
              <tbody>
                {pending.map((o) => (
                  <Row key={o.id} order={o} items={itemsByOrder.get(o.id) ?? []} />
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-rule px-4 py-3">
          <p className="text-[12px] text-t3">
            Showing {pending.length} of {needsAction} pending
            {(counts.paid ?? 0) > 0 && (
              <>
                {' · '}
                <span className="font-semibold text-warn">
                  {counts.paid} awaiting the first cut
                </span>
              </>
            )}
          </p>
          <p className="text-[12px] text-t3">
            <span className="font-semibold text-t2">{catalogue.n}</span> active frames ·{' '}
            <Link href="/admin/products" className="font-semibold text-violet-deep">
              Manage
            </Link>
          </p>
        </div>
      </Card>
    </AdminShell>
  )
}

/** A pending order, with enough craft detail to act on without opening it. */
function Row({
  order,
  items,
}: {
  items: Array<{
    title: string
    qty: number
    w: number
    h: number
    material: string | null
    glazing: string | null
    mat: boolean | null
    print: boolean | null
  }>
  order: {
    id: string
    orderNo: string
    status: string
    totalPaise: number
    placedAt: Date
    paymentMethod: string
    customer: string | null
    phone: string | null
    address: unknown
  }
}) {
  const city = (order.address as { city?: string } | null)?.city

  return (
    <tr className="border-b border-rule align-top last:border-0 hover:bg-subtle/60">
      <td className="px-4 py-4">
        <Link href={`/admin/orders/${order.id}`} className="font-mono text-[12px] font-semibold text-violet-deep">
          {order.orderNo}
        </Link>
        <p className="mt-1 font-display text-[13px] font-semibold text-t1">
          {order.customer || 'Customer'}
        </p>
        <p className="text-[12px] text-t3">
          {[order.phone, city].filter(Boolean).join(' · ') || '—'}
        </p>
      </td>

      <td className="px-4 py-4">
        {items.map((it, i) => (
          <div key={i} className={i > 0 ? 'mt-2 border-t border-rule pt-2' : ''}>
            <p className="text-[13px] font-semibold text-t1">
              <span className="text-t3">{it.qty} ×</span> {fmtIn(it.w)} × {fmtIn(it.h)} in
            </p>
            <p className="text-[12px] text-t3">
              {[
                it.material,
                it.glazing,
                it.mat ? 'mat board' : null,
                it.print ? 'print & mount' : 'frame only',
              ]
                .filter(Boolean)
                .join(' · ')}
            </p>
          </div>
        ))}
      </td>

      <td className="px-4 py-4 text-[12px] text-t3">{when(order.placedAt)}</td>

      <td className="px-4 py-4">
        <StatusPill status={order.status} />
        <p className="mt-1 text-[12px] text-t3">
          {order.status === 'paid' ? 'Awaiting timber cut' : 'Ready for courier'}
        </p>
      </td>

      <td className="px-4 py-4">
        <p className="font-display text-[15px] font-bold text-t1">{fmtInr(order.totalPaise)}</p>
        <p className="text-[12px] text-t3">{order.paymentMethod}</p>
      </td>

      <td className="px-4 py-4 text-right">
        <Link
          href={`/admin/orders/${order.id}`}
          className="inline-flex items-center gap-1 rounded-lg bg-violet-tint px-3 py-[6px] text-[12px] font-semibold text-violet-ink"
        >
          <Icon name="arrow_forward" className="text-[16px]" />
          Open
        </Link>
      </td>
    </tr>
  )
}

function Metric({
  label,
  icon,
  value,
  foot,
  tone,
  small,
}: {
  label: string
  icon: string
  value: string
  foot?: React.ReactNode
  tone?: 'warn'
  small?: boolean
}) {
  return (
    <Card className={`flex flex-col justify-between gap-2 ${tone === 'warn' ? 'ring-1 ring-warn/30' : ''}`}>
      <div className="flex items-start justify-between gap-2">
        <span className="text-[12px] text-t3">{label}</span>
        <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-subtle text-violet-deep">
          <Icon name={icon} className="text-[18px]" />
        </span>
      </div>
      <p
        className={`font-display font-bold tracking-[-0.01em] text-t1 ${
          small ? 'text-[18px] leading-6' : 'text-[28px] leading-8'
        }`}
      >
        {value}
      </p>
      {foot}
    </Card>
  )
}

function Tag({ tone, children }: { tone: 'ok' | 'warn' | 'bad'; children: React.ReactNode }) {
  const c = { ok: 'bg-ok-bg text-ok', warn: 'bg-warn-bg text-warn', bad: 'bg-bad-bg text-bad' }[tone]
  return (
    <span className={`inline-flex whitespace-nowrap rounded px-[6px] py-[2px] text-[11px] font-semibold ${c}`}>
      {children}
    </span>
  )
}

function Figure({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <span className="flex flex-col gap-[2px]">
      <span className="text-[11px] text-t3">{label}</span>
      <span className={`font-display text-[15px] font-semibold ${accent ? 'text-violet-deep' : 'text-t1'}`}>
        {value}
      </span>
    </span>
  )
}

export function when(date: Date): string {
  const mins = Math.floor((Date.now() - date.getTime()) / 60_000)
  if (mins < 60) return `${Math.max(1, mins)} min ago`
  if (mins < 1440) return `${Math.floor(mins / 60)} hr ago`
  const days = Math.floor(mins / 1440)
  if (days === 1) return 'yesterday'
  if (days < 30) return `${days} days ago`
  return date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
}

export function Empty({ children }: { children: React.ReactNode }) {
  return <p className="py-6 text-center text-[13px] text-t3">{children}</p>
}
