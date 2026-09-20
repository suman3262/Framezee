import Link from 'next/link'
import { Container } from '@/components/home/section-heading.tsx'
import { loadCatalog, cheapestForSize, sizeLabel } from '@/lib/storefront.ts'
import { fmtInrRupees } from '@/lib/pricing.ts'

export default async function SizesPage() {
  const { sizeList, finishById } = await loadCatalog()
  const finishes = [...finishById.values()]

  return (
    <Container className="py-8">
      <h1 className="font-display text-2xl font-bold tracking-[-0.02em] text-ink sm:text-3xl">
        Shop by Size
      </h1>
      <p className="mt-1 max-w-2xl text-sm text-body">
        Our standard sizes, priced in the most affordable moulding. Need something that
        isn&rsquo;t listed?{' '}
        <Link href="/custom" className="font-semibold text-violet-deep">
          Build a custom frame
        </Link>{' '}
        at any size between our minimum and maximum.
      </p>

      <div className="mt-6 grid grid-cols-2 gap-2 sm:gap-3 md:grid-cols-3 lg:grid-cols-6">
        {sizeList.map((s) => {
          const from = cheapestForSize(finishes, s.widthTenths, s.heightTenths)
          return (
            <Link
              key={`${s.widthTenths}x${s.heightTenths}`}
              href="/browse"
              className="rounded-xl bg-surface px-3 py-3 shadow-[0_1px_1px_rgba(0,0,0,0.05)] hover:shadow-md"
            >
              <span className="block text-xs font-bold text-ink">
                {sizeLabel(s.widthTenths, s.heightTenths)}
              </span>
              <span className="mt-[2px] block text-[11px] text-faint">
                {from === null ? 'Made to order' : `from ${fmtInrRupees(from)}`}
              </span>
            </Link>
          )
        })}
      </div>
    </Container>
  )
}
