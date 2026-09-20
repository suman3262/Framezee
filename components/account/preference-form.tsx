'use client'

import { useActionState } from 'react'
import { savePreferences, type FormResult } from '@/app/actions/account.ts'
import { PREFERENCE_FIELDS, type Preferences } from '@/lib/preferences.ts'

export function PreferenceForm({ preferences }: { preferences: Preferences }) {
  const [state, action, pending] = useActionState<FormResult, FormData>(savePreferences, {})

  return (
    <form action={action} className="flex flex-col gap-1">
      {PREFERENCE_FIELDS.map((f) => {
        const locked = Boolean(f.locked)
        return (
          <label
            key={f.key}
            className={`flex items-start justify-between gap-4 border-b border-line py-4 last:border-0 ${
              locked ? '' : 'cursor-pointer'
            }`}
          >
            <span className="min-w-0">
              <span className="block text-[13px] font-bold text-ink">{f.label}</span>
              <span className="block text-xs leading-4 text-body">{f.hint}</span>
              {locked && <span className="mt-1 block text-[11px] text-faint">{f.locked}</span>}
            </span>

            <input
              type="checkbox"
              name={f.key}
              defaultChecked={preferences[f.key]}
              disabled={locked}
              className="mt-1 size-5 shrink-0 accent-[color:var(--violet-deep)] disabled:opacity-50"
            />
          </label>
        )
      })}

      <div className="mt-4 flex items-center gap-3">
        <button
          disabled={pending}
          className="rounded-full bg-accent px-5 py-2 text-[13px] font-bold text-accent-ink disabled:opacity-50"
        >
          {pending ? 'Saving…' : 'Save changes'}
        </button>
        {state.ok && !state.error && <span className="text-xs font-medium text-emerald-700">Saved</span>}
        {state.error && <span className="text-xs font-medium text-red-600">{state.error}</span>}
      </div>
    </form>
  )
}
