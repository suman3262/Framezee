import Link from 'next/link'
import { FramePreview } from '@/components/pdp/frame-preview.tsx'
import { artworkFor } from '@/lib/artwork.ts'
import { fmtIn, fmtInr } from '@/lib/pricing.ts'
import { removeCartItem, setCartItemQty } from '@/app/actions/cart.ts'
import type { BasketLine } from '@/lib/basket.ts'

export function BasketLines({ lines, editable = true }: { lines: BasketLine[]; editable?: boolean }) {
  return (
    <ul className="flex flex-col gap-3">
      {lines.map((l) => (
        <li
          key={l.id}
          className="flex gap-4 rounded-2xl bg-surface p-4 shadow-[0_1px_1px_rgba(0,0,0,0.05)]"
        >
          <FramePreview
            widthTenths={l.display.widthTenths}
            heightTenths={l.display.heightTenths}
            swatch={l.display.swatch}
            thicknessTenths={l.display.thicknessTenths}
            matBoard={l.display.matBoard}
            artwork={artworkFor(l.display.slug ?? '', l.display.artwork)}
            className="size-24 shrink-0 rounded-xl bg-subtle p-3"
          />

          <div className="min-w-0 flex-1">
            {l.display.slug ? (
              <Link href={`/frames/${l.display.slug}`} className="text-sm font-bold text-ink hover:underline">
                {l.display.title}
              </Link>
            ) : (
              <p className="text-sm font-bold text-ink">{l.display.title}</p>
            )}

            <p className="mt-[2px] text-xs leading-5 text-body">
              {l.display.materialName} · {fmtIn(l.display.widthTenths)} ×{' '}
              {fmtIn(l.display.heightTenths)} in ·{' '}
              {l.display.thicknessTenths === 5 ? '1/2 inch' : '1 inch'} ·{' '}
              {l.display.matBoard ? 'Mat' : 'No mat'}
              {l.display.paperName ? ` · ${l.display.paperName}` : ''}
              {l.display.glazingName ? ` · ${l.display.glazingName}` : ''}
            </p>

            {l.display.printImagePath && (
              <p className="mt-1 text-[11px] text-violet-ink">Your photograph is attached</p>
            )}

            {editable ? (
              <div className="mt-2 flex items-center gap-1">
                <QtyButton id={l.id} qty={l.display.qty - 1} label="Decrease quantity">−</QtyButton>
                <span className="min-w-8 text-center text-sm font-bold text-ink">
                  {l.display.qty}
                </span>
                <QtyButton id={l.id} qty={l.display.qty + 1} label="Increase quantity">+</QtyButton>
              </div>
            ) : (
              <p className="mt-1 text-xs text-faint">Qty {l.display.qty}</p>
            )}

            {l.error && <p className="mt-1 text-xs font-medium text-red-600">{l.error}</p>}
          </div>

          <div className="flex flex-col items-end justify-between">
            <span className="text-sm font-bold text-ink">
              {l.breakdown ? fmtInr(l.breakdown.linePaise) : '—'}
            </span>
            {editable && (
              <form action={removeCartItem}>
                <input type="hidden" name="id" value={l.id} />
                <button className="text-xs font-semibold text-faint hover:text-red-600">
                  Remove
                </button>
              </form>
            )}
          </div>
        </li>
      ))}
    </ul>
  )
}

function QtyButton({
  id,
  qty,
  label,
  children,
}: {
  id: string
  qty: number
  label: string
  children: React.ReactNode
}) {
  return (
    <form action={setCartItemQty}>
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="qty" value={qty} />
      <button
        aria-label={label}
        className="grid size-7 place-items-center rounded-full bg-subtle text-base leading-none text-ink hover:bg-line"
      >
        {children}
      </button>
    </form>
  )
}
