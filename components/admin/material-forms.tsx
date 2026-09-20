'use client'

import { useActionState, useState } from 'react'
import {
  createMaterial,
  updateMaterial,
  deleteMaterial,
  createGlazing,
  deleteGlazing,
  createPaper,
  deletePaper,
  type MaterialResult,
} from '@/app/actions/material-admin.ts'
import { Icon } from '@/components/admin/shell.tsx'

export type MaterialDraft = {
  id?: string
  name: string
  kind: string
  swatch: string
  description: string | null
  gstRatePercent: string
  hsnCode: string | null
  minWidth: string
  maxWidth: string
  minHeight: string
  maxHeight: string
}

const BLANK: MaterialDraft = {
  name: '',
  kind: 'wood',
  swatch: '#8b5e3c',
  description: null,
  gstRatePercent: '12',
  hsnCode: '4414',
  minWidth: '4',
  maxWidth: '60',
  minHeight: '4',
  maxHeight: '60',
}

export function AddMouldingButton() {
  const [open, setOpen] = useState(false)
  if (!open) return <Trigger onClick={() => setOpen(true)}>Add moulding</Trigger>
  return <MouldingEditor draft={BLANK} onClose={() => setOpen(false)} />
}

export function EditMouldingButton({ draft, usedBy }: { draft: MaterialDraft; usedBy: number }) {
  const [open, setOpen] = useState(false)
  const [state, action, pending] = useActionState<MaterialResult, FormData>(deleteMaterial, {})

  return (
    <>
      <span className="flex flex-col items-end gap-1">
        <span className="flex items-center gap-1">
          <button
            onClick={() => setOpen(true)}
            className="flex items-center gap-1 rounded-lg bg-subtle px-2 py-[5px] text-[11px] font-bold text-t2"
          >
            <Icon name="edit" className="text-[14px]" />
            Edit
          </button>
          <form
            action={action}
            onSubmit={(e) => {
              if (!confirm(`Delete "${draft.name}"? This cannot be undone.`)) e.preventDefault()
            }}
          >
            <input type="hidden" name="id" value={draft.id} />
            <button
              disabled={pending || usedBy > 0}
              title={usedBy > 0 ? `${usedBy} frames default to this moulding` : undefined}
              className="flex items-center gap-1 rounded-lg bg-bad-bg px-2 py-[5px] text-[11px] font-bold text-bad disabled:opacity-40"
            >
              <Icon name="delete" className="text-[14px]" />
              Delete
            </button>
          </form>
        </span>
        {state.error && (
          <span className="max-w-96 text-right text-[11px] font-medium text-bad">{state.error}</span>
        )}
      </span>

      {open && <MouldingEditor draft={draft} onClose={() => setOpen(false)} />}
    </>
  )
}

function MouldingEditor({ draft, onClose }: { draft: MaterialDraft; onClose: () => void }) {
  const editing = Boolean(draft.id)
  const [state, action, pending] = useActionState<MaterialResult, FormData>(
    editing ? updateMaterial : createMaterial,
    {},
  )
  const [swatch, setSwatch] = useState(draft.swatch)

  return (
    <Modal title={editing ? `Edit ${draft.name}` : 'New moulding'} onClose={onClose}>
      <form action={action} className="flex flex-col gap-3">
        {editing && <input type="hidden" name="id" value={draft.id} />}

        <div className="grid grid-cols-[1fr_110px] gap-3">
          <Field label="Name" name="name" defaultValue={draft.name} required placeholder="Natural Oak" />
          <label className="flex flex-col">
            <Label>Swatch</Label>
            <span className="flex items-center gap-2">
              <input
                type="color"
                value={swatch}
                onChange={(e) => setSwatch(e.target.value)}
                className="size-9 shrink-0 cursor-pointer rounded border border-rule bg-card"
                aria-label="Swatch colour"
              />
              <input
                name="swatch"
                value={swatch}
                onChange={(e) => setSwatch(e.target.value)}
                className="min-w-0 flex-1 rounded-lg border border-rule bg-card px-2 py-2 font-mono text-[11px] text-t1 outline-none"
              />
            </span>
          </label>
        </div>

        <div className="grid grid-cols-3 gap-3">
          <label className="flex flex-col">
            <Label>Kind</Label>
            <select
              name="kind"
              defaultValue={draft.kind}
              className="rounded-lg border border-rule bg-card px-3 py-2 text-[13px] text-t1 outline-none"
            >
              {['wood', 'metal', 'composite', 'acrylic'].map((k) => (
                <option key={k} value={k}>
                  {k}
                </option>
              ))}
            </select>
          </label>
          <Field label="GST %" name="gstRate" defaultValue={draft.gstRatePercent} required placeholder="12" />
          <Field label="HSN code" name="hsnCode" defaultValue={draft.hsnCode ?? ''} placeholder="4414" />
        </div>

        <fieldset className="rounded-lg bg-subtle p-3">
          <legend className="px-1 text-[11px] font-semibold uppercase tracking-[0.04em] text-t3">
            Size limits, in inches
          </legend>
          <div className="grid grid-cols-4 gap-2">
            <Field label="Min width" name="minWidth" defaultValue={draft.minWidth} required small />
            <Field label="Max width" name="maxWidth" defaultValue={draft.maxWidth} required small />
            <Field label="Min height" name="minHeight" defaultValue={draft.minHeight} required small />
            <Field label="Max height" name="maxHeight" defaultValue={draft.maxHeight} required small />
          </div>
          <p className="mt-2 text-[11px] leading-4 text-t3">
            A size outside these is refused rather than quoted. This is what the workshop can
            physically cut in this moulding.
          </p>
        </fieldset>

        <Field
          label="Description"
          name="description"
          defaultValue={draft.description ?? ''}
          placeholder="Honey-toned oak, 15 mm face, 9 mm rebate"
        />

        {!editing && (
          <div className="rounded-lg bg-warn-bg p-3">
            <Field label="Starting rate ₹ per sq-in" name="rate" required placeholder="4.00" />
            <p className="mt-2 text-[11px] leading-4 text-warn">
              Added hidden, with this one band covering its full size range. Refine the rate
              card, then mark it Offered — the moment it is offered it appears as a finish on
              every frame in the shop.
            </p>
          </div>
        )}

        <Result state={state} />
        <Actions pending={pending} onClose={onClose} label={editing ? 'Save changes' : 'Add moulding'} />
      </form>
    </Modal>
  )
}

export function AddGlazingButton({ hasIncluded }: { hasIncluded: boolean }) {
  const [open, setOpen] = useState(false)
  const [state, action, pending] = useActionState<MaterialResult, FormData>(createGlazing, {})
  const [included, setIncluded] = useState(false)

  if (!open) return <Trigger onClick={() => setOpen(true)}>Add glazing</Trigger>

  return (
    <Modal title="New glazing" onClose={() => setOpen(false)}>
      <form action={action} className="flex flex-col gap-3">
        <Field label="Name" name="name" required placeholder="UV acrylic, 99% filtration" />
        <Field label="Description" name="description" placeholder="Museum-grade, shatter resistant" />
        <div className="grid grid-cols-2 gap-3">
          <Field label="GST %" name="gstRate" defaultValue="18" required />
          <Field label="HSN code" name="hsnCode" placeholder="3920" />
        </div>

        <label className={`flex gap-2 rounded-lg p-2 ${hasIncluded ? 'bg-subtle opacity-60' : 'cursor-pointer bg-subtle'}`}>
          <input
            type="checkbox"
            name="included"
            disabled={hasIncluded}
            checked={included}
            onChange={(e) => setIncluded(e.target.checked)}
            className="mt-[3px] size-4 shrink-0 accent-[color:var(--violet-deep)]"
          />
          <span>
            <span className="block text-[12px] font-bold text-t1">Included in the frame price</span>
            <span className="block text-[11px] leading-4 text-t3">
              {hasIncluded
                ? 'There is already one. Only a single glazing can be part of the frame price.'
                : 'Free at every size, still named on the invoice.'}
            </span>
          </span>
        </label>

        {!included && <Field label="Rate ₹ per sq-in" name="rate" required placeholder="6.05" />}

        <Result state={state} />
        <Actions pending={pending} onClose={() => setOpen(false)} label="Add glazing" />
      </form>
    </Modal>
  )
}

export function AddPaperButton() {
  const [open, setOpen] = useState(false)
  const [state, action, pending] = useActionState<MaterialResult, FormData>(createPaper, {})

  if (!open) return <Trigger onClick={() => setOpen(true)}>Add paper</Trigger>

  return (
    <Modal title="New print paper" onClose={() => setOpen(false)}>
      <form action={action} className="flex flex-col gap-3">
        <Field label="Name" name="name" required placeholder="Fine art rag, 310 gsm" />
        <Field label="Description" name="description" placeholder="Matte cotton, archival inks" />
        <div className="grid grid-cols-2 gap-3">
          <Field label="GST %" name="gstRate" defaultValue="12" required />
          <Field label="HSN code" name="hsnCode" placeholder="4911" />
        </div>
        <Field label="Rate ₹ per sq-in" name="rate" required placeholder="2.00" />
        <Result state={state} />
        <Actions pending={pending} onClose={() => setOpen(false)} label="Add paper" />
      </form>
    </Modal>
  )
}

/** Delete for glazing and papers — same shape, different action. */
export function DeleteSimple({ id, name, kind }: { id: string; name: string; kind: 'glazing' | 'paper' }) {
  const [state, action, pending] = useActionState<MaterialResult, FormData>(
    kind === 'glazing' ? deleteGlazing : deletePaper,
    {},
  )
  return (
    <span className="flex flex-col items-end gap-1">
      <form
        action={action}
        onSubmit={(e) => {
          if (!confirm(`Delete "${name}"?`)) e.preventDefault()
        }}
      >
        <input type="hidden" name="id" value={id} />
        <button
          disabled={pending}
          className="flex items-center gap-1 rounded-lg bg-bad-bg px-2 py-[5px] text-[11px] font-bold text-bad disabled:opacity-40"
        >
          <Icon name="delete" className="text-[14px]" />
          Delete
        </button>
      </form>
      {state.error && (
        <span className="max-w-96 text-right text-[11px] font-medium text-bad">{state.error}</span>
      )}
    </span>
  )
}

// ── shared bits ─────────────────────────────────────────────────────────────

function Trigger({ onClick, children }: { onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className="flex items-center gap-1 rounded-lg bg-violet px-3 py-[6px] font-display text-[13px] font-semibold text-white"
    >
      <Icon name="add_circle" className="text-[16px]" />
      {children}
    </button>
  )
}

function Modal({
  title,
  onClose,
  children,
}: {
  title: string
  onClose: () => void
  children: React.ReactNode
}) {
  return (
    <div className="fixed inset-0 z-[60] flex items-start justify-center overflow-y-auto bg-black/40 p-4">
      <div className="my-6 w-full max-w-[560px] rounded-xl bg-card p-5 shadow-2xl">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-display text-xl font-bold text-t1">{title}</h2>
          <button onClick={onClose} aria-label="Close" className="text-t3 hover:text-t1">
            <Icon name="close" className="text-[20px]" />
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}

function Label({ children }: { children: React.ReactNode }) {
  return (
    <span className="mb-1 block text-[11px] font-semibold uppercase tracking-[0.04em] text-t3">
      {children}
    </span>
  )
}

function Field({
  label,
  name,
  defaultValue,
  placeholder,
  required,
  small,
}: {
  label: string
  name: string
  defaultValue?: string
  placeholder?: string
  required?: boolean
  small?: boolean
}) {
  return (
    <label className="flex min-w-0 flex-col">
      <Label>{label}</Label>
      <input
        name={name}
        defaultValue={defaultValue}
        placeholder={placeholder}
        required={required}
        className={`w-full rounded-lg border border-rule bg-card outline-none focus:ring-2 focus:ring-violet/40 ${
          small ? 'px-2 py-[6px] text-[12px]' : 'px-3 py-2 text-[13px]'
        } text-t1`}
      />
    </label>
  )
}

function Result({ state }: { state: MaterialResult }) {
  if (state.error)
    return <p className="rounded-lg bg-bad-bg px-3 py-2 text-xs font-medium text-bad">{state.error}</p>
  if (state.ok)
    return <p className="rounded-lg bg-ok-bg px-3 py-2 text-xs font-medium text-ok">{state.ok}</p>
  return null
}

function Actions({
  pending,
  onClose,
  label,
}: {
  pending: boolean
  onClose: () => void
  label: string
}) {
  return (
    <div className="flex items-center justify-end gap-2">
      <button type="button" onClick={onClose} className="px-3 py-2 text-[13px] font-semibold text-t3">
        Close
      </button>
      <button
        disabled={pending}
        className="rounded-lg bg-violet px-5 py-2 font-display text-[13px] font-bold text-white disabled:opacity-50"
      >
        {pending ? 'Saving…' : label}
      </button>
    </div>
  )
}
