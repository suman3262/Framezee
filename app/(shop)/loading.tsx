import { Container } from '@/components/home/section-heading.tsx'
import { Bar, GridSkeleton, LoadingLabel } from '@/components/site/skeleton.tsx'

/**
 * The fallback for every shop page without its own. Next shows it the moment a
 * navigation starts, so a click always does something visible even when the server is
 * still reading the database.
 */
export default function ShopLoading() {
  return (
    <Container className="py-8">
      <LoadingLabel>Loading</LoadingLabel>
      <Bar className="h-4 w-32" />
      <Bar className="mt-4 h-8 w-64" />
      <Bar className="mt-3 h-4 w-80" />
      <div className="mt-8">
        <GridSkeleton />
      </div>
    </Container>
  )
}
