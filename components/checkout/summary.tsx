import { fmtInr } from '@/lib/pricing.ts'
import type { TaxResult } from '@/lib/tax.ts'

export function OrderSummary({
  subtotalPaise,
  discountPaise,
  couponCode,
  shippingPaise,
  tax,
  totalPaise,
  freeShippingThresholdPaise,
  children,
}: {
  subtotalPaise: number
  discountPaise: number
  couponCode: string | null
  shippingPaise: number
  tax: TaxResult | null
  totalPaise: number
  freeShippingThresholdPaise: number | null
  children?: React.ReactNode
}) {
  const away =
    freeShippingThresholdPaise !== null && shippingPaise > 0
      ? freeShippingThresholdPaise - (subtotalPaise - discountPaise)
      : null

  return (
    <aside className="h-fit rounded-2xl bg-surface p-5 shadow-[0_1px_1px_rgba(0,0,0,0.05)]">
      <h2 className="text-[11px] font-bold uppercase tracking-[0.05em] text-faint">
        Order summary
      </h2>

      <dl className="mt-3 flex flex-col gap-2 text-[13px]">
        <Row label="Subtotal" value={fmtInr(subtotalPaise)} />
        {discountPaise > 0 && (
          <Row label={`Coupon ${couponCode ?? ''}`.trim()} value={`−${fmtInr(discountPaise)}`} good />
        )}
        <Row
          label="Flat-pack delivery"
          value={shippingPaise === 0 ? 'Free' : fmtInr(shippingPaise)}
        />
        {tax && tax.totalTaxPaise > 0 && (
          <Row
            label={tax.intraState ? 'CGST + SGST (included)' : 'IGST (included)'}
            value={fmtInr(tax.totalTaxPaise)}
            muted
          />
        )}
      </dl>

      <div className="mt-3 flex items-center justify-between border-t border-line pt-3">
        <span className="text-sm font-bold text-ink">Total</span>
        <span className="font-display text-xl font-extrabold text-ink">{fmtInr(totalPaise)}</span>
      </div>

      {away !== null && away > 0 && (
        <p className="mt-2 text-[11px] text-faint">
          Add {fmtInr(away)} more for free flat-pack delivery.
        </p>
      )}

      {children}
    </aside>
  )
}

function Row({
  label,
  value,
  muted,
  good,
}: {
  label: string
  value: string
  muted?: boolean
  good?: boolean
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <dt className={muted ? 'text-faint' : 'text-body'}>{label}</dt>
      <dd
        className={
          good ? 'font-semibold text-violet-ink' : muted ? 'text-faint' : 'font-medium text-ink'
        }
      >
        {value}
      </dd>
    </div>
  )
}
