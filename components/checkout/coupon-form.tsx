'use client'

import { useActionState } from 'react'
import { applyCouponToCart, removeCouponFromCart, type CouponFormResult } from '@/app/actions/cart.ts'
import { fmtInr } from '@/lib/pricing.ts'

export function CouponForm({
  applied,
  discountPaise,
  rejection,
}: {
  applied: string | null
  discountPaise: number
  rejection: string | null
}) {
  const [state, action, pending] = useActionState<CouponFormResult, FormData>(applyCouponToCart, {})

  if (applied && discountPaise > 0) {
    return (
      <div className="flex items-center justify-between gap-3 rounded-xl bg-violet-tint px-4 py-3">
        <span className="min-w-0">
          <span className="block text-[13px] font-bold text-violet-ink">{applied} applied</span>
          <span className="block text-xs text-violet-ink/80">
            −{fmtInr(discountPaise)} off your order
          </span>
        </span>
        <form action={removeCouponFromCart}>
          <button className="shrink-0 text-xs font-semibold text-violet-ink underline">
            Remove
          </button>
        </form>
      </div>
    )
  }

  return (
    <div>
      <form action={action} className="flex gap-2">
        <input
          name="code"
          placeholder="Coupon code"
          aria-label="Coupon code"
          autoCapitalize="characters"
          className="min-w-0 flex-1 rounded-full bg-subtle px-4 py-2 text-sm uppercase text-ink placeholder:normal-case placeholder:text-faint"
        />
        <button
          disabled={pending}
          className="shrink-0 rounded-full bg-ink px-4 py-2 text-xs font-bold text-page disabled:opacity-50"
        >
          {pending ? 'Checking…' : 'Apply'}
        </button>
      </form>

      {/* A code that stopped qualifying while the basket sat there says so. */}
      {(state.error || rejection) && (
        <p className="mt-2 text-xs font-medium text-red-600">{state.error ?? rejection}</p>
      )}
    </div>
  )
}
