import { desc, sql } from 'drizzle-orm'
import { db } from '@/db/index.ts'
import { orderItems, orders, settings } from '@/db/schema.ts'
import { requireSuperAdmin } from '@/lib/auth.ts'
import { AdminShell, Card } from '@/components/admin/shell.tsx'
import { Empty } from '@/app/(admin)/admin/page.tsx'
import { fmtInr, fmtInrRupees } from '@/lib/pricing.ts'

/** Cancelled and refunded orders are money that never arrived, so they are left out. */
const EARNING = sql`${orders.status} not in ('cancelled','refunded')`

export default async function RevenueAnalytics() {
  const staff = await requireSuperAdmin()

  const [[totals], byMonth, byState, byMaterial, topFrames, [config], [taxSplit]] = await Promise.all([
    db
      .select({
        orders: sql<number>`count(*)::int`,
        gross: sql<number>`coalesce(sum(${orders.totalPaise}),0)::int`,
        goods: sql<number>`coalesce(sum(${orders.subtotalPaise}),0)::int`,
        discounts: sql<number>`coalesce(sum(${orders.couponDiscountPaise}),0)::int`,
        shipping: sql<number>`coalesce(sum(${orders.shippingPaise}),0)::int`,
        customers: sql<number>`count(distinct ${orders.userId})::int`,
      })
      .from(orders)
      .where(EARNING),
    db
      .select({
        month: sql<string>`to_char(${orders.placedAt}, 'Mon YYYY')`,
        sortKey: sql<string>`to_char(${orders.placedAt}, 'YYYY-MM')`,
        n: sql<number>`count(*)::int`,
        gross: sql<number>`coalesce(sum(${orders.totalPaise}),0)::int`,
      })
      .from(orders)
      .where(EARNING)
      .groupBy(sql`1, 2`)
      .orderBy(sql`2 desc`)
      .limit(12),
    db
      .select({
        state: sql<string>`${orders.address}->>'state'`,
        n: sql<number>`count(*)::int`,
        gross: sql<number>`coalesce(sum(${orders.totalPaise}),0)::int`,
      })
      .from(orders)
      .where(EARNING)
      .groupBy(sql`1`)
      .orderBy(sql`3 desc`),
    db
      .select({
        material: orderItems.materialName,
        units: sql<number>`coalesce(sum(${orderItems.qty}),0)::int`,
        gross: sql<number>`coalesce(sum(${orderItems.linePaise}),0)::int`,
      })
      .from(orderItems)
      .groupBy(orderItems.materialName)
      .orderBy(sql`3 desc`),
    db
      .select({
        title: orderItems.title,
        units: sql<number>`coalesce(sum(${orderItems.qty}),0)::int`,
        gross: sql<number>`coalesce(sum(${orderItems.linePaise}),0)::int`,
      })
      .from(orderItems)
      .groupBy(orderItems.title)
      .orderBy(sql`3 desc`)
      .limit(8),
    db.select().from(settings).limit(1),
    db
      .select({
        cgst: sql<number>`coalesce(sum(${orders.cgstPaise}),0)::int`,
        sgst: sql<number>`coalesce(sum(${orders.sgstPaise}),0)::int`,
        igst: sql<number>`coalesce(sum(${orders.igstPaise}),0)::int`,
      })
      .from(orders)
      .where(EARNING),
  ])

  const avg = totals.orders ? Math.round(totals.gross / totals.orders) : 0
  const gstTotal = taxSplit.cgst + taxSplit.sgst + taxSplit.igst
  const maxMonth = Math.max(1, ...byMonth.map((m) => m.gross))

  return (
    <AdminShell staff={staff} active="/admin/revenue" title="Revenue & Analytics">
      {totals.orders === 0 ? (
        <Card>
          <Empty>
            No earning orders yet. Run <code className="font-mono">npm run demo:orders</code> to
            see this populated.
          </Empty>
        </Card>
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Stat label="Collected" value={fmtInrRupees(totals.gross)} note="what customers paid" />
            <Stat label="Orders" value={String(totals.orders)} note={`${totals.customers} customers`} />
            <Stat label="Average order" value={fmtInrRupees(avg)} />
            <Stat
              label="GST inside that"
              value={config?.gstEnabled ? fmtInrRupees(gstTotal) : 'off'}
              note={config?.gstEnabled ? 'already included in the prices' : 'not being charged yet'}
            />
          </div>

          <div className="mt-4 grid gap-4 lg:grid-cols-2">
            <Card>
              <h2 className="mb-3 text-[11px] font-bold uppercase tracking-[0.05em] text-faint">
                By month
              </h2>
              <ul className="flex flex-col gap-2">
                {byMonth.map((m) => (
                  <li key={m.sortKey} className="flex items-center gap-3">
                    <span className="w-20 shrink-0 text-[12px] text-body">{m.month}</span>
                    <span className="h-2 flex-1 overflow-hidden rounded-full bg-subtle">
                      <span
                        className="block h-full rounded-full bg-violet"
                        style={{ width: `${Math.round((m.gross / maxMonth) * 100)}%` }}
                      />
                    </span>
                    <span className="w-24 shrink-0 text-right text-[12px] font-semibold text-ink">
                      {fmtInrRupees(m.gross)}
                    </span>
                    <span className="w-8 shrink-0 text-right text-[11px] text-faint">{m.n}</span>
                  </li>
                ))}
              </ul>
            </Card>

            <Card>
              <h2 className="mb-3 text-[11px] font-bold uppercase tracking-[0.05em] text-faint">
                Where it ships
              </h2>
              <ul className="flex flex-col gap-2">
                {byState.map((s) => (
                  <li key={s.state} className="flex items-center justify-between gap-3">
                    <span className="text-[13px] text-body">
                      {s.state}
                      {config && s.state === config.sellerState && (
                        <span className="ml-2 rounded-full bg-violet-tint px-2 py-[1px] text-[10px] font-bold text-violet-ink">
                          CGST+SGST
                        </span>
                      )}
                    </span>
                    <span className="text-[13px] font-semibold text-ink">
                      {fmtInrRupees(s.gross)}
                      <span className="ml-2 text-[11px] font-normal text-faint">{s.n}</span>
                    </span>
                  </li>
                ))}
              </ul>
            </Card>

            <Card>
              <h2 className="mb-3 text-[11px] font-bold uppercase tracking-[0.05em] text-faint">
                Mouldings sold
              </h2>
              <ul className="flex flex-col gap-2">
                {byMaterial.map((m) => (
                  <li key={m.material} className="flex items-center justify-between gap-3">
                    <span className="text-[13px] text-body">{m.material}</span>
                    <span className="text-[13px] font-semibold text-ink">
                      {fmtInrRupees(m.gross)}
                      <span className="ml-2 text-[11px] font-normal text-faint">{m.units} units</span>
                    </span>
                  </li>
                ))}
              </ul>
            </Card>

            <Card>
              <h2 className="mb-3 text-[11px] font-bold uppercase tracking-[0.05em] text-faint">
                Best sellers
              </h2>
              <ul className="flex flex-col gap-2">
                {topFrames.map((t) => (
                  <li key={t.title} className="flex items-center justify-between gap-3">
                    <span className="text-[13px] text-body">{t.title}</span>
                    <span className="text-[13px] font-semibold text-ink">
                      {fmtInrRupees(t.gross)}
                      <span className="ml-2 text-[11px] font-normal text-faint">{t.units}</span>
                    </span>
                  </li>
                ))}
              </ul>
            </Card>
          </div>

          <Card className="mt-4">
            <h2 className="mb-3 text-[11px] font-bold uppercase tracking-[0.05em] text-faint">
              How the money breaks down
            </h2>
            <dl className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
              <Line k="Goods" v={fmtInr(totals.goods)} />
              <Line k="Coupons given" v={`−${fmtInr(totals.discounts)}`} />
              <Line k="Delivery collected" v={fmtInr(totals.shipping)} />
              <Line k="GST included" v={fmtInr(gstTotal)} muted={!config?.gstEnabled} />
              <Line k="Collected" v={fmtInr(totals.gross)} strong />
            </dl>
            <p className="mt-3 text-[11px] leading-4 text-faint">
              Prices are GST-inclusive, so the GST figure is money already inside the total,
              not added to it. Cancelled and refunded orders are excluded throughout.
            </p>
          </Card>
        </>
      )}
    </AdminShell>
  )
}

function Stat({ label, value, note }: { label: string; value: string; note?: string }) {
  return (
    <Card>
      <p className="text-[11px] font-bold uppercase tracking-[0.05em] text-faint">{label}</p>
      <p className="mt-1 font-display text-2xl font-extrabold text-ink">{value}</p>
      {note && <p className="mt-[2px] text-[11px] text-faint">{note}</p>}
    </Card>
  )
}

function Line({ k, v, muted, strong }: { k: string; v: string; muted?: boolean; strong?: boolean }) {
  return (
    <div>
      <dt className="text-[11px] uppercase tracking-wide text-faint">{k}</dt>
      <dd className={`mt-[2px] ${strong ? 'font-display text-lg font-extrabold text-ink' : muted ? 'text-faint' : 'text-[15px] font-semibold text-ink'}`}>
        {v}
      </dd>
    </div>
  )
}
