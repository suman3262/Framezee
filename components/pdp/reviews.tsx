import { Stars } from './stars.tsx'

export type ReviewRow = {
  id: string
  authorName: string
  rating: number
  title: string
  body: string
  verified: boolean
  createdAt: Date
}

/** Figma 3:10361 */
export function ReviewsSection({
  ratingTenths,
  ratingCount,
  histogram,
  reviews,
}: {
  ratingTenths: number
  ratingCount: number
  histogram: Record<number, number>
  reviews: ReviewRow[]
}) {
  return (
    <section className="py-10">
      <div className="mb-5 flex items-center gap-3">
        <h2 className="font-display text-2xl font-bold tracking-[-0.02em] text-ink">
          Customer reviews
        </h2>
        <span className="rounded-full bg-violet-tint px-2 py-[2px] text-[11px] font-bold text-violet-ink">
          {ratingCount} verified
        </span>
      </div>

      <div className="grid gap-6 lg:grid-cols-[280px_minmax(0,1fr)]">
        <div className="h-fit rounded-2xl bg-surface p-5 shadow-[0_1px_1px_rgba(0,0,0,0.05)]">
          <p className="font-display text-4xl font-extrabold text-ink">{(ratingTenths / 10).toFixed(1)}</p>
          <Stars tenths={ratingTenths} />
          <p className="mt-1 text-xs text-body">{ratingCount} ratings</p>

          <div className="mt-4 flex flex-col gap-[6px]">
            {[5, 4, 3, 2, 1].map((star) => {
              const n = histogram[star] ?? 0
              const pct = ratingCount ? Math.round((n / ratingCount) * 100) : 0
              return (
                <div key={star} className="flex items-center gap-2">
                  <span className="w-10 shrink-0 text-[11px] text-body">{star} star</span>
                  <span className="h-[6px] flex-1 overflow-hidden rounded-full bg-subtle">
                    <span className="block h-full rounded-full bg-accent" style={{ width: `${pct}%` }} />
                  </span>
                  <span className="w-8 shrink-0 text-right text-[11px] text-faint">{pct}%</span>
                </div>
              )
            })}
          </div>
        </div>

        <ul className="flex flex-col gap-3">
          {reviews.map((r) => (
            <li key={r.id} className="rounded-2xl bg-surface p-5 shadow-[0_1px_1px_rgba(0,0,0,0.05)]">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="flex items-center gap-2">
                  <span className="grid size-6 place-items-center rounded-full bg-violet-tint text-[11px] font-bold text-violet-ink">
                    {r.authorName[0]}
                  </span>
                  <span className="text-[13px] font-semibold text-ink">{r.authorName}</span>
                </span>
                {r.verified && (
                  <span className="rounded-full bg-violet-tint px-2 py-[2px] text-[10px] font-semibold text-violet-ink">
                    Verified Purchase
                  </span>
                )}
              </div>
              <div className="mt-2">
                <Stars tenths={r.rating * 10} size={13} />
              </div>
              <p className="mt-2 text-sm font-bold text-ink">{r.title}</p>
              <p className="mt-1 text-[13px] leading-5 text-body">{r.body}</p>
              <p className="mt-2 text-[11px] text-faint">{ago(r.createdAt)}</p>
            </li>
          ))}
        </ul>
      </div>
    </section>
  )
}

function ago(date: Date): string {
  const days = Math.max(0, Math.round((Date.now() - date.getTime()) / 86_400_000))
  if (days < 1) return 'today'
  if (days < 30) return `${days} day${days === 1 ? '' : 's'} ago`
  const months = Math.round(days / 30)
  if (months < 12) return `${months} month${months === 1 ? '' : 's'} ago`
  const years = Math.round(months / 12)
  return `${years} year${years === 1 ? '' : 's'} ago`
}
