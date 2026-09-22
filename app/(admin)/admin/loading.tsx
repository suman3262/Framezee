import { Bar, Box, RowsSkeleton } from '@/components/site/skeleton.tsx'

/**
 * Covers every admin page.
 *
 * It cannot render the real AdminShell, because that requires a staff session and a
 * loading file runs before the page's own checks. So it draws the same chrome — dark
 * rail, top bar — and leaves the content area to the skeleton.
 */
export default function AdminLoading() {
  return (
    <div className="min-h-dvh bg-page">
      <aside className="fixed left-0 top-0 z-50 hidden h-full w-64 bg-nav-chrome lg:block">
        <div className="flex h-16 items-center gap-2 px-6">
          <span className="grid size-8 place-items-center rounded-lg bg-violet font-display text-xs font-extrabold text-white">
            Fz
          </span>
          <span className="block h-3 w-24 animate-pulse rounded bg-white/15" />
        </div>
        <div className="mt-4 flex flex-col gap-2 px-4">
          {Array.from({ length: 8 }, (_, i) => (
            <span key={i} className="block h-8 animate-pulse rounded-lg bg-white/10" />
          ))}
        </div>
      </aside>

      <header className="fixed left-0 right-0 top-0 z-40 h-16 bg-card/90 shadow-[0_1px_8px_rgba(0,0,0,0.04)] lg:left-64">
        <div className="flex h-16 items-center justify-between px-6">
          <Box className="h-9 w-72 rounded-lg" />
          <Box className="h-9 w-40 rounded-lg" />
        </div>
      </header>

      <main className="pt-[104px] lg:pl-64 lg:pt-16">
        <div className="flex flex-col gap-5 px-4 py-5 sm:px-6">
          <span role="status" aria-live="polite" className="sr-only">
            Loading the dashboard
          </span>
          <Bar className="h-3 w-40" />
          <Bar className="h-8 w-72" />

          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 3 }, (_, i) => (
              <Box key={i} className="h-28" />
            ))}
          </div>

          <RowsSkeleton rows={5} />
        </div>
      </main>
    </div>
  )
}
