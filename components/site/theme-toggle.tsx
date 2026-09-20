'use client'

import { useEffect, useState } from 'react'

/**
 * The design has a dark/light button, so it toggles for real rather than sitting dead.
 * Everything is painted with the semantic tokens in globals.css, so one attribute flips
 * the whole page.
 */
export function ThemeToggle() {
  const [theme, setTheme] = useState<'light' | 'dark' | null>(null)

  // The script in app/layout.tsx already decided this before first paint. Read it
  // rather than deriving it again — two sources of truth means one of them is wrong.
  useEffect(() => {
    setTheme(document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light')
  }, [])

  function toggle() {
    const next = theme === 'dark' ? 'light' : 'dark'
    setTheme(next)
    document.documentElement.dataset.theme = next
    try {
      localStorage.setItem('framezee-theme', next)
    } catch {
      // Remembering the choice is a convenience, not a requirement.
    }
  }

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
      className="grid size-9 place-items-center rounded-lg hover:bg-line/60"
    >
      <img src="/figma/theme.svg" alt="" className="size-5 dark:invert" />
    </button>
  )
}
