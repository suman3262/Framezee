'use client'

import { useState } from 'react'

/**
 * Picking the emoji that sits on a category pill.
 *
 * A click-to-pick grid rather than a picker library: the storefront only ever shows one
 * character, the useful set is small and stable, and the field still takes anything the
 * OS emoji keyboard produces for whatever is not on the list.
 */
const SUGGESTED = [
  '🖼️', '🎨', '🌿', '🌸', '⛰️', '🌊', '🌌', '✦',
  '🏛️', '🏙️', '🚗', '🏍️', '✈️', '🐾', '🐦', '🦋',
  '📷', '🎬', '🎵', '⚽', '🍃', '☀️', '🌙', '❤️',
]

export function IconPicker({ name, defaultValue = '' }: { name: string; defaultValue?: string }) {
  const [value, setValue] = useState(defaultValue)
  const [open, setOpen] = useState(false)

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          aria-expanded={open}
          aria-label="Choose an icon"
          className="grid size-[38px] shrink-0 place-items-center rounded-lg border border-rule bg-card text-lg hover:bg-subtle"
        >
          {value || <span className="text-[13px] font-semibold text-t3">+</span>}
        </button>

        {/* The real field, so the form still works if the grid is never opened. */}
        <input
          name={name}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          maxLength={4}
          placeholder="or type / paste one"
          className="min-w-0 flex-1 rounded-lg border border-rule bg-card px-3 py-2 text-[13px] text-t1 outline-none focus:ring-2 focus:ring-violet/40"
        />

        {value && (
          <button
            type="button"
            onClick={() => setValue('')}
            className="shrink-0 text-[11px] font-semibold text-t3 hover:text-bad"
          >
            Clear
          </button>
        )}
      </div>

      {open && (
        <div className="grid grid-cols-8 gap-1 rounded-lg border border-rule bg-subtle p-2">
          {SUGGESTED.map((e) => (
            <button
              key={e}
              type="button"
              onClick={() => {
                setValue(e)
                setOpen(false)
              }}
              className={`grid size-8 place-items-center rounded text-[17px] hover:bg-card ${
                value === e ? 'bg-violet-tint' : ''
              }`}
            >
              {e}
            </button>
          ))}
        </div>
      )}

      <p className="text-[11px] leading-4 text-t3">
        Optional. Not on the list? Type or paste any emoji — or press{' '}
        <kbd className="rounded bg-subtle px-1 font-mono text-[10px] text-t2">Win</kbd>
        <span className="text-t3"> + </span>
        <kbd className="rounded bg-subtle px-1 font-mono text-[10px] text-t2">.</kbd> on Windows,{' '}
        <kbd className="rounded bg-subtle px-1 font-mono text-[10px] text-t2">Ctrl</kbd>
        <span className="text-t3"> + </span>
        <kbd className="rounded bg-subtle px-1 font-mono text-[10px] text-t2">⌘</kbd>
        <span className="text-t3"> + </span>
        <kbd className="rounded bg-subtle px-1 font-mono text-[10px] text-t2">Space</kbd> on Mac.
      </p>
    </div>
  )
}
