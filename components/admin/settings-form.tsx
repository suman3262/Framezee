'use client'

import { useActionState } from 'react'
import { saveStoreSettings, type SaveResult } from '@/app/actions/pricing-admin.ts'

export function SettingsForm({
  flatShippingPaise,
  freeShippingThresholdPaise,
  sellerGstin,
  sellerState,
  gstEnabled,
  codEnabled,
}: {
  flatShippingPaise: number
  freeShippingThresholdPaise: number | null
  sellerGstin: string | null
  sellerState: string
  gstEnabled: boolean
  codEnabled: boolean
}) {
  const [state, action, pending] = useActionState<SaveResult, FormData>(saveStoreSettings, {})

  return (
    <form action={action} className="grid gap-4 sm:grid-cols-2">
      <Text label="Flat delivery (₹)" name="flatShipping" defaultValue={(flatShippingPaise / 100).toFixed(2)} />
      <Text
        label="Free delivery above (₹)"
        name="freeThreshold"
        defaultValue={freeShippingThresholdPaise !== null ? (freeShippingThresholdPaise / 100).toFixed(2) : ''}
        hint="Leave blank to always charge delivery. Measured after any coupon."
      />
      <Text label="Seller state" name="sellerState" defaultValue={sellerState} hint="Decides CGST+SGST vs IGST." />
      <Text label="GSTIN" name="sellerGstin" defaultValue={sellerGstin ?? ''} placeholder="19ABCDE1234F1Z5" />

      <Toggle
        name="gstEnabled"
        defaultChecked={gstEnabled}
        label="Charge GST"
        hint="Prices are GST-inclusive, so switching this on changes no price — only the invoice breakdown."
      />
      <Toggle
        name="codEnabled"
        defaultChecked={codEnabled}
        label="Cash on delivery"
        hint="Turn on once Razorpay has settled."
      />

      <div className="sm:col-span-2">
        {state.error && <p className="mb-2 text-xs font-medium text-red-600">{state.error}</p>}
        {state.ok && !state.error && <p className="mb-2 text-xs font-medium text-emerald-700">{state.ok}</p>}
        <button
          disabled={pending}
          className="rounded-full bg-accent px-5 py-2 text-[13px] font-bold text-accent-ink disabled:opacity-50"
        >
          {pending ? 'Saving…' : 'Save settings'}
        </button>
      </div>
    </form>
  )
}

function Text({
  label,
  name,
  defaultValue,
  placeholder,
  hint,
}: {
  label: string
  name: string
  defaultValue: string
  placeholder?: string
  hint?: string
}) {
  return (
    <label className="flex flex-col">
      <span className="mb-1 text-[10px] font-bold uppercase tracking-[0.05em] text-faint">{label}</span>
      <input
        name={name}
        defaultValue={defaultValue}
        placeholder={placeholder}
        className="rounded-lg bg-subtle px-3 py-2 text-[13px] text-ink"
      />
      {hint && <span className="mt-1 text-[11px] leading-4 text-faint">{hint}</span>}
    </label>
  )
}

function Toggle({
  name,
  defaultChecked,
  label,
  hint,
}: {
  name: string
  defaultChecked: boolean
  label: string
  hint: string
}) {
  return (
    <label className="flex gap-3 rounded-xl bg-subtle p-3">
      <input
        type="checkbox"
        name={name}
        defaultChecked={defaultChecked}
        className="mt-[2px] size-4 shrink-0 accent-[color:var(--violet-deep)]"
      />
      <span>
        <span className="block text-[13px] font-bold text-ink">{label}</span>
        <span className="block text-[11px] leading-4 text-body">{hint}</span>
      </span>
    </label>
  )
}
