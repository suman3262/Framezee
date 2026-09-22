import { Container } from '@/components/home/section-heading.tsx'
import { Bar, Box, GridSkeleton, LoadingLabel } from '@/components/site/skeleton.tsx'

/** Sidebar plus grid, so the filters do not appear to jump in afterwards. */
export default function BrowseLoading() {
  return (
    <Container className="py-6">
      <LoadingLabel>Loading frames</LoadingLabel>
      <Bar className="h-4 w-40" />
      <Bar className="mt-4 h-8 w-56" />

      <div className="mt-6 flex gap-6">
        <aside className="hidden w-56 shrink-0 lg:block">
          {Array.from({ length: 3 }, (_, i) => (
            <div key={i} className="mb-6">
              <Bar className="h-3 w-24" />
              {Array.from({ length: 5 }, (_, j) => (
                <Bar key={j} className="mt-3 h-3 w-full" />
              ))}
            </div>
          ))}
        </aside>
        <div className="min-w-0 flex-1">
          <Box className="mb-4 h-9 w-full max-w-sm rounded-full" />
          <GridSkeleton count={9} />
        </div>
      </div>
    </Container>
  )
}
