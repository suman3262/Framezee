'use client'

import { useMemo, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { priceLine, fmtIn, fmtInrRupees, PriceError, type Band, type Limits } from '@/lib/pricing.ts'
import {
  SHAPES,
  shapeOf,
  thicknessAvailable,
  resolveThickness,
  thicknessNote,
  type ShapeKey,
  type Thickness,
} from '@/lib/frame-options.ts'
import { WallStage } from '@/components/studio/wall-stage.tsx'
import { scaleForFill } from '@/components/studio/wall-canvas.tsx'
import { printQuality } from '@/components/studio/upload.ts'
import { addToCart } from '@/app/actions/cart.ts'

export type FinishOption = {
  id: string
  slug: string
  name: string
  swatch: string
  limits: Limits
  bands: Band[]
}

export type PaperOption = { id: string; name: string; bands: Band[] }
export type SizeOption = { widthTenths: number; heightTenths: number }
export type WallPreset = { key: string; name: string; hex: string }

/** Figma 3:10176 — the whole right-hand column, made live. */
export function Configurator({
  productId,
  finishes,
  defaultFinishSlug,
  sizes,
  papers,
  thicknesses,
  matBands,
  artwork: artworkCss,
  wallPresets,
  header,
  freeShippingThresholdPaise,
}: {
  productId: string
  finishes: FinishOption[]
  defaultFinishSlug: string
  sizes: SizeOption[]
  papers: PaperOption[]
  thicknesses: Thickness[]
  /** Empty while the mat is free. Kept here so the shown price matches the basket. */
  matBands: Band[]
  artwork: string
  wallPresets: WallPreset[]
  /** Title, rating and description — they belong beside the wall, not above it. */
  header: React.ReactNode
  freeShippingThresholdPaise: number | null
}) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [added, setAdded] = useState(false)

  const [finishSlug, setFinishSlug] = useState(defaultFinishSlug)
  /*
   * A product page opens on 14 x 10 in rather than the smallest size. The smallest was
   * 7 x 5 in, which draws as a stamp on the wall and undersells the frame; 14 x 10 is a
   * size people recognise and it fills the preview.
   */
  const opening =
    sizes.find((s) => s.widthTenths === 140 && s.heightTenths === 100) ?? sizes[0]
  const [shape, setShape] = useState<ShapeKey>(() =>
    shapeOf(opening.widthTenths, opening.heightTenths),
  )
  const [sizeIndex, setSizeIndex] = useState(() =>
    sizes
      .filter((s) => shapeOf(s.widthTenths, s.heightTenths) === shapeOf(opening.widthTenths, opening.heightTenths))
      .findIndex((s) => s.widthTenths === opening.widthTenths && s.heightTenths === opening.heightTenths),
  )
  const [thickness, setThickness] = useState(() => thicknesses.at(-1)?.tenths ?? 10)
  const [matBoard, setMatBoard] = useState(false)
  const [print, setPrint] = useState(false)
  const [paperId, setPaperId] = useState(papers[0]?.id ?? '')
  const [qty, setQty] = useState(1)

  /** False means "print the artwork shown", true means "print the photo I upload". */
  const [useOwn, setUseOwn] = useState(false)
  /** The photograph that gets printed. Only collected when the customer sends their own. */
  const [artwork, setArtwork] = useState<{ path: string; url: string; w: number; h: number } | null>(null)

  const finish = finishes.find((f) => f.slug === finishSlug) ?? finishes[0]

  // Sizes are filtered by shape, so the two controls cannot disagree.
  const shapeSizes = useMemo(
    () => sizes.filter((s) => shapeOf(s.widthTenths, s.heightTenths) === shape),
    [sizes, shape],
  )
  const size = shapeSizes[Math.min(sizeIndex, shapeSizes.length - 1)] ?? sizes[0]

  const effectiveThickness = resolveThickness(thickness, size.widthTenths, size.heightTenths, thicknesses)
  const paper = papers.find((p) => p.id === paperId)

  const quote = useMemo(() => {
    try {
      return {
        ok: true as const,
        line: priceLine({
          widthTenths: size.widthTenths,
          heightTenths: size.heightTenths,
          qty,
          material: { name: finish.name, limits: finish.limits, bands: finish.bands },
          paper: print && paper ? { name: paper.name, bands: paper.bands } : undefined,
          mat: matBoard ? { name: 'Mat board', bands: matBands } : undefined,
        }),
      }
    } catch (e) {
      return { ok: false as const, message: e instanceof PriceError ? e.message : 'Unavailable' }
    }
  }, [size, qty, finish, print, paper, matBoard, matBands])

  const unit = quote.ok ? quote.line.unitPaise : null
  const total = quote.ok ? quote.line.linePaise : null
  const toFreeShipping =
    freeShippingThresholdPaise && total !== null ? freeShippingThresholdPaise - total : null

  function submit() {
    setAdded(false)
    startTransition(async () => {
      const res = await addToCart({
        productId,
        materialId: finish.id,
        artworkPath: print && useOwn ? (artwork?.path ?? null) : null,
        widthTenths: size.widthTenths,
        heightTenths: size.heightTenths,
        thicknessTenths: effectiveThickness,
        matBoard,
        printService: print,
        paperQualityId: print ? paperId : null,
        qty,
      })
      if (res.redirectTo) {
        router.push(res.redirectTo)
        return
      }
      setAdded(true)
      setArtwork(null)
      router.refresh()
    })
  }

  return (
    <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_472px]">
      {/* The visualiser shares this component's state, so it lives here rather than in
          the page — the frame on the wall always matches the options chosen. */}
      <div className="lg:sticky lg:top-24 lg:self-start">
        <WallStage
          widthTenths={size.widthTenths}
          heightTenths={size.heightTenths}
          swatch={finish.swatch}
          thicknessTenths={effectiveThickness}
          matBoard={matBoard}
          artwork={artwork}
          artworkCss={artworkCss}
          allowArtwork={print && useOwn}
          onArtwork={setArtwork}
          artworkHint={
            artwork
              ? (() => {
                  // Told before paying, not after the print looks soft.
                  const q = printQuality(artwork.w, artwork.h, size.widthTenths, size.heightTenths)
                  return (
                    <span className={q.ok ? 'text-emerald-700' : 'text-amber-700'}>
                      {artwork.w} × {artwork.h} px · {q.dpi} DPI at {fmtIn(size.widthTenths)} ×{' '}
                      {fmtIn(size.heightTenths)} in
                      {q.ok ? ' — good for printing' : ' — this may look soft'}
                    </span>
                  )
                })()
              : 'JPG, PNG or WebP. Large photos are resized for printing before upload.'
          }
          wallPresets={wallPresets}
          initialScale={scaleForFill(opening.widthTenths, 85)}
          compact
        />
      </div>

      <div className="flex flex-col gap-6">
      {header}
      <div>
        <p className="font-display text-5xl font-extrabold leading-[56px] text-ink">
          {unit === null ? '—' : fmtInrRupees(unit)}
        </p>
        {!quote.ok && <p className="mt-1 text-[13px] text-red-600">{quote.message}</p>}
      </div>

      <Group label="Finish" aside={finish.name}>
        <div className="flex flex-wrap gap-2">
          {finishes.map((f) => {
            const on = f.slug === finish.slug
            return (
              <button
                key={f.slug}
                type="button"
                onClick={() => setFinishSlug(f.slug)}
                aria-pressed={on}
                className={`flex items-center gap-2 rounded-full px-3 py-[6px] text-[13px] font-semibold shadow-[0_1px_1px_rgba(0,0,0,0.05)] ${
                  on ? 'bg-violet-tint text-violet-ink' : 'bg-surface text-ink'
                }`}
              >
                <span
                  className="size-[14px] rounded-full shadow-[0_1px_2px_rgba(0,0,0,0.05)]"
                  style={{
                    background: f.swatch,
                    boxShadow: on ? '0 0 0 1px var(--violet-deep)' : undefined,
                  }}
                />
                {f.slug}
              </button>
            )
          })}
        </div>
      </Group>

      <Group label="Shape">
        <div className="flex flex-wrap gap-2">
          {SHAPES.map((s) => (
            <Chip
              key={s.key}
              on={shape === s.key}
              onClick={() => {
                setShape(s.key)
                setSizeIndex(0)
              }}
            >
              {s.label}
            </Chip>
          ))}
        </div>
      </Group>

      <Group label="Size" aside={`${fmtIn(size.widthTenths)} × ${fmtIn(size.heightTenths)} in`}>
        <div className="flex flex-wrap gap-2">
          {shapeSizes.map((s, i) => (
            <Chip
              key={`${s.widthTenths}x${s.heightTenths}`}
              on={s === size}
              onClick={() => setSizeIndex(i)}
            >
              {fmtIn(s.widthTenths)} × {fmtIn(s.heightTenths)} in
            </Chip>
          ))}
        </div>
      </Group>

      <Group label="Frame thickness">
        <div className="flex flex-wrap gap-2">
          {thicknesses.map((t) => {
            const allowed = thicknessAvailable(t, size.widthTenths, size.heightTenths)
            return (
              <Chip
                key={t.tenths}
                on={effectiveThickness === t.tenths}
                disabled={!allowed}
                onClick={() => setThickness(t.tenths)}
              >
                {t.label}
              </Chip>
            )
          })}
        </div>
        {thicknessNote(thicknesses) && (
          <p className="mt-2 text-xs leading-4 text-faint">{thicknessNote(thicknesses)}</p>
        )}
      </Group>

      <Group label="Mat board">
        <div className="flex flex-wrap gap-2">
          <Chip on={!matBoard} onClick={() => setMatBoard(false)}>
            No mat
          </Chip>
          <Chip on={matBoard} onClick={() => setMatBoard(true)}>
            Mat
          </Chip>
        </div>
      </Group>

      {/*
        The design draws this as "Frame only — no print · save 30%", i.e. a print included
        by default. The client confirmed printing is a paid extra, so the choice is
        inverted here and the price moves up rather than down.
      */}
      <label className="flex cursor-pointer gap-3 bg-subtle p-[14px] shadow-[0_1px_1px_rgba(0,0,0,0.05)]">
        <input
          type="checkbox"
          checked={print}
          onChange={(e) => setPrint(e.target.checked)}
          className="mt-[2px] size-4 shrink-0 accent-[color:var(--violet-deep)]"
        />
        <span>
          <span className="block text-[13px] font-bold leading-[18px] text-ink">
            Add my photo, printed and mounted
            {quote.ok && quote.line.printPaise > 0 && (
              <span className="text-violet-ink"> · +{fmtInrRupees(quote.line.printPaise)}</span>
            )}
          </span>
          <span className="block text-xs leading-4 text-body">
            Leave this off and we ship the empty frame for your own photo.
          </span>
        </span>
      </label>

      {print && (
        <Group label="Which photo" aside={useOwn ? 'Yours' : 'This artwork'}>
          <div className="flex flex-wrap gap-2">
            <Chip on={!useOwn} onClick={() => setUseOwn(false)}>
              Print this artwork
            </Chip>
            <Chip on={useOwn} onClick={() => setUseOwn(true)}>
              Print my own photo
            </Chip>
          </div>
          <p className="mt-2 text-xs leading-4 text-faint">
            {useOwn
              ? 'Upload it under the wall preview. We print, mount and fit it before the frame ships.'
              : 'We print the artwork shown in the frame and fit it for you — nothing to upload.'}
          </p>
        </Group>
      )}

      {print && papers.length > 0 && (
        <Group label="Paper">
          <div className="flex flex-wrap gap-2">
            {papers.map((p) => (
              <Chip key={p.id} on={p.id === paperId} onClick={() => setPaperId(p.id)}>
                {p.name}
              </Chip>
            ))}
          </div>
        </Group>
      )}

      <div className="flex flex-col gap-3 pt-2">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center rounded-full bg-surface p-1 shadow-[0_1px_1px_rgba(0,0,0,0.05)]">
            <StepButton onClick={() => setQty((q) => Math.max(1, q - 1))} label="Decrease quantity">
              −
            </StepButton>
            <span className="px-3 font-display text-base font-bold text-ink">{qty}</span>
            <StepButton onClick={() => setQty((q) => Math.min(99, q + 1))} label="Increase quantity">
              +
            </StepButton>
          </div>

          <button
            type="button"
            onClick={submit}
            disabled={pending || !quote.ok || (print && useOwn && !artwork)}
            className="flex-1 rounded-full bg-accent px-6 py-3 font-display text-base font-semibold text-accent-ink shadow-[0_4px_6px_rgba(255,195,41,0.35)] disabled:opacity-50"
          >
            {pending
              ? 'Adding…'
              : print && useOwn && !artwork
                ? 'Upload your photo first'
                : `Add to basket — ${total === null ? '—' : fmtInrRupees(total)}`}
          </button>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2">
          {added ? (
            <span className="text-[13px] font-semibold text-violet-ink">
              Added to your basket.
            </span>
          ) : (
            <span className="text-[13px] font-semibold text-body">Save for later</span>
          )}
          {toFreeShipping !== null && toFreeShipping > 0 && (
            <span className="text-xs text-body">
              {fmtInrRupees(toFreeShipping)} more for free flat-pack delivery.
            </span>
          )}
          {toFreeShipping !== null && toFreeShipping <= 0 && (
            <span className="text-xs font-semibold text-violet-ink">
              Free flat-pack delivery included.
            </span>
          )}
        </div>
      </div>
      </div>
    </div>
  )
}

function Group({
  label,
  aside,
  children,
}: {
  label: string
  aside?: string
  children: React.ReactNode
}) {
  return (
    <section>
      <div className="mb-2 flex items-center justify-between">
        <h2 className="text-[11px] font-bold uppercase tracking-[0.05em] text-body">{label}</h2>
        {aside && <span className="text-xs text-violet-deep">{aside}</span>}
      </div>
      {children}
    </section>
  )
}

function Chip({
  on,
  disabled,
  onClick,
  children,
}: {
  on: boolean
  disabled?: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-pressed={on}
      className={`rounded-full px-4 py-[6px] text-[13px] font-semibold shadow-[0_1px_1px_rgba(0,0,0,0.05)] disabled:cursor-not-allowed disabled:opacity-40 ${
        on ? 'bg-ink text-page' : 'bg-surface text-ink'
      }`}
    >
      {children}
    </button>
  )
}

function StepButton({
  onClick,
  label,
  children,
}: {
  onClick: () => void
  label: string
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className="grid size-8 place-items-center rounded-full text-lg leading-none text-ink hover:bg-subtle"
    >
      {children}
    </button>
  )
}
