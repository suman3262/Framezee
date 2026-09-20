import { asc, eq, sql } from 'drizzle-orm'
import { db } from '@/db/index.ts'
import { couponRedemptions, coupons, orders } from '@/db/schema.ts'
import { requireSuperAdmin } from '@/lib/auth.ts'
import { AdminShell, Card } from '@/components/admin/shell.tsx'
import { CouponForm } from '@/components/admin/coupon-form.tsx'
import { toggleCoupon } from '@/app/actions/coupon-admin.ts'
import { fmtInr } from '@/lib/pricing.ts'

export default async function CouponsAdmin() {
  const staff = await requireSuperAdmin()

  const rows = await db
    .select({
      c: coupons,
      redeemed: sql<number>`(select count(*)::int from ${couponRedemptions}
                              where ${couponRedemptions.couponId} = ${coupons.id})`,
      given: sql<number>`(select coalesce(sum(${orders.couponDiscountPaise}),0)::int from ${orders}
                           where ${orders.couponCode} = ${coupons.code})`,
    })
    .from(coupons)
    .orderBy(asc(coupons.code))

  return (
    <AdminShell staff={staff} active="/admin/coupons" title="Coupons">
      <p className="mb-5 max-w-3xl text-sm text-body">
        Codes customers type at checkout. Only the code is stored on a basket — the discount
        is recomputed every time it renders, so switching one off or letting it expire stops
        it applying immediately, even for a basket that is already open.
      </p>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_360px]">
        <Card className="!p-0">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-left">
              <thead>
                <tr className="border-b border-line text-[10px] font-bold uppercase tracking-[0.05em] text-faint">
                  <th className="px-4 py-3">Code</th>
                  <th className="px-4 py-3">Discount</th>
                  <th className="px-4 py-3">Conditions</th>
                  <th className="px-4 py-3">Used</th>
                  <th className="px-4 py-3">Given away</th>
                  <th className="px-4 py-3 text-right">Live</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {rows.map(({ c, redeemed, given }) => (
                  <tr key={c.id} className={c.active ? '' : 'opacity-55'}>
                    <td className="px-4 py-3">
                      <span className="font-mono text-[13px] font-bold text-ink">{c.code}</span>
                      {c.newCustomersOnly && (
                        <span className="ml-2 rounded-full bg-violet-tint px-2 py-[1px] text-[10px] font-bold text-violet-ink">
                          1st order
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-[13px] font-semibold text-ink">
                      {c.type === 'percent' ? `${c.value / 100}%` : fmtInr(c.value)}
                      {c.maxDiscountPaise != null && (
                        <span className="block text-[11px] font-normal text-faint">
                          max {fmtInr(c.maxDiscountPaise)}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-[12px] leading-5 text-body">
                      {c.minOrderPaise > 0 ? `over ${fmtInr(c.minOrderPaise)}` : 'any order'}
                      {c.usageLimit != null && <span className="block">{c.usageLimit} uses max</span>}
                      {c.endsAt && (
                        <span className="block">
                          until {new Date(c.endsAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-[13px] text-body">
                      {redeemed}
                      {c.usageLimit != null && <span className="text-faint"> / {c.usageLimit}</span>}
                    </td>
                    <td className="px-4 py-3 text-[13px] text-body">{given > 0 ? fmtInr(given) : '—'}</td>
                    <td className="px-4 py-3 text-right">
                      <form action={toggleCoupon}>
                        <input type="hidden" name="id" value={c.id} />
                        <input type="hidden" name="active" value={String(!c.active)} />
                        <button
                          className={`rounded-full px-3 py-1 text-[11px] font-bold ${
                            c.active ? 'bg-emerald-100 text-emerald-900' : 'bg-subtle text-body'
                          }`}
                        >
                          {c.active ? 'Live' : 'Off'}
                        </button>
                      </form>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>

        <Card className="h-fit">
          <h2 className="mb-3 text-[11px] font-bold uppercase tracking-[0.05em] text-faint">
            New coupon
          </h2>
          <CouponForm />
        </Card>
      </div>

      <Card className="mt-4">
        <h2 className="mb-3 text-[11px] font-bold uppercase tracking-[0.05em] text-faint">
          Edit an existing code
        </h2>
        <div className="flex flex-col gap-6">
          {rows.map(({ c }) => (
            <details key={c.id} className="rounded-xl bg-subtle p-4">
              <summary className="cursor-pointer font-mono text-[13px] font-bold text-ink">
                {c.code}
              </summary>
              <div className="mt-4">
                <CouponForm
                  draft={{
                    id: c.id,
                    code: c.code,
                    type: c.type,
                    value: c.value,
                    minOrderPaise: c.minOrderPaise,
                    maxDiscountPaise: c.maxDiscountPaise,
                    newCustomersOnly: c.newCustomersOnly,
                    usageLimit: c.usageLimit,
                    endsAt: c.endsAt,
                    active: c.active,
                  }}
                />
              </div>
            </details>
          ))}
        </div>
      </Card>
    </AdminShell>
  )
}
