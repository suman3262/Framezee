'use client'

import { useActionState, useState } from 'react'
import {
  createAdmin,
  setPermission,
  setSuspended,
  revokeStaff,
  setSuperAdmin,
  type StaffResult,
} from '@/app/actions/staff-admin.ts'
import { Icon } from '@/components/admin/shell.tsx'

export function CreateAdminForm() {
  const [state, action, pending] = useActionState<StaffResult, FormData>(createAdmin, {})

  return (
    <form action={action} className="flex flex-col gap-3">
      <Text label="Full name" name="name" placeholder="Priya Sharma" required />
      <Text label="Work email" name="email" type="email" placeholder="priya@framezee.in" required />
      <Text label="Mobile" name="phone" type="tel" placeholder="98765 43210" hint="Optional" />

      <fieldset className="flex flex-col gap-2">
        <legend className="mb-1 text-[11px] font-semibold uppercase tracking-[0.04em] text-t3">
          Permission
        </legend>
        <Radio
          name="permission"
          value="read"
          defaultChecked
          title="Read only"
          body="Can open orders, products and categories. Cannot change anything."
        />
        <Radio
          name="permission"
          value="read_write"
          title="Read and write"
          body="Can move orders through the workshop and edit the catalogue."
        />
      </fieldset>

      {state.error && <Note tone="bad">{state.error}</Note>}
      {state.ok && !state.error && (
        <div className="flex flex-col gap-2">
          <Note tone="ok">{state.ok}</Note>
          {state.password && <PasswordOnce value={state.password} />}
        </div>
      )}

      <button
        disabled={pending}
        className="rounded-lg bg-violet px-5 py-[10px] font-display text-[13px] font-bold text-white disabled:opacity-50"
      >
        {pending ? 'Creating…' : 'Create admin'}
      </button>
      <p className="text-[11px] leading-4 text-t3">
        They sign in at the staff door and set up an authenticator app before they can reach
        anything.
      </p>
    </form>
  )
}

/**
 * The first password, shown once. It is never stored anywhere we can read it back, so
 * the copy button matters more than it looks — reloading the page loses it and the
 * account has to be recreated.
 */
function PasswordOnce({ value }: { value: string }) {
  const [copied, setCopied] = useState(false)

  return (
    <div className="rounded-lg border border-warn/30 bg-warn-bg p-3">
      <p className="text-[11px] font-semibold uppercase tracking-[0.04em] text-warn">
        First password — shown once
      </p>
      <div className="mt-2 flex items-center gap-2">
        <code className="min-w-0 flex-1 break-all rounded bg-card px-2 py-[6px] font-mono text-[12px] text-t1">
          {value}
        </code>
        <button
          type="button"
          onClick={() => {
            navigator.clipboard?.writeText(value).then(
              () => setCopied(true),
              () => setCopied(false),
            )
          }}
          className="shrink-0 rounded bg-card px-2 py-[6px] text-[11px] font-bold text-violet-deep"
        >
          {copied ? 'Copied' : 'Copy'}
        </button>
      </div>
      <p className="mt-2 text-[11px] leading-4 text-warn">
        Reloading this page loses it. Send it to them another way than email.
      </p>
    </div>
  )
}

/** Everything a super-admin can do to one staff member, in one row of controls. */
export function StaffControls({
  id,
  role,
  permission,
  suspended,
  isMe,
  lastSuper,
}: {
  id: string
  role: string
  permission: string
  suspended: boolean
  isMe: boolean
  lastSuper: boolean
}) {
  const [permState, permAction, permPending] = useActionState<StaffResult, FormData>(setPermission, {})
  const [suspState, suspAction, suspPending] = useActionState<StaffResult, FormData>(setSuspended, {})
  const [revState, revAction, revPending] = useActionState<StaffResult, FormData>(revokeStaff, {})
  const [superState, superAction, superPending] = useActionState<StaffResult, FormData>(setSuperAdmin, {})

  const error = permState.error || suspState.error || revState.error || superState.error
  const ok = permState.ok || suspState.ok || revState.ok || superState.ok

  if (isMe)
    return (
      <span className="text-[11px] text-t3">
        You cannot change your own access — ask another super-admin.
      </span>
    )

  return (
    <div className="flex flex-col items-end gap-2">
      <div className="flex flex-wrap items-center justify-end gap-2">
        {role !== 'super_admin' && (
          <form action={permAction} className="flex items-center gap-1">
            <input type="hidden" name="id" value={id} />
            <select
              name="permission"
              defaultValue={permission}
              className="rounded-lg bg-subtle px-2 py-[5px] text-[12px] font-semibold text-t1"
            >
              <option value="read">read only</option>
              <option value="read_write">read and write</option>
            </select>
            <button
              disabled={permPending}
              className="rounded-lg px-2 py-[5px] text-[11px] font-bold text-violet-deep disabled:opacity-50"
            >
              {permPending ? '…' : 'Save'}
            </button>
          </form>
        )}

        <form action={superAction}>
          <input type="hidden" name="id" value={id} />
          <input type="hidden" name="promote" value={String(role !== 'super_admin')} />
          <Ghost disabled={superPending || (role === 'super_admin' && lastSuper)}>
            {role === 'super_admin' ? 'Make admin' : 'Make super'}
          </Ghost>
        </form>

        <form action={suspAction}>
          <input type="hidden" name="id" value={id} />
          <input type="hidden" name="suspend" value={String(!suspended)} />
          <Ghost disabled={suspPending || (!suspended && role === 'super_admin' && lastSuper)}>
            <Icon name={suspended ? 'lock_open' : 'lock'} className="text-[14px]" />
            {suspended ? 'Lift suspension' : 'Suspend'}
          </Ghost>
        </form>

        <form
          action={revAction}
          onSubmit={(e) => {
            if (!confirm('Remove dashboard access? Their orders and account stay.')) e.preventDefault()
          }}
        >
          <input type="hidden" name="id" value={id} />
          <button
            disabled={revPending || (role === 'super_admin' && lastSuper)}
            className="flex items-center gap-1 rounded-lg bg-bad-bg px-2 py-[5px] text-[11px] font-bold text-bad disabled:opacity-40"
          >
            <Icon name="person_remove" className="text-[14px]" />
            Revoke
          </button>
        </form>
      </div>

      {error && <span className="max-w-72 text-right text-[11px] font-medium text-bad">{error}</span>}
      {ok && !error && <span className="text-[11px] font-medium text-ok">{ok}</span>}
      {lastSuper && role === 'super_admin' && (
        <span className="text-[11px] text-t3">The only super-admin who can sign in.</span>
      )}
    </div>
  )
}

function Ghost({ disabled, children }: { disabled?: boolean; children: React.ReactNode }) {
  return (
    <button
      disabled={disabled}
      className="flex items-center gap-1 rounded-lg bg-subtle px-2 py-[5px] text-[11px] font-bold text-t2 disabled:opacity-40"
    >
      {children}
    </button>
  )
}

function Text({
  label,
  name,
  type = 'text',
  placeholder,
  hint,
  required,
}: {
  label: string
  name: string
  type?: string
  placeholder?: string
  hint?: string
  required?: boolean
}) {
  return (
    <label className="flex flex-col">
      <span className="mb-1 text-[11px] font-semibold uppercase tracking-[0.04em] text-t3">
        {label}
        {hint && <span className="ml-1 font-normal normal-case tracking-normal">· {hint}</span>}
      </span>
      <input
        name={name}
        type={type}
        placeholder={placeholder}
        required={required}
        className="rounded-lg border border-rule bg-card px-3 py-2 text-[13px] text-t1 outline-none focus:ring-2 focus:ring-violet/40"
      />
    </label>
  )
}

function Radio({
  name,
  value,
  title,
  body,
  defaultChecked,
}: {
  name: string
  value: string
  title: string
  body: string
  defaultChecked?: boolean
}) {
  return (
    <label className="flex cursor-pointer gap-2 rounded-lg bg-subtle p-2">
      <input
        type="radio"
        name={name}
        value={value}
        defaultChecked={defaultChecked}
        className="mt-[3px] size-[14px] shrink-0 accent-[color:var(--violet-deep)]"
      />
      <span>
        <span className="block text-[12px] font-bold text-t1">{title}</span>
        <span className="block text-[11px] leading-4 text-t3">{body}</span>
      </span>
    </label>
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
