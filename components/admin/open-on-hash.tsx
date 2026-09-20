'use client'

import { useEffect } from 'react'

/**
 * Opens a collapsed <details> when the address bar points at it.
 *
 * Without this a jump link scrolls to a closed section and appears to do nothing. One
 * instance per page handles every section, so the sections themselves stay server
 * components with no JavaScript of their own.
 */
export function OpenOnHash() {
  useEffect(() => {
    const open = () => {
      const id = location.hash.slice(1)
      if (!id) return
      const el = document.getElementById(id)
      if (el instanceof HTMLDetailsElement) {
        el.open = true
        el.scrollIntoView({ block: 'start' })
      }
    }
    open()
    addEventListener('hashchange', open)
    return () => removeEventListener('hashchange', open)
  }, [])

  return null
}
