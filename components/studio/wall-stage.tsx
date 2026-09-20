'use client'

import { useRef, useState } from 'react'
import { WallCanvas, type Transform } from './wall-canvas.tsx'
import { uploadImage } from './upload.ts'

export type Preset = { key: string; name: string; hex: string }

export const CENTRED: Transform = { x: 50, y: 45, scale: 1, rotation: 0 }

/**
 * The wall visualiser and its controls, shared by the product page and the Custom Studio.
 * Both designs stage a frame the same way, so they use the same component rather than two
 * that drift apart.
 */
export function WallStage({
  widthTenths,
  heightTenths,
  swatch,
  thicknessTenths,
  matBoard,
  matHex = '#fbf9f5',
  artwork,
  artworkCss,
  wallPresets,
  onArtwork,
  allowArtwork,
  artworkHint,
  initialScale,
  compact,
}: {
  widthTenths: number
  heightTenths: number
  swatch: string
  thicknessTenths: number
  matBoard: boolean
  matHex?: string
  artwork: { path: string; url: string; w: number; h: number } | null
  artworkCss?: string | null
  wallPresets: Preset[]
  onArtwork?: (a: { path: string; url: string; w: number; h: number } | null) => void
  /** Show the photograph picker. The product page only wants it once print is chosen. */
  allowArtwork?: boolean
  /** A line under the button, e.g. the DPI at the chosen size. */
  artworkHint?: React.ReactNode
  /** Opening scale. The product page starts larger so the frame reads at a glance. */
  initialScale?: number
  compact?: boolean
}) {
  // Placement and rotation are a preview only — nothing downstream reads them, so they
  // live and die with this component.
  const [transform, setTransform] = useState<Transform>(() =>
    initialScale ? { ...CENTRED, scale: initialScale } : CENTRED,
  )
  const [wallKey, setWallKey] = useState(wallPresets[0]?.key ?? '')
  const [wallPhoto, setWallPhoto] = useState<{ url: string } | null>(null)
  const [busy, setBusy] = useState<null | 'artwork' | 'wall'>(null)
  const [error, setError] = useState<string | null>(null)

  const artInput = useRef<HTMLInputElement>(null)
  const wallInput = useRef<HTMLInputElement>(null)
  const wall = wallPresets.find((w) => w.key === wallKey) ?? wallPresets[0]

  /**
   * The artwork is uploaded — it gets printed, so the workshop needs the file.
   *
   * The wall photo is not. It only exists to help someone picture the frame in their
   * room, so it stays in the browser as an object URL. Nothing to store, nothing to
   * keep private, nothing to clean up later.
   */
  async function pickArtwork(file: File | undefined) {
    if (!file) return
    setError(null)
    setBusy('artwork')
    const res = await uploadImage(file, 'artwork')
    setBusy(null)
    if (!res.ok) return setError(res.error)
    onArtwork?.({ path: res.path, url: res.url, w: res.widthPx, h: res.heightPx })
  }

  function pickWall(file: File | undefined) {
    if (!file) return
    setError(null)
    if (!file.type.startsWith('image/')) return setError('Use a JPG, PNG or WebP image.')
    setWallPhoto((old) => {
      if (old) URL.revokeObjectURL(old.url)
      return { url: URL.createObjectURL(file) }
    })
  }

  return (
    <div className="flex flex-col gap-3">
      <WallCanvas
        widthTenths={widthTenths}
        heightTenths={heightTenths}
        swatch={swatch}
        thicknessTenths={thicknessTenths}
        matBoard={matBoard}
        matHex={matHex}
        artworkUrl={artwork?.url ?? null}
        artworkCss={artworkCss ?? null}
        wallHex={wall?.hex ?? '#2c3550'}
        wallPhotoUrl={wallPhoto?.url ?? null}
        transform={transform}
        onTransform={setTransform}
      />

      <div className="flex flex-wrap items-center gap-4 rounded-full bg-surface px-4 py-2 shadow-[0_1px_1px_rgba(0,0,0,0.05)]">
        <Slider
          label="Scale"
          min={0.5}
          max={2.6}
          step={0.01}
          value={transform.scale}
          onChange={(v) => setTransform({ ...transform, scale: v })}
        />
        <Slider
          label="Rotate"
          min={-15}
          max={15}
          step={1}
          value={transform.rotation}
          onChange={(v) => setTransform({ ...transform, rotation: v })}
          suffix="°"
        />
        <button
          type="button"
          onClick={() => setTransform(initialScale ? { ...CENTRED, scale: initialScale } : CENTRED)}
          className="shrink-0 rounded-full bg-subtle px-3 py-1 text-xs font-semibold text-ink"
        >
          Centre frame
        </button>
      </div>

      <div className="rounded-2xl bg-surface p-4 shadow-[0_1px_1px_rgba(0,0,0,0.05)]">
        <div className="mb-2 flex items-center justify-between">
          <h2 className="text-[10px] font-bold uppercase tracking-[0.05em] text-body">
            See it on your wall
          </h2>
          <span className="rounded-full bg-violet-tint px-2 py-[1px] text-[9px] font-bold text-violet-ink">
            Interactive
          </span>
        </div>

        <input ref={wallInput} type="file" accept="image/*" hidden onChange={(e) => pickWall(e.target.files?.[0])} />
        <button
          type="button"
          onClick={() => wallInput.current?.click()}
          disabled={busy !== null}
          className="w-full rounded-xl border border-dashed border-violet-deep/40 bg-violet-tint/40 px-4 py-3 text-[13px] font-semibold text-violet-ink disabled:opacity-50"
        >
          {busy === 'wall' ? 'Uploading…' : wallPhoto ? 'Use a different wall photo' : 'Use a photo of your own wall'}
        </button>

        <p className="mt-3 text-[11px] text-body">Or pick one of ours:</p>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          {wallPresets.map((w) => (
            <button
              key={w.key}
              type="button"
              title={w.name}
              aria-label={w.name}
              aria-pressed={!wallPhoto && w.key === wallKey}
              onClick={() => {
                setWallPhoto((old) => {
                  if (old) URL.revokeObjectURL(old.url)
                  return null
                })
                setWallKey(w.key)
              }}
              className={`size-7 rounded-lg ${
                !wallPhoto && w.key === wallKey ? 'ring-2 ring-violet-deep ring-offset-2' : ''
              }`}
              style={{ background: w.hex }}
            />
          ))}
        </div>

        {(allowArtwork ?? !compact) && (
          <div className="mt-4 border-t border-line pt-4">
            <div className="mb-2 flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-[0.05em] text-body">
                The photo inside the frame
              </span>
              {artwork && (
                <span className="rounded-full bg-emerald-100 px-2 py-[2px] text-[10px] font-bold text-emerald-900">
                  Ready to print
                </span>
              )}
            </div>

            <input ref={artInput} type="file" accept="image/*" hidden onChange={(e) => pickArtwork(e.target.files?.[0])} />
            <button
              type="button"
              onClick={() => artInput.current?.click()}
              disabled={busy !== null}
              className="w-full rounded-xl bg-subtle px-4 py-3 text-[13px] font-bold text-ink disabled:opacity-50"
            >
              {busy === 'artwork' ? 'Uploading…' : artwork ? 'Replace your photograph' : 'Upload your photograph'}
            </button>

            {artwork && (
              <button
                type="button"
                onClick={() => onArtwork?.(null)}
                className="mt-1 w-full text-center text-[11px] font-semibold text-body hover:text-ink"
              >
                Remove it
              </button>
            )}

            <div className="mt-1 text-center text-[11px] leading-4 text-body">
              {artworkHint ?? 'Or leave it empty and we ship the frame alone'}
            </div>
          </div>
        )}

        {error && <p className="mt-2 text-[11px] font-medium text-red-600">{error}</p>}
      </div>
    </div>
  )
}

function Slider({
  label,
  min,
  max,
  step,
  value,
  onChange,
  suffix,
}: {
  label: string
  min: number
  max: number
  step: number
  value: number
  onChange: (v: number) => void
  suffix?: string
}) {
  return (
    <label className="flex min-w-[140px] flex-1 items-center gap-2">
      <span className="text-[10px] font-bold uppercase tracking-[0.05em] text-body">{label}</span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="h-1 flex-1 accent-[color:var(--violet-deep)]"
        aria-label={label}
      />
      {suffix && <span className="w-7 text-right text-[10px] text-faint">{value}{suffix}</span>}
    </label>
  )
}
