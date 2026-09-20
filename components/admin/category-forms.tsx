'use client'

import { useActionState, useState } from 'react'
import {
  createCategory,
  renameCategory,
  deleteCategory,
  type CategoryResult,
} from '@/app/actions/category-admin.ts'
import { Icon } from '@/components/admin/shell.tsx'
import { IconPicker } from '@/components/admin/icon-picker.tsx'

export function AddCategoryForm() {
  const [state, action, pending] = useActionState<CategoryResult, FormData>(createCategory, {})
  const [name, setName] = useState('')
  const [open, setOpen] = useState(false)

  if (!open)
    return (
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-1 rounded-lg bg-violet px-4 py-2 font-display text-[13px] font-semibold text-white"
      >
        <Icon name="add_circle" className="text-[18px]" />
        Add category
      </button>
    )

  return (
    <form
      action={async (fd) => {
        await action(fd)
        setName('')
      }}
      className="flex w-full flex-col gap-3 rounded-xl bg-card p-4 shadow-[0_1px_2px_rgba(0,0,0,0.05)] sm:w-[420px]"
    >
      <div className="flex items-center justify-between">
        <h2 className="font-display text-[15px] font-semibold text-t1">New category</h2>
        <button type="button" onClick={() => setOpen(false)} aria-label="Close" className="text-t3">
          <Icon name="close" className="text-[18px]" />
        </button>
      </div>

      <label className="flex flex-col">
        <span className="mb-1 text-[11px] font-semibold uppercase tracking-[0.04em] text-t3">
          Name
        </span>
        <input
          name="name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
          maxLength={40}
          placeholder="Nature &amp; Botanical"
          className="w-full rounded-lg border border-rule bg-card px-3 py-2 text-[13px] text-t1 outline-none focus:ring-2 focus:ring-violet/40"
        />
      </label>

      <div className="flex flex-col">
        <span className="mb-1 text-[11px] font-semibold uppercase tracking-[0.04em] text-t3">
          Icon
        </span>
        <IconPicker name="icon" />
      </div>

      <p className="text-[11px] text-t3">
        Web address:{' '}
        <code className="font-mono text-t2">/browse?category={preview(name) || '…'}</code>
      </p>

      <label className="flex cursor-pointer items-center gap-2">
        <input
          type="checkbox"
          name="active"
          defaultChecked
          className="size-4 accent-[color:var(--violet-deep)]"
        />
        <span className="text-[12px] text-t2">Show on the storefront straight away</span>
      </label>

      {state.error && <Note tone="bad">{state.error}</Note>}
      {state.ok && !state.error && <Note tone="ok">{state.ok}</Note>}

      <button
        disabled={pending}
        className="rounded-lg bg-violet px-4 py-2 font-display text-[13px] font-bold text-white disabled:opacity-50"
      >
        {pending ? 'Adding…' : 'Add category'}
      </button>
    </form>
  )
}

/** Mirrors slugify() in the action, so what is previewed is what gets saved. */
function preview(name: string): string {
  return name
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48)
}

export function EditCategory({
  id,
  name,
  icon,
  slug,
  frames,
}: {
  id: string
  name: string
  icon: string | null
  slug: string
  frames: number
}) {
  const [editing, setEditing] = useState(false)
  const [state, action, pending] = useActionState<CategoryResult, FormData>(renameCategory, {})
  const [delState, delAction, delPending] = useActionState<CategoryResult, FormData>(deleteCategory, {})

  if (!editing)
    return (
      <span className="flex flex-col items-end gap-1">
        <span className="flex items-center gap-1">
          <button
            onClick={() => setEditing(true)}
            className="flex items-center gap-1 rounded-lg bg-subtle px-2 py-[5px] text-[11px] font-bold text-t2"
          >
            <Icon name="edit" className="text-[14px]" />
            Edit
          </button>
          <form
            action={delAction}
            onSubmit={(e) => {
              if (!confirm(`Delete "${name}"? This cannot be undone.`)) e.preventDefault()
            }}
          >
            <input type="hidden" name="id" value={id} />
            <button
              disabled={delPending || frames > 0}
              title={frames > 0 ? `${frames} frames are still in this category` : undefined}
              className="flex items-center gap-1 rounded-lg bg-bad-bg px-2 py-[5px] text-[11px] font-bold text-bad disabled:opacity-40"
            >
              <Icon name="delete" className="text-[14px]" />
              Delete
            </button>
          </form>
        </span>
        {delState.error && (
          <span className="max-w-72 text-right text-[11px] font-medium text-bad">{delState.error}</span>
        )}
        {state.ok && !state.error && <span className="text-[11px] text-ok">{state.ok}</span>}
      </span>
    )

  return (
    <form
      action={async (fd) => {
        await action(fd)
        setEditing(false)
      }}
      className="flex flex-col items-end gap-2"
    >
      <input type="hidden" name="id" value={id} />
      <div className="w-[320px]">
        <IconPicker name="icon" defaultValue={icon ?? ''} />
      </div>
      <span className="flex items-center gap-2">
        <input
          name="name"
          defaultValue={name}
          required
          maxLength={40}
          autoFocus
          className="w-48 rounded-lg border border-rule bg-card px-2 py-[5px] text-[13px] text-t1 outline-none focus:ring-2 focus:ring-violet/40"
        />
        <button
          disabled={pending}
          className="rounded-lg bg-violet px-2 py-[5px] text-[11px] font-bold text-white disabled:opacity-50"
        >
          {pending ? '…' : 'Save'}
        </button>
        <button
          type="button"
          onClick={() => setEditing(false)}
          className="rounded-lg px-2 py-[5px] text-[11px] font-bold text-t3"
        >
          Cancel
        </button>
      </span>

      <label className="flex cursor-pointer items-center gap-[6px]">
        <input type="checkbox" name="reslug" className="size-[13px] accent-[color:var(--violet-deep)]" />
        <span className="text-[11px] text-t3">
          Also update the web address (breaks existing links to <code className="font-mono">{slug}</code>)
        </span>
      </label>

      {state.error && <span className="text-[11px] font-medium text-bad">{state.error}</span>}
    </form>
  )
}

function Note({ tone, children }: { tone: 'ok' | 'bad'; children: React.ReactNode }) {
  return (
    <p
      className={`rounded-lg px-3 py-2 text-xs font-medium ${
        tone === 'ok' ? 'bg-ok-bg text-ok' : 'bg-bad-bg text-bad'
      }`}
    >
      {children}
    </p>
  )
}
