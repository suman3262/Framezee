import Link from 'next/link'
import { Hero } from '@/components/home/hero.tsx'
import { PromoBanners } from '@/components/home/promo-banners.tsx'
import { FrameCard } from '@/components/shop/frame-card.tsx'
import { Container, SectionHeading } from '@/components/home/section-heading.tsx'
import { SearchInput } from '@/components/site/header.tsx'
import { loadCatalog, cheapestForSize, sizeLabel } from '@/lib/storefront.ts'
import { fmtInrRupees } from '@/lib/pricing.ts'

export default async function HomePage() {
  // Every price below is computed by lib/pricing.ts from the rate cards. None is stored.
  const { items, sizeList, categories, finishById } = await loadCatalog()
  const products = items.slice(0, 4)
  const finishes = [...finishById.values()]
  const tiles = sizeList.map((s) => ({
    ...s,
    label: sizeLabel(s.widthTenths, s.heightTenths),
    fromPaise: cheapestForSize(finishes, s.widthTenths, s.heightTenths),
  }))

  return (
    <>
      {/* Mobile-only search + custom frame callout — Figma 2:616 */}
      <Container className="pt-4 md:hidden">
        <SearchInput />
        <Link
          href="/custom"
          className="mt-3 flex items-center gap-3 rounded-xl bg-accent px-4 py-3"
        >
          <img src="/figma/frame.svg" alt="" className="size-5" />
          <span className="flex flex-col">
            <span className="text-sm font-bold leading-5 text-ink">Build a custom frame</span>
            <span className="text-[11px] leading-4 text-ink/70">
              Any size between our minimum and maximum
            </span>
          </span>
        </Link>
      </Container>

      <Hero />

      <section className="py-8">
        <Container>
          <SectionHeading title="Shop by Category" href="/browse" />
          <ul className="flex snap-x gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {categories.map((c) => (
              <li key={c.slug} className="snap-start">
                <Link
                  href={`/browse?category=${c.slug}`}
                  className="flex items-center gap-2 whitespace-nowrap rounded-full border border-line bg-surface px-4 py-2 text-xs font-semibold text-ink hover:border-violet-deep"
                >
                  <span aria-hidden>{c.icon}</span>
                  {c.name}
                </Link>
              </li>
            ))}
          </ul>
        </Container>
      </section>

      <section className="py-8">
        <Container>
          <SectionHeading title="New Arrivals" href="/browse" />
          <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
            {products.map((p) => (
              <FrameCard key={p.slug} item={p} />
            ))}
          </div>
        </Container>
      </section>

      <PromoBanners />

      <section className="py-8">
        <Container>
          <SectionHeading title="Shop by Size" href="/sizes" tone="violet" />
          <div className="grid grid-cols-3 gap-2 sm:gap-3 lg:grid-cols-6">
            {tiles.map((t) => (
              <Link
                key={t.label}
                href={`/browse?size=${t.widthTenths}x${t.heightTenths}`}
                className="rounded-lg border border-line bg-surface px-3 py-3 hover:border-violet-deep"
              >
                <span className="block text-xs font-bold text-ink">{t.label}</span>
                <span className="mt-[2px] block text-[11px] text-faint">
                  {t.fromPaise === null ? 'Made to order' : `from ${fmtInrRupees(t.fromPaise)}`}
                </span>
              </Link>
            ))}
          </div>
        </Container>
      </section>
    </>
  )
}
