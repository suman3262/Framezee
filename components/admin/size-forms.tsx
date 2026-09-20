'use client'

import { useActionState, useState } from 'react'
import {
  addSize,
  addThickness,
  updateThickness,
  addMatBand,
  type SizeResult,
} from '@/app/actions/size-admin.ts'
import { Icon } from '@/components/admin/shell.tsx'

export function AddSizeForm() {
  const [state, action, pending] = useActionState<SizeResult, FormData>(addSize, {})

  return (
    <form action={action} className="flex flex-wrap items-end gap-2">
      <Num label="Width (in)" name="width" placeholder="24" />
      <span className="pb-2 text-t3">×</span>
      <Num label="Height (in)" name="height" placeholder="36" />
      <label className="flex items-center gap-[6px] pb-2">
        <input type="checkbox" name="active" defaultChecked className="size-4 accent-[color:var(--violet-deep)]" />
        <span className="text-[12px] text-t2">Offer it</span>
      </label>
      <button
        disabled={pending}
        className="rounded-lg bg-violet px-3 py-[7px] text-[12px] font-bold text-white disabled:opacity-50"
      >
        {pending ? 'Adding…' : 'Add size'}
      </button>
      <Note state={state} />
    </form>
  )
}

export function AddThicknessForm() {
  const [state, action, pending] = useActionState<SizeResult, FormData>(addThickness, {})

  return (
    <form action={action} className="flex flex-wrap items-end gap-2">
      <Num label="Inches" name="thickness" placeholder="2" wide={false} />
      <Text label="Label" name="label" placeholder="2 inch" />
      <Num label="Max long side" name="maxLong" placeholder="any" />
      <Num label="Max short side" name="maxShort" placeholder="any" />
      <button
        disabled={pending}
        className="rounded-lg bg-violet px-3 py-[7px] text-[12px] font-bold text-white disabled:opacity-50"
      >
        {pending ? 'Adding…' : 'Add thickness'}
      </button>
      <Note state={state} />
    </form>
  )
}

export function EditThickness({
  id,
  label,
  maxLong,
  maxShort,
}: {
  id: string
  label: string
  maxLong: string
  maxShort: string
}) {
  const [open, setOpen] = useState(false)
  const [state, action, pending] = useActionState<SizeResult, FormData>(updateThickness, {})

  if (!open)
    return (
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-1 rounded-lg bg-subtle px-2 py-[5px] text-[11px] font-bold text-t2"
      >
        <Icon name="edit" className="text-[14px]" />
        Edit
      </button>
    )

  return (
    <form
      action={async (fd) => {
        await action(fd)
        setOpen(false)
      }}
      className="flex flex-wrap items-end gap-2"
    >
      <input type="hidden" name="id" value={id} />
      <Text label="Label" name="label" defaultValue={label} />
      <Num label="Max long" name="maxLong" defaultValue={maxLong} placeholder="any" />
      <Num label="Max short" name="maxShort" defaultValue={maxShort} placeholder="any" />
      <button
        disabled={pending}
        className="rounded-lg bg-violet px-2 py-[6px] text-[11px] font-bold text-white disabled:opacity-50"
      >
        {pending ? '…' : 'Save'}
      </button>
      <button type="button" onClick={() => setOpen(false)} className="px-2 py-[6px] text-[11px] font-bold text-t3">
        Cancel
      </button>
      <Note state={state} />
    </form>
  )
}

export function AddMatBandForm({ hasBands }: { hasBands: boolean }) {
  const [state, action, pending] = useActionState<SizeResult, FormData>(addMatBand, {})
  const [open, setOpen] = useState(false)

  if (!open)
    return (
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-1 rounded-lg bg-violet px-3 py-[6px] font-display text-[13px] font-semibold text-white"
      >
        <Icon name="add_circle" className="text-[16px]" />
        {hasBands ? 'Add band' : 'Start charging for the mat'}
      </button>
    )

  return (
    <form action={action} className="flex flex-wrap items-end gap-2 rounded-lg bg-warn-bg p-3">
      <Num label="Up to width (in)" name="maxWidth" placeholder="60" />
      <Num label="Up to height (in)" name="maxHeight" placeholder="60" />
      <Num label="Rate ₹/sq-in" name="rate" placeholder="1.50" />
      <button
        disabled={pending}
        className="rounded-lg bg-violet px-3 py-[7px] text-[12px] font-bold text-white disabled:opacity-50"
      >
        {pending ? 'Saving…' : 'Add band'}
      </button>
      <button type="button" onClick={() => setOpen(false)} className="px-2 py-[7px] text-[12px] font-bold text-t3">
        Cancel
      </button>
      <p className="w-full text-[11px] leading-4 text-warn">
        This takes effect everywhere at once. Baskets reprice on their next load; orders
        already placed keep the totals they were charged.
      </p>
      <Note state={state} />
    </form>
  )
}

function Num({
  label,
  name,
  placeholder,
  defaultValue,
  wide = true,
}: {
  label: string
  name: string
  placeholder?: string
  defaultValue?: string
  wide?: boolean
}) {
  return (
    <label className="flex flex-col">
      <span className="mb-1 text-[10px] font-semibold uppercase tracking-[0.04em] text-t3">{label}</span>
      <input
        name={name}
        inputMode="decimal"
        defaultValue={defaultValue}
        placeholder={placeholder}
        className={`rounded-lg border border-rule bg-card px-2 py-[6px] text-[12px] text-t1 outline-none focus:ring-2 focus:ring-violet/40 ${
          wide ? 'w-[110px]' : 'w-[80px]'
        }`}
      />
    </label>
  )
}

function Text({
  label,
  name,
  placeholder,
  defaultValue,
}: {
  label: string
  name: string
  placeholder?: string
  defaultValue?: string
}) {
  return (
    <label className="flex flex-col">
      <span className="mb-1 text-[10px] font-semibold uppercase tracking-[0.04em] text-t3">{label}</span>
      <input
        name={name}
        defaultValue={defaultValue}
        placeholder={placeholder}
        className="w-[130px] rounded-lg border border-rule bg-card px-2 py-[6px] text-[12px] text-t1 outline-none focus:ring-2 focus:ring-violet/40"
      />
    </label>
  )
}

function Note({ state }: { state: SizeResult }) {
  if (state.error)
    return <span className="w-full text-[11px] font-medium text-bad">{state.error}</span>
  if (state.ok) return <span className="w-full text-[11px] font-medium text-ok">{state.ok}</span>
  return null
}
