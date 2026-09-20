import Link from 'next/link'
import { FramePreview } from '@/components/pdp/frame-preview.tsx'
import { artworkFor } from '@/lib/artwork.ts'
import { fmtIn, fmtInrRupees } from '@/lib/pricing.ts'

export type ShopCardItem = {
  slug: string
  title: string
  categoryName: string | null
  swatch: string
  kind: string | null
  finishName: string | null
  isNew: boolean
  /** Stored artwork: an image URL or a CSS background. Absent falls back by slug. */
  artwork?: string | null
  fromPaise: number | null
  makeableSizes: string[]
}

/** The catalogue card from framezee_shop_desktop: badge, heart, spec line, add to basket. */
export function ShopCard({ item }: { item: ShopCardItem }) {
  const smallest = item.makeableSizes[0]
  const [w, h] = smallest ? smallest.split('x').map(Number) : [null, null]

  return (
    <article className="flex flex-col rounded-2xl bg-surface p-4 shadow-[0_1px_1px_rgba(0,0,0,0.05)] transition-shadow hover:shadow-md">
      <div className="relative">
        {item.isNew && (
          <span className="absolute left-0 top-0 z-10 rounded-full bg-ink px-2 py-[2px] text-[9px] font-bold uppercase tracking-[0.06em] text-page">
            New
          </span>
        )}
        <Link
          href={`/wishlist`}
          aria-label={`Save ${item.title}`}
          className="absolute right-0 top-0 z-10 text-base leading-none text-faint hover:text-violet-deep"
        >
          ♡
        </Link>

        <Link href={`/frames/${item.slug}`} className="block">
          <FramePreview
            widthTenths={w ?? 80}
            heightTenths={h ?? 100}
            swatch={item.swatch}
            thicknessTenths={10}
            matBoard
            artwork={artworkFor(item.slug, item.artwork)}
            className="h-[220px] p-6"
          />
        </Link>
      </div>

      <div className="mt-3 flex items-baseline justify-between gap-2">
        <span className="truncate text-[11px] text-body">{item.categoryName ?? 'Frames'}</span>
        <span className="shrink-0 text-[11px] font-semibold text-emerald-700">In stock</span>
      </div>

      <div className="mt-[2px] flex items-baseline justify-between gap-2">
        <Link
          href={`/frames/${item.slug}`}
          className="truncate text-[13px] font-bold text-ink hover:underline"
        >
          {item.title}
        </Link>
        <span className="shrink-0 text-[13px] font-bold text-ink">
          {item.fromPaise === null ? '—' : fmtInrRupees(item.fromPaise)}
        </span>
      </div>

      <p className="mt-[2px] text-[11px] text-body">
        {[item.kind ? item.kind[0].toUpperCase() + item.kind.slice(1) : null,
          w && h ? `${fmtIn(w)} × ${fmtIn(h)} in` : null]
          .filter(Boolean)
          .join(' · ')}
      </p>

      <Link
        href={`/frames/${item.slug}`}
        className="mt-4 block border-t border-line pt-3 text-center text-[13px] font-semibold text-ink hover:text-violet-deep"
      >
        Add to basket
      </Link>
    </article>
  )
}
