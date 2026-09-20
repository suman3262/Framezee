'use client'

import { useMemo, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { priceLine, fmtIn, fmtInr, fmtInrRupees, PriceError, type Band, type Limits } from '@/lib/pricing.ts'
import { thicknessAvailable, resolveThickness, thicknessNote, shapeOf, SHAPES, type ShapeKey, type Thickness } from '@/lib/frame-options.ts'
import {
  validateCustomSize,
  outerSizeTenths,
  areaSqIn,
  toTenths,
  fromTenths,
  type Unit,
} from '@/lib/custom-frame.ts'
import { WallStage } from './wall-stage.tsx'
import { printQuality } from './upload.ts'
import { addCustomToCart } from '@/app/actions/custom.ts'

export type Finish = {
  id: string
  slug: string
  name: string
  swatch: string
  description: string | null
  limits: Limits
  bands: Band[]
}
export type Glazing = { id: string; name: string; description: string | null; included: boolean; bands: Band[] }
export type Preset = { key: string; name: string; hex: string }

export function Studio({
  finishes,
  glazings,
  wallPresets,
  matColours,
  thicknesses,
  matBands,
}: {
  finishes: Finish[]
  glazings: Glazing[]
  wallPresets: Preset[]
  matColours: Preset[]
  thicknesses: Thickness[]
  matBands: Band[]
}) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()

  const [unit, setUnit] = useState<Unit>('in')
  const [widthTenths, setWidthTenths] = useState(120)
  const [heightTenths, setHeightTenths] = useState(160)
  const [finishSlug, setFinishSlug] = useState(
    () => (finishes.find((f) => f.slug === 'golden') ?? finishes[0])?.slug ?? '',
  )
  const [thickness, setThickness] = useState(() => thicknesses.at(-1)?.tenths ?? 10)
  const [matBoard, setMatBoard] = useState(true)
  const [matKey, setMatKey] = useState(matColours[0]?.key ?? 'white')
  const [glazingId, setGlazingId] = useState(glazings.find((g) => g.included)?.id ?? glazings[0]?.id ?? '')

  const [artwork, setArtwork] = useState<{ path: string; url: string; w: number; h: number } | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [added, setAdded] = useState(false)

  const finish = finishes.find((f) => f.slug === finishSlug) ?? finishes[0]
  const glazing = glazings.find((g) => g.id === glazingId) ?? glazings[0]
  const mat = matColours.find((m) => m.key === matKey) ?? matColours[0]

  const sizeCheck = validateCustomSize(widthTenths, heightTenths)
  const effectiveThickness = resolveThickness(thickness, widthTenths, heightTenths, thicknesses)
  const outer = outerSizeTenths(widthTenths, heightTenths, effectiveThickness)
  const shape = shapeOf(widthTenths, heightTenths)

  const quote = useMemo(() => {
    if (!sizeCheck.ok || !finish) return { ok: false as const, message: sizeCheck.ok ? 'Choose a moulding.' : sizeCheck.message }
    try {
      return {
        ok: true as const,
        line: priceLine({
          widthTenths,
          heightTenths,
          qty: 1,
          material: { name: finish.name, limits: finish.limits, bands: finish.bands },
          glazing: glazing ? { name: glazing.name, bands: glazing.bands } : undefined,
        }),
      }
    } catch (e) {
      return { ok: false as const, message: e instanceof PriceError ? e.message : 'Unavailable at this size.' }
    }
  }, [widthTenths, heightTenths, finish, glazing, sizeCheck])

  const quality = artwork ? printQuality(artwork.w, artwork.h, widthTenths, heightTenths) : null

  function submit() {
    if (!quote.ok || !finish) return
    setAdded(false)
    setError(null)
    startTransition(async () => {
      const res = await addCustomToCart({
        widthTenths,
        heightTenths,
        materialId: finish.id,
        thicknessTenths: effectiveThickness,
        matBoard,
        matColour: matBoard ? matKey : null,
        glazingOptionId: glazing?.id ?? null,
        artworkPath: artwork?.path ?? null,
      })
      if (res.redirectTo) return router.push(res.redirectTo)
      if (res.error) return setError(res.error)
      setAdded(true)
      router.refresh()
    })
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,58fr)_minmax(0,42fr)]">
      {/* ── left: the wall ── */}
      <div className="flex flex-col gap-4">
        <WallStage
          widthTenths={widthTenths}
          heightTenths={heightTenths}
          swatch={finish?.swatch ?? '#ccc'}
          thicknessTenths={effectiveThickness}
          matBoard={matBoard}
          matHex={mat?.hex ?? '#fbf9f5'}
          artwork={artwork}
          wallPresets={wallPresets}
          onArtwork={setArtwork}
        />

        {quality && (
          <p
            className={`rounded-xl bg-surface px-4 py-3 text-center text-xs font-semibold shadow-[0_1px_1px_rgba(0,0,0,0.05)] ${
              quality.ok ? 'text-violet-ink' : 'text-red-600'
            }`}
          >
            {quality.ok
              ? `Good to print — about ${quality.dpi} DPI at this size.`
              : `Only ${quality.dpi} DPI at ${fmtIn(widthTenths)} × ${fmtIn(heightTenths)} in. Below 150 DPI the print will look soft.`}
          </p>
        )}
      </div>

      {/* ── right: the steps ── */}
      <div className="flex flex-col gap-5">
        <Step n="01" label="Picture size">
          <div className="flex flex-wrap gap-2">
            {SHAPES.map((s) => (
              <Chip key={s.key} on={shape === s.key} onClick={() => applyShape(s.key)}>
                {s.label}
              </Chip>
            ))}
          </div>

          <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-[1fr_1fr_auto]">
            <NumberField
              label={`Width (${unit})`}
              value={fromTenths(widthTenths, unit)}
              onChange={(v) => setWidthTenths(toTenths(v, unit))}
              invalid={!sizeCheck.ok && (sizeCheck.field === 'width' || sizeCheck.field === 'both')}
            />
            <NumberField
              label={`Height (${unit})`}
              value={fromTenths(heightTenths, unit)}
              onChange={(v) => setHeightTenths(toTenths(v, unit))}
              invalid={!sizeCheck.ok && (sizeCheck.field === 'height' || sizeCheck.field === 'both')}
            />
            <div className="flex flex-col">
              <span className="mb-1 text-[11px] font-bold uppercase tracking-[0.05em] text-body">Unit</span>
              <div className="flex overflow-hidden rounded-full bg-subtle p-1">
                {(['in', 'cm'] as Unit[]).map((u) => (
                  <button
                    key={u}
                    type="button"
                    onClick={() => setUnit(u)}
                    className={`rounded-full px-3 py-1 text-xs font-semibold ${
                      unit === u ? 'bg-ink text-page' : 'text-ink'
                    }`}
                  >
                    {u}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="mt-2 flex items-center justify-between">
            <span className="text-xs text-faint">Area</span>
            <span className="text-xs font-semibold text-ink">
              {areaSqIn(widthTenths, heightTenths)} sq in
            </span>
          </div>
          {!sizeCheck.ok && (
            <p className="mt-1 text-xs font-medium text-red-600">{sizeCheck.message}</p>
          )}
        </Step>

        <Step n="02" label="Moulding" aside={finish?.name}>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {finishes.map((f) => {
              const on = f.slug === finish?.slug
              return (
                <button
                  key={f.slug}
                  type="button"
                  onClick={() => setFinishSlug(f.slug)}
                  aria-pressed={on}
                  className={`flex items-center gap-2 rounded-xl px-3 py-2 text-left shadow-[0_1px_1px_rgba(0,0,0,0.05)] ${
                    on ? 'bg-violet-tint text-violet-ink ring-1 ring-violet-deep' : 'bg-surface text-ink'
                  }`}
                >
                  <span
                    className="size-4 shrink-0 rounded-[4px] shadow-[0_1px_2px_rgba(0,0,0,0.15)]"
                    style={{ background: f.swatch }}
                  />
                  <span className="min-w-0 text-[12px] font-semibold leading-4">{f.name}</span>
                </button>
              )
            })}
          </div>
        </Step>

        <Step n="03" label="Frame thickness">
          <div className="flex flex-wrap gap-2">
            {thicknesses.map((t) => (
              <Chip
                key={t.tenths}
                on={effectiveThickness === t.tenths}
                disabled={!thicknessAvailable(t, widthTenths, heightTenths)}
                onClick={() => setThickness(t.tenths)}
              >
                {t.label}
              </Chip>
            ))}
          </div>
          {thicknessNote(thicknesses) && (
            <p className="mt-2 text-xs text-faint">{thicknessNote(thicknesses)}</p>
          )}
        </Step>

        <Step n="04" label="Mat border">
          <div className="flex flex-wrap items-center gap-2">
            <Chip on={!matBoard} onClick={() => setMatBoard(false)}>No mat</Chip>
            <Chip on={matBoard} onClick={() => setMatBoard(true)}>Mat</Chip>
            {matBoard &&
              matColours.map((m) => (
                <Chip key={m.key} on={m.key === matKey} onClick={() => setMatKey(m.key)}>
                  <span className="flex items-center gap-2">
                    <span
                      className="size-3 rounded-full ring-1 ring-black/10"
                      style={{ background: m.hex }}
                    />
                    {m.name}
                  </span>
                </Chip>
              ))}
          </div>
        </Step>

        <Step n="05" label="Glazing">
          <div className="flex flex-col gap-2">
            {glazings.map((g) => {
              const on = g.id === glazing?.id
              const extra =
                quote.ok && on ? quote.line.glazingPaise : priceGlazing(g, widthTenths, heightTenths)
              return (
                <button
                  key={g.id}
                  type="button"
                  onClick={() => setGlazingId(g.id)}
                  aria-pressed={on}
                  className={`flex items-center justify-between gap-3 rounded-xl px-4 py-3 text-left shadow-[0_1px_1px_rgba(0,0,0,0.05)] ${
                    on ? 'bg-violet-tint ring-1 ring-violet-deep' : 'bg-surface'
                  }`}
                >
                  <span className="min-w-0">
                    <span className={`block text-[13px] font-semibold ${on ? 'text-violet-ink' : 'text-ink'}`}>
                      {g.name}
                    </span>
                    {g.description && (
                      <span className="block text-xs text-body">{g.description}</span>
                    )}
                  </span>
                  <span className={`shrink-0 text-xs font-semibold ${on ? 'text-violet-ink' : 'text-body'}`}>
                    {extra > 0 ? `+${fmtInrRupees(extra)}` : 'Included'}
                  </span>
                </button>
              )
            })}
          </div>
        </Step>

        <section className="rounded-2xl bg-surface p-5 shadow-[0_1px_1px_rgba(0,0,0,0.05)]">
          <dl className="flex flex-col gap-2 text-[13px]">
            <SummaryRow
              label={`Frame, cut to ${fmtIn(widthTenths)} × ${fmtIn(heightTenths)} in`}
              value={quote.ok ? fmtInrRupees(quote.line.framePaise) : '—'}
            />
            <SummaryRow label="Mat board, 10 mm" value={matBoard ? 'None' : '—'} muted />
            <SummaryRow
              label="Glazing"
              value={quote.ok && quote.line.glazingPaise > 0 ? fmtInrRupees(quote.line.glazingPaise) : 'Included'}
              muted={!quote.ok || quote.line.glazingPaise === 0}
            />
          </dl>

          <div className="mt-3 flex items-center justify-between border-t border-line pt-3">
            <span className="text-sm font-bold text-ink">Total</span>
            <span className="font-display text-2xl font-extrabold text-ink">
              {quote.ok ? fmtInrRupees(quote.line.unitPaise) : '—'}
            </span>
          </div>

          {error && <p className="mt-3 text-xs font-medium text-red-600">{error}</p>}
          {added && (
            <p className="mt-3 text-xs font-semibold text-violet-ink">
              Added to your basket.
            </p>
          )}

          <button
            type="button"
            onClick={submit}
            disabled={pending || !quote.ok}
            className="mt-4 w-full rounded-full bg-accent px-6 py-3 font-display text-base font-semibold text-accent-ink shadow-[0_4px_6px_rgba(255,195,41,0.35)] disabled:opacity-50"
          >
            {pending
              ? 'Adding…'
              : `Add to basket — ${quote.ok ? fmtInrRupees(quote.line.unitPaise) : '—'}`}
          </button>

          <p className="mt-3 text-center text-[11px] leading-4 text-faint">
            Outer size {fmtIn(outer.widthTenths)} × {fmtIn(outer.heightTenths)} in · acid-free
            board · two hooks and a paper template included
          </p>
          {quote.ok && (
            <p className="mt-1 text-center text-[11px] text-faint">
              Exact: {fmtInr(quote.line.unitPaise)}
            </p>
          )}
        </section>
      </div>
    </div>
  )

  function applyShape(next: ShapeKey) {
    const long = Math.max(widthTenths, heightTenths)
    const short = Math.min(widthTenths, heightTenths)
    if (next === 'square') {
      setWidthTenths(short)
      setHeightTenths(short)
    } else if (next === 'horizontal') {
      setWidthTenths(long)
      setHeightTenths(short === long ? Math.round(long * 0.75) : short)
    } else {
      setHeightTenths(long)
      setWidthTenths(short === long ? Math.round(long * 0.75) : short)
    }
  }
}

function priceGlazing(g: Glazing, w: number, h: number): number {
  if (g.bands.length === 0) return 0
  try {
    return priceLine({
      widthTenths: w,
      heightTenths: h,
      qty: 1,
      material: {
        name: g.name,
        limits: { minWidthTenths: 0, maxWidthTenths: 100_000, minHeightTenths: 0, maxHeightTenths: 100_000 },
        bands: g.bands,
      },
    }).framePaise
  } catch {
    return 0
  }
}

function Step({
  n,
  label,
  aside,
  children,
}: {
  n: string
  label: string
  aside?: string | null
  children: React.ReactNode
}) {
  return (
    <section>
      <div className="mb-2 flex items-center justify-between">
        <h2 className="text-[11px] font-bold uppercase tracking-[0.05em] text-body">
          {n} — {label}
        </h2>
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

function NumberField({
  label,
  value,
  onChange,
  invalid,
}: {
  label: string
  value: number
  onChange: (v: number) => void
  invalid?: boolean
}) {
  return (
    <label className="flex flex-col">
      <span className="mb-1 text-[11px] font-bold uppercase tracking-[0.05em] text-body">{label}</span>
      <input
        type="number"
        inputMode="decimal"
        step="0.1"
        min={0}
        value={Number.isFinite(value) ? value : ''}
        onChange={(e) => onChange(Number(e.target.value))}
        className={`rounded-xl bg-surface px-3 py-2 text-sm font-semibold text-ink shadow-[0_1px_1px_rgba(0,0,0,0.05)] ${
          invalid ? 'ring-1 ring-red-500' : ''
        }`}
      />
    </label>
  )
}

function SummaryRow({ label, value, muted }: { label: string; value: string; muted?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <dt className="text-body">{label}</dt>
      <dd className={muted ? 'text-faint' : 'font-semibold text-ink'}>{value}</dd>
    </div>
  )
}
