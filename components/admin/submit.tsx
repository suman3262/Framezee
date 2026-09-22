'use client'

import { useFormStatus } from 'react-dom'

/**
 * A submit button that shows it has been pressed.
 *
 * Plain `<form action={serverAction}>` buttons give no feedback at all: the action runs
 * on the server, and until it returns the page looks exactly as it did, so people press
 * again. useFormStatus reads the status of the form this button is inside, which is why
 * it has to be its own client component.
 */
export function Submit({
  className = '',
  pendingLabel,
  title,
  disabled,
  children,
}: {
  className?: string
  /** Replaces the label while the action runs. Otherwise it just dims. */
  pendingLabel?: React.ReactNode
  title?: string
  disabled?: boolean
  children: React.ReactNode
}) {
  const { pending } = useFormStatus()

  return (
    <button
      type="submit"
      disabled={pending || disabled}
      title={title}
      aria-busy={pending}
      className={`${className} transition-opacity disabled:cursor-wait disabled:opacity-50`}
    >
      {pending ? (pendingLabel ?? children) : children}
    </button>
  )
}
