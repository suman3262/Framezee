import { Container } from '@/components/home/section-heading.tsx'
import { Bar, Box, LoadingLabel } from '@/components/site/skeleton.tsx'

/** The product page: wall preview on the left, the options column on the right. */
export default function ProductLoading() {
  return (
    <Container className="py-6">
      <LoadingLabel>Loading this frame</LoadingLabel>
      <Bar className="h-3 w-48" />

      <div className="mt-4 grid gap-8 lg:grid-cols-[minmax(0,1fr)_472px]">
        <Box className="h-[420px] rounded-2xl" />

        <div className="flex flex-col gap-5">
          <Bar className="h-3 w-32" />
          <Bar className="h-7 w-2/3" />
          <Bar className="h-4 w-full" />
          <Bar className="h-4 w-5/6" />
          <Bar className="h-10 w-40" />

          {Array.from({ length: 4 }, (_, i) => (
            <div key={i}>
              <Bar className="h-3 w-20" />
              <div className="mt-2 flex flex-wrap gap-2">
                {Array.from({ length: 4 }, (_, j) => (
                  <Box key={j} className="h-8 w-20 rounded-full" />
                ))}
              </div>
            </div>
          ))}

          <Box className="mt-2 h-12 w-full rounded-full" />
        </div>
      </div>
    </Container>
  )
}
