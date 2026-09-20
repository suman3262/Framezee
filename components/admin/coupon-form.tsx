'use client'

import { useActionState, useState } from 'react'
import { saveCoupon, type CouponSaveResult } from '@/app/actions/coupon-admin.ts'

export type CouponDraft = {
  id?: string
  code?: string
  type?: 'percent' | 'flat'
  value?: number
  minOrderPaise?: number
  maxDiscountPaise?: number | null
  newCustomersOnly?: boolean
  usageLimit?: number | null
  endsAt?: Date | null
  active?: boolean
}

export function CouponForm({ draft, onDone }: { draft?: CouponDraft; onDone?: () => void }) {
  const [state, action, pending] = useActionState<CouponSaveResult, FormData>(saveCoupon, {})
  const [type, setType] = useState<'percent' | 'flat'>(draft?.type ?? 'percent')

  const value =
    draft?.value === undefined
      ? ''
      : (draft.type ?? 'percent') === 'percent'
        ? String(draft.value / 100)
        : (draft.value / 100).toFixed(2)

  return (
    <form action={action} className="grid gap-3 sm:grid-cols-2">
      {draft?.id && <input type="hidden" name="id" value={draft.id} />}

      <Field label="Code" name="code" defaultValue={draft?.code ?? ''} placeholder="FRAME10" />

      <label className="flex flex-col">
        <span className="mb-1 text-[10px] font-bold uppercase tracking-[0.05em] text-faint">Type</span>
        <select
          name="type"
          value={type}
          onChange={(e) => setType(e.target.value as 'percent' | 'flat')}
          className="rounded-lg bg-subtle px-3 py-2 text-[13px] text-ink"
        >
          <option value="percent">Percent off</option>
          <option value="flat">Flat amount off</option>
        </select>
      </label>

      <Field
        label={type === 'percent' ? 'Discount (%)' : 'Discount (₹)'}
        name="value"
        defaultValue={value}
        placeholder={type === 'percent' ? '10' : '150'}
      />
      <Field
        label="Minimum order (₹)"
        name="minOrder"
        defaultValue={draft?.minOrderPaise !== undefined ? (draft.minOrderPaise / 100).toFixed(2) : '0'}
      />
      <Field
        label="Cap the discount at (₹)"
        name="maxDiscount"
        defaultValue={draft?.maxDiscountPaise != null ? (draft.maxDiscountPaise / 100).toFixed(2) : ''}
        hint="Blank for no cap. Without one, a percent code on a large order can cost a lot."
      />
      <Field
        label="Total uses allowed"
        name="usageLimit"
        defaultValue={draft?.usageLimit != null ? String(draft.usageLimit) : ''}
        hint="Blank for unlimited."
      />
      <Field
        label="Ends on"
        name="endsAt"
        type="date"
        defaultValue={draft?.endsAt ? new Date(draft.endsAt).toISOString().slice(0, 10) : ''}
        hint="Blank to run until switched off."
      />

      <div className="flex flex-col gap-2 sm:col-span-2 sm:flex-row">
        <Check name="newCustomersOnly" defaultChecked={draft?.newCustomersOnly ?? false} label="First order only" />
        <Check name="active" defaultChecked={draft?.active ?? true} label="Active" />
      </div>

      <div className="sm:col-span-2">
        {state.error && <p className="mb-2 text-xs font-medium text-red-600">{state.error}</p>}
        {state.ok && !state.error && (
          <p className="mb-2 text-xs font-medium text-emerald-700">
            {state.ok}
            {onDone && (
              <button type="button" onClick={onDone} className="ml-2 underline">
                close
              </button>
            )}
          </p>
        )}
        <button
          disabled={pending}
          className="rounded-full bg-accent px-5 py-2 text-[13px] font-bold text-accent-ink disabled:opacity-50"
        >
          {pending ? 'Saving…' : draft?.id ? 'Save coupon' : 'Create coupon'}
        </button>
      </div>
    </form>
  )
}

function Field({
  label,
  name,
  defaultValue,
  placeholder,
  hint,
  type = 'text',
}: {
  label: string
  name: string
  defaultValue: string
  placeholder?: string
  hint?: string
  type?: string
}) {
  return (
    <label className="flex flex-col">
      <span className="mb-1 text-[10px] font-bold uppercase tracking-[0.05em] text-faint">{label}</span>
      <input
        name={name}
        type={type}
        defaultValue={defaultValue}
        placeholder={placeholder}
        className="rounded-lg bg-subtle px-3 py-2 text-[13px] text-ink"
      />
      {hint && <span className="mt-1 text-[11px] leading-4 text-faint">{hint}</span>}
    </label>
  )
}

function Check({ name, defaultChecked, label }: { name: string; defaultChecked: boolean; label: string }) {
  return (
    <label className="flex items-center gap-2 rounded-xl bg-subtle px-3 py-2">
      <input
        type="checkbox"
        name={name}
        defaultChecked={defaultChecked}
        className="size-4 accent-[color:var(--violet-deep)]"
      />
      <span className="text-[13px] font-semibold text-ink">{label}</span>
    </label>
  )
}
