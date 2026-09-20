'use client'

import { useState } from 'react'

/** Copies the current page link. Sharing a wishlist is a link, not a feature. */
export function ShareList() {
  const [done, setDone] = useState(false)

  return (
    <button
      type="button"
      onClick={async () => {
        const url = window.location.href
        try {
          if (navigator.share) await navigator.share({ title: 'My Framezee wishlist', url })
          else await navigator.clipboard.writeText(url)
          setDone(true)
          setTimeout(() => setDone(false), 2000)
        } catch {
          // the customer dismissed the share sheet — nothing to report
        }
      }}
      className="font-semibold text-violet-deep"
    >
      {done ? 'Link copied' : 'Share list'}
    </button>
  )
}
