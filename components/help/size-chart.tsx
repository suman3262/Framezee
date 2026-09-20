'use client'

import { useState } from 'react'
import { fmtIn, fmtInrRupees } from '@/lib/pricing.ts'

export type ChartSize = {
  widthTenths: number
  heightTenths: number
  fromPaise: number | null
  popular?: boolean
}

type Shape = 'horizontal' | 'vertical' | 'square'

/**
 * Frames drawn to scale against each other, so "12 × 8 in" stops being an abstraction.
 * Every box is sized from the real dimensions — nothing is hand-placed.
 */
const GROUPS: Array<{ shape: Shape; heading: string }> = [
  { shape: 'horizontal', heading: 'Horizontal rectangle frames' },
  { shape: 'vertical', heading: 'Vertical rectangle frames' },
  { shape: 'square', heading: 'Square frames' },
]

const inShape = (z: ChartSize, shape: Shape) =>
  shape === 'square'
    ? z.widthTenths === z.heightTenths
    : shape === 'horizontal'
      ? z.widthTenths > z.heightTenths
      : z.heightTenths > z.widthTenths

export function SizeChart({ sizes }: { sizes: ChartSize[] }) {
  // Phones get a switcher; on a wide screen all three groups are shown at once, as the
  // desktop design does — comparing shapes is the point of the chart.
  const [shape, setShape] = useState<Shape>('horizontal')
  const [open, setOpen] = useState(true)

  // One scale across every group, so a square 12 in reads the same size as a 12 × 8 in.
  const biggest = Math.max(1, ...sizes.map((s) => Math.max(s.widthTenths, s.heightTenths)))

  return (
    <div className="rounded-2xl bg-ink p-5 text-page">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <span>
          <span className="font-display text-base font-bold">Frame size guide</span>
          <span className="ml-2 text-[11px] text-page/60">inches (width × height)</span>
        </span>
        <span className="flex items-center gap-2">
          <span className="flex rounded-full bg-white/10 p-1 lg:hidden">
            {GROUPS.map((g) => (
              <button
                key={g.shape}
                type="button"
                onClick={() => setShape(g.shape)}
                className={`rounded-full px-3 py-1 text-[11px] font-semibold capitalize ${
                  shape === g.shape ? 'bg-violet text-white' : 'text-page/70'
                }`}
              >
                {g.shape}
              </button>
            ))}
          </span>
          <button
            type="button"
            onClick={() => setOpen((o) => !o)}
            className="rounded-full bg-white/10 px-3 py-1 text-[11px] font-semibold text-page/80"
          >
            {open ? 'Hide size chart' : 'Show size chart'}
          </button>
        </span>
      </div>

      {open &&
        GROUPS.map((g) => {
          const shown = sizes
            .filter((z) => inShape(z, g.shape))
            .sort((a, b) => a.widthTenths * a.heightTenths - b.widthTenths * b.heightTenths)
          if (shown.length === 0) return null

          return (
            <section
              key={g.shape}
              className={`mb-6 last:mb-0 ${g.shape === shape ? '' : 'hidden lg:block'}`}
            >
              <h3 className="mb-3 flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.05em] text-page/70">
                <span className="size-2 rounded-[2px] bg-violet" />
                {g.heading}
              </h3>
              <div className="flex flex-wrap items-end gap-4 sm:gap-6">
                {shown.map((s) => {
          const w = (s.widthTenths / biggest) * 100
          const h = (s.heightTenths / biggest) * 100
          return (
            <figure key={`${s.widthTenths}x${s.heightTenths}`} className="flex flex-col items-center gap-1">
              <div
                className="rounded-[2px] border-2 border-accent bg-white/90"
                style={{
                  width: `${Math.max(22, w * 1.9)}px`,
                  height: `${Math.max(22, h * 1.9)}px`,
                }}
                aria-hidden
              />
              <figcaption className="text-center">
                <span className="block text-[10px] font-semibold">
                  {fmtIn(s.widthTenths)} × {fmtIn(s.heightTenths)} in
                </span>
                {s.fromPaise !== null && (
                  <span className="block text-[10px] text-accent">{fmtInrRupees(s.fromPaise)}</span>
                )}
                {s.popular && (
                  <span className="mt-[2px] inline-block rounded-full bg-accent px-[6px] text-[9px] font-bold text-accent-ink">
                    Popular
                  </span>
                )}
              </figcaption>
            </figure>
                  )
                })}
              </div>
            </section>
          )
        })}

      <p className="mt-5 border-t border-white/10 pt-3 text-[11px] text-accent">
        Note: 1/2 inch frames are available only up to 8 × 12, 12 × 8, or 8 × 8 in. Boxes are
        shown to relative scale within each shape.
      </p>
    </div>
  )
}
