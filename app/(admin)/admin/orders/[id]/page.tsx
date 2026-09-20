import Link from 'next/link'
import { notFound } from 'next/navigation'
import { eq } from 'drizzle-orm'
import { db } from '@/db/index.ts'
import { orderItems, orders, payments, shipments, users } from '@/db/schema.ts'
import { requireStaff } from '@/lib/auth.ts'
import { AdminShell, Card, StatusPill } from '@/components/admin/shell.tsx'
import { when } from '@/app/(admin)/admin/page.tsx'
import { advanceOrder } from '@/app/actions/admin.ts'
import { signArtworks } from '@/lib/artwork-file.ts'
import { nextStatuses, STATUS_LABEL } from '@/lib/order-status.ts'
import { fmtIn, fmtInr } from '@/lib/pricing.ts'
import { formatPhone } from '@/lib/phone.ts'

export default async function AdminOrderDetail({ params }: { params: Promise<{ id: string }> }) {
  const staff = await requireStaff()
  const { id } = await params

  const [order] = await db
    .select({ order: orders, customer: users })
    .from(orders)
    .leftJoin(users, eq(orders.userId, users.id))
    .where(eq(orders.id, id))
    .limit(1)

  if (!order) notFound()

  const [items, [payment], [shipment]] = await Promise.all([
    db.select().from(orderItems).where(eq(orderItems.orderId, id)),
    db.select().from(payments).where(eq(payments.orderId, id)).limit(1),
    db.select().from(shipments).where(eq(shipments.orderId, id)).limit(1),
  ])

  // One pass for every attached photograph; the links last an hour.
  const signed = await signArtworks(items.map((i) => i.printImagePath))

  const o = order.order
  const addr = o.address as {
    name: string; phone: string; line1: string; line2: string | null
    city: string; state: string; pincode: string
  }
  const moves = nextStatuses(o.status)

  return (
    <AdminShell staff={staff} active="/admin/orders" title={o.orderNo}>
      <Link href="/admin/orders" className="mb-4 inline-block text-xs font-semibold text-violet-deep">
        ← All orders
      </Link>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="flex flex-col gap-4">
          <Card>
            <div className="mb-4 flex flex-wrap items-center gap-3">
              <StatusPill status={o.status} />
              <span className="text-xs text-body">
                Placed {when(o.placedAt)} · {o.paymentMethod.toUpperCase()}
              </span>
            </div>

            {/* Only legal moves are offered — see lib/order-status.ts */}
            {moves.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {moves.map((to) => (
                  <form key={to} action={advanceOrder}>
                    <input type="hidden" name="id" value={o.id} />
                    <input type="hidden" name="to" value={to} />
                    <button
                      className={`rounded-full px-4 py-2 text-xs font-bold ${
                        to === 'cancelled'
                          ? 'bg-subtle text-body hover:text-red-700'
                          : 'bg-accent text-accent-ink'
                      }`}
                    >
                      {STATUS_LABEL[to] ?? to}
                    </button>
                  </form>
                ))}
              </div>
            ) : (
              <p className="text-xs text-faint">This order is complete. Nothing more to do.</p>
            )}

            {o.status === 'paid' && (
              <p className="mt-3 text-[11px] leading-4 text-faint">
                Marking this ready to ship will also create the Shiprocket shipment and AWB
                once Sprint 7 is wired up. For now it only moves the status.
              </p>
            )}
          </Card>

          <Card className="!p-0">
            <h2 className="px-5 pt-5 text-[11px] font-bold uppercase tracking-[0.05em] text-faint">
              What to make
            </h2>
            <ul className="mt-3 divide-y divide-line">
              {items.map((i) => (
                <li key={i.id} className="px-5 py-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <p className="text-sm font-bold text-ink">
                        {i.title} <span className="text-body">× {i.qty}</span>
                      </p>
                      <dl className="mt-2 grid grid-cols-2 gap-x-6 gap-y-1 text-[12px] sm:grid-cols-3">
                        <Spec k="Size" v={`${fmtIn(i.widthTenths)} × ${fmtIn(i.heightTenths)} in`} />
                        <Spec k="Moulding" v={i.materialName} />
                        <Spec k="Thickness" v={i.thicknessTenths === 5 ? '1/2 inch' : '1 inch'} />
                        <Spec k="Mat" v={i.matBoard ? (i.matColour ?? 'Yes') : 'None'} />
                        <Spec k="Glazing" v={i.glazingName ?? '—'} />
                        <Spec k="Print" v={i.printService ? (i.paperName ?? 'Yes') : 'Frame only'} />
                      </dl>

                      {i.printImagePath && (
                        <div className="mt-2 flex items-center gap-3 rounded-lg bg-subtle p-3">
                          {signed.get(i.printImagePath) ? (
                            <>
                              <a
                                href={signed.get(i.printImagePath)}
                                target="_blank"
                                rel="noreferrer"
                                className="shrink-0"
                              >
                                <img
                                  src={signed.get(i.printImagePath)}
                                  alt="Customer's photograph"
                                  className="size-16 rounded object-cover ring-1 ring-black/10"
                                />
                              </a>
                              <span className="min-w-0 flex-1">
                                <span className="block text-[12px] font-bold text-ink">
                                  Customer&rsquo;s photograph
                                </span>
                                <span className="block truncate font-mono text-[11px] text-faint">
                                  {i.printImagePath}
                                </span>
                              </span>
                              <a
                                href={signed.get(i.printImagePath)}
                                download
                                className="shrink-0 rounded-lg bg-violet px-3 py-[6px] text-[11px] font-bold text-white"
                              >
                                Download
                              </a>
                            </>
                          ) : (
                            <span className="text-[11px] leading-4 text-body">
                              Artwork attached at{' '}
                              <code className="font-mono">{i.printImagePath}</code>, but it could
                              not be signed for download. Check{' '}
                              <code className="font-mono">SUPABASE_SERVICE_ROLE_KEY</code>.
                            </span>
                          )}
                        </div>
                      )}
                    </div>

                    <span className="shrink-0 text-right">
                      <span className="block text-sm font-bold text-ink">{fmtInr(i.linePaise)}</span>
                      <span className="block text-[11px] text-faint">
                        {fmtInr(i.unitPricePaise)} each
                      </span>
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          </Card>
        </div>

        <div className="flex flex-col gap-4">
          <Card>
            <h2 className="mb-2 text-[11px] font-bold uppercase tracking-[0.05em] text-faint">
              Deliver to
            </h2>
            <p className="text-[13px] font-bold text-ink">{addr.name}</p>
            <p className="text-[12px] leading-5 text-body">
              {formatPhone(addr.phone)}
              <br />
              {addr.line1}
              {addr.line2 ? `, ${addr.line2}` : ''}
              <br />
              {addr.city}, {addr.state} – {addr.pincode}
            </p>
            {order.customer?.email && (
              <p className="mt-2 text-[11px] text-faint">{order.customer.email}</p>
            )}
          </Card>

          <Card>
            <h2 className="mb-3 text-[11px] font-bold uppercase tracking-[0.05em] text-faint">
              Money
            </h2>
            <dl className="flex flex-col gap-2 text-[13px]">
              <Row k="Subtotal" v={fmtInr(o.subtotalPaise)} />
              {o.couponDiscountPaise > 0 && (
                <Row k={`Coupon ${o.couponCode ?? ''}`} v={`−${fmtInr(o.couponDiscountPaise)}`} />
              )}
              <Row k="Delivery" v={o.shippingPaise === 0 ? 'Free' : fmtInr(o.shippingPaise)} />
              {o.cgstPaise > 0 && <Row k="CGST" v={fmtInr(o.cgstPaise)} muted />}
              {o.sgstPaise > 0 && <Row k="SGST" v={fmtInr(o.sgstPaise)} muted />}
              {o.igstPaise > 0 && <Row k="IGST" v={fmtInr(o.igstPaise)} muted />}
            </dl>
            <div className="mt-3 flex items-center justify-between border-t border-line pt-3">
              <span className="text-sm font-bold text-ink">Total</span>
              <span className="font-display text-lg font-extrabold text-ink">
                {fmtInr(o.totalPaise)}
              </span>
            </div>
            <p className="mt-2 text-[11px] text-faint">
              These figures are frozen. Changing a rate today does not alter this order.
            </p>
          </Card>

          <Card>
            <h2 className="mb-2 text-[11px] font-bold uppercase tracking-[0.05em] text-faint">
              Payment &amp; shipment
            </h2>
            <p className="text-[12px] text-body">
              {payment
                ? `${payment.provider} · ${payment.status}`
                : o.paymentMethod === 'cod'
                  ? 'Cash on delivery'
                  : 'No payment record — created before Razorpay was wired up.'}
            </p>
            <p className="mt-1 text-[12px] text-body">
              {shipment?.awb ? `AWB ${shipment.awb} · ${shipment.courier}` : 'No shipment yet (Sprint 7).'}
            </p>
          </Card>
        </div>
      </div>
    </AdminShell>
  )
}

function Spec({ k, v }: { k: string; v: string }) {
  return (
    <div>
      <dt className="text-[10px] uppercase tracking-wide text-faint">{k}</dt>
      <dd className="font-medium text-ink">{v}</dd>
    </div>
  )
}

function Row({ k, v, muted }: { k: string; v: string; muted?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <dt className={muted ? 'text-faint' : 'text-body'}>{k}</dt>
      <dd className={muted ? 'text-faint' : 'font-medium text-ink'}>{v}</dd>
    </div>
  )
}
