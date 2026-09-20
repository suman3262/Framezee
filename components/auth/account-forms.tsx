'use client'

import { useActionState } from 'react'
import { saveProfile, addAddress, type FormResult } from '@/app/actions/account.ts'

const INDIAN_STATES = [
  'Andhra Pradesh', 'Arunachal Pradesh', 'Assam', 'Bihar', 'Chhattisgarh', 'Goa', 'Gujarat',
  'Haryana', 'Himachal Pradesh', 'Jharkhand', 'Karnataka', 'Kerala', 'Madhya Pradesh',
  'Maharashtra', 'Manipur', 'Meghalaya', 'Mizoram', 'Nagaland', 'Odisha', 'Punjab',
  'Rajasthan', 'Sikkim', 'Tamil Nadu', 'Telangana', 'Tripura', 'Uttar Pradesh',
  'Uttarakhand', 'West Bengal', 'Andaman and Nicobar Islands', 'Chandigarh',
  'Dadra and Nagar Haveli and Daman and Diu', 'Delhi', 'Jammu and Kashmir', 'Ladakh',
  'Lakshadweep', 'Puducherry',
]

const field =
  'w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm text-ink placeholder:text-faint'

export function ProfileForm({ name }: { name: string }) {
  const [state, action, pending] = useActionState<FormResult, FormData>(saveProfile, {})

  return (
    <form action={action} className="flex flex-col gap-3 sm:flex-row sm:items-end">
      <label className="flex-1">
        <span className="mb-1 block text-xs font-semibold text-body">Your name</span>
        <input name="name" defaultValue={name} placeholder="Suman Dutta" className={field} />
      </label>
      <button
        disabled={pending}
        className="rounded-lg bg-accent px-4 py-2 text-sm font-bold text-accent-ink disabled:opacity-50"
      >
        {pending ? 'Saving…' : 'Save'}
      </button>
      {state.error && <p className="text-xs font-medium text-red-600">{state.error}</p>}
      {state.ok && !state.error && <p className="text-xs font-medium text-emerald-600">Saved</p>}
    </form>
  )
}

export function AddAddressForm() {
  const [state, action, pending] = useActionState<FormResult, FormData>(addAddress, {})

  return (
    <form action={action} className="grid gap-3 sm:grid-cols-2">
      <input name="label" placeholder="Nickname — Home, Studio" className={field} />
      <input name="name" placeholder="Recipient name" className={field} />
      <input name="phone" placeholder="Mobile number" inputMode="numeric" className={field} />
      <input name="line1" placeholder="House, street" className={`${field} sm:col-span-2`} />
      <input name="line2" placeholder="Area, landmark (optional)" className={`${field} sm:col-span-2`} />
      <input name="city" placeholder="City" className={field} />
      <input name="pincode" placeholder="PIN code" inputMode="numeric" maxLength={6} className={field} />
      <select name="state" defaultValue="West Bengal" className={`${field} sm:col-span-2`}>
        {INDIAN_STATES.map((s) => (
          <option key={s}>{s}</option>
        ))}
      </select>

      {state.error && (
        <p className="text-xs font-medium text-red-600 sm:col-span-2">{state.error}</p>
      )}

      <button
        disabled={pending}
        className="rounded-lg bg-accent px-4 py-2 text-sm font-bold text-accent-ink disabled:opacity-50 sm:col-span-2"
      >
        {pending ? 'Saving…' : 'Add address'}
      </button>
    </form>
  )
}
