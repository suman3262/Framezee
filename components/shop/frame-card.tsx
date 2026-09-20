import Link from 'next/link'
import { FramePreview } from '@/components/pdp/frame-preview.tsx'
import { Stars } from '@/components/pdp/stars.tsx'
import { artworkFor } from '@/lib/artwork.ts'
import { fmtInrRupees } from '@/lib/pricing.ts'

export type FrameCardItem = {
  slug: string
  title: string
  categoryName: string | null
  swatch: string
  isNew: boolean
  /** Stored artwork: a CSS background or an image URL. Absent falls back by slug. */
  artwork?: string | null
  ratingTenths: number | null
  ratingCount: number
  fromPaise: number | null
  /** When present the card shows a range, as the home page design does. */
  toPaise?: number | null
}

export function FrameCard({ item }: { item: FrameCardItem }) {
  return (
    <Link
      href={`/frames/${item.slug}`}
      className="flex flex-col rounded-2xl bg-surface p-3 shadow-[0_1px_1px_rgba(0,0,0,0.05)] transition-shadow hover:shadow-md"
    >
      <div className="relative">
        <FramePreview
          widthTenths={70}
          heightTenths={50}
          swatch={item.swatch}
          thicknessTenths={10}
          matBoard={false}
          artwork={artworkFor(item.slug, item.artwork)}
          className="h-[170px] rounded-xl bg-subtle p-4"
        />
        {item.isNew && (
          <span className="absolute left-2 top-2 rounded-full bg-accent px-2 py-[2px] text-[10px] font-bold uppercase tracking-[0.04em] text-accent-ink">
            New
          </span>
        )}
      </div>

      {/* Name on the left, price on the right — the arrangement the design uses */}
      <div className="mt-3 flex items-start justify-between gap-3">
        <span className="min-w-0">
          {item.categoryName && (
            <span className="flex items-center gap-[6px] text-[10px] font-medium uppercase tracking-wide text-faint">
              <span className="size-[6px] rounded-full bg-violet-deep" />
              {item.categoryName}
            </span>
          )}
          <span className="mt-[2px] block truncate text-[13px] font-bold leading-5 text-ink">
            {item.title}
          </span>
          {item.ratingTenths !== null && item.ratingCount > 0 && (
            <span className="mt-1 flex items-center gap-1">
              <Stars tenths={item.ratingTenths} size={11} />
              <span className="text-[10px] text-faint">({item.ratingCount})</span>
            </span>
          )}
        </span>

        <span className="shrink-0 text-right">
          <span className="block text-[10px] leading-3 text-faint">Starts at</span>
          <span className="block text-[13px] font-bold text-ink">
            {item.fromPaise === null
              ? 'Made to order'
              : item.toPaise != null && item.toPaise !== item.fromPaise
                ? `${fmtInrRupees(item.fromPaise)} – ${fmtInrRupees(item.toPaise)}`
                : fmtInrRupees(item.fromPaise)}
          </span>
          <span className="mt-[2px] block text-[10px] font-semibold text-violet-deep">In stock</span>
        </span>
      </div>
    </Link>
  )
}
