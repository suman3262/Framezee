'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { fmtIn } from '@/lib/pricing.ts'

export type Transform = { x: number; y: number; scale: number; rotation: number }

/**
 * How wide the frame draws at scale 1, as a percentage of the wall.
 *
 * Not true to life on purpose: a life-size wall would render a 7 in frame as a speck.
 * A 7 in one takes a small part of the wall, a 40 in one nearly fills it.
 */
export const widthPct0 = (widthTenths: number) => (widthTenths / 600) * 150

/** The scale that makes a frame of this size fill `pct` of the wall's width. */
export const scaleForFill = (widthTenths: number, pct: number) =>
  Math.max(0.5, pct / widthPct0(widthTenths))


/**
 * The wall visualiser (Figma 3:1167). The frame is dragged to position and scaled.
 *
 * Only the transform is kept — never a rendered composite. The room photo is a preview
 * the customer is judging their wall against; the print file is rendered from the
 * original artwork when the order reaches the workshop.
 */
export function WallCanvas({
  widthTenths,
  heightTenths,
  swatch,
  thicknessTenths,
  matBoard,
  matHex,
  artworkUrl,
  artworkCss,
  wallHex,
  wallPhotoUrl,
  transform,
  onTransform,
}: {
  widthTenths: number
  heightTenths: number
  swatch: string
  thicknessTenths: number
  matBoard: boolean
  matHex: string
  artworkUrl: string | null
  /** A CSS background for catalogue artwork, used when nothing is uploaded. */
  artworkCss?: string | null
  wallHex: string
  wallPhotoUrl: string | null
  transform: Transform
  onTransform: (t: Transform) => void
}) {
  const wallRef = useRef<HTMLDivElement>(null)
  const drag = useRef<{ startX: number; startY: number; origX: number; origY: number } | null>(null)
  const [dragging, setDragging] = useState(false)

  const onPointerDown = (e: React.PointerEvent) => {
    // Capture keeps the drag alive if the pointer leaves the frame, but it throws for a
    // pointer id the browser does not know. Losing capture is survivable; losing the
    // whole drag handler is not.
    try {
      ;(e.target as Element).setPointerCapture?.(e.pointerId)
    } catch {
      // carry on without capture
    }
    drag.current = {
      startX: e.clientX,
      startY: e.clientY,
      origX: transform.x,
      origY: transform.y,
    }
    setDragging(true)
  }

  const onPointerMove = useCallback(
    (e: React.PointerEvent) => {
      const d = drag.current
      const wall = wallRef.current
      if (!d || !wall) return
      const rect = wall.getBoundingClientRect()
      // Percentages, so the placement survives the canvas being a different size later.
      const dx = ((e.clientX - d.startX) / rect.width) * 100
      const dy = ((e.clientY - d.startY) / rect.height) * 100
      onTransform({
        ...transform,
        x: clamp(d.origX + dx, 5, 95),
        y: clamp(d.origY + dy, 5, 95),
      })
    },
    [transform, onTransform],
  )

  const endDrag = () => {
    drag.current = null
    setDragging(false)
  }

  // Arrow keys nudge the frame, so positioning does not require a mouse.
  useEffect(() => {
    const el = wallRef.current
    if (!el) return
    const onKey = (e: KeyboardEvent) => {
      const step = e.shiftKey ? 5 : 1
      const moves: Record<string, [number, number]> = {
        ArrowLeft: [-step, 0],
        ArrowRight: [step, 0],
        ArrowUp: [0, -step],
        ArrowDown: [0, step],
      }
      const move = moves[e.key]
      if (!move) return
      e.preventDefault()
      onTransform({
        ...transform,
        x: clamp(transform.x + move[0], 5, 95),
        y: clamp(transform.y + move[1], 5, 95),
      })
    }
    el.addEventListener('keydown', onKey)
    return () => el.removeEventListener('keydown', onKey)
  }, [transform, onTransform])

  const ratio = widthTenths / heightTenths
  const border = Math.max(6, Math.round(thicknessTenths * 1.6))
  const mat = matBoard ? Math.max(10, Math.round((widthTenths + heightTenths) / 40)) : 0

  // Illustrative rather than life-size: a 12 in frame reads at about a third of the
  // wall, a 40 in one nearly fills it. A true-to-scale wall would leave the small sizes
  // as specks.
  const widthPct = clamp(widthPct0(widthTenths) * transform.scale, 10, 92)

  return (
    <div
      ref={wallRef}
      tabIndex={0}
      role="application"
      aria-label="Wall preview — drag or use the arrow keys to position the frame"
      className="relative aspect-[4/3] w-full overflow-hidden rounded-2xl outline-offset-2 focus-visible:outline-2 focus-visible:outline-violet-deep"
      style={{
        background: wallPhotoUrl ? `center/cover url(${wallPhotoUrl})` : wallHex,
        cursor: dragging ? 'grabbing' : 'grab',
      }}
      onPointerMove={onPointerMove}
      onPointerUp={endDrag}
      onPointerLeave={endDrag}
    >
      {!wallPhotoUrl && (
        <div
          aria-hidden
          className="absolute inset-0 opacity-30"
          style={{
            background:
              'linear-gradient(180deg,rgba(255,255,255,0.14),transparent 45%),radial-gradient(60% 40% at 50% 0%,rgba(255,255,255,0.18),transparent)',
          }}
        />
      )}

      <div
        onPointerDown={onPointerDown}
        className="absolute touch-none select-none"
        style={{
          left: `${transform.x}%`,
          top: `${transform.y}%`,
          width: `${widthPct}%`,
          transform: 'translate(-50%,-50%)',
        }}
      >
        <div
          className="shadow-[0_24px_48px_-20px_rgba(0,0,0,0.65)]"
          style={{
            aspectRatio: String(ratio),
            border: `${border}px solid ${swatch}`,
            background: matBoard ? matHex : swatch,
            padding: mat,
            transform: `rotate(${transform.rotation}deg)`,
          }}
        >
          <div
            className="grid size-full place-items-center overflow-hidden"
            style={{
              background: artworkUrl
                ? `center/cover url(${artworkUrl})`
                : (artworkCss ?? '#e9e4dc'),
            }}
          >
            {!artworkUrl && !artworkCss && (
              <span className="px-2 text-center text-[10px] font-semibold uppercase tracking-[0.08em] text-stone-500">
                {fmtIn(widthTenths)} × {fmtIn(heightTenths)} in
                <span className="mt-[2px] block text-[9px] font-normal normal-case tracking-normal">
                  Preview area
                </span>
              </span>
            )}
          </div>
        </div>
      </div>

      <span className="pointer-events-none absolute bottom-3 left-3 rounded-full bg-black/55 px-3 py-[6px] text-[11px] font-semibold text-white backdrop-blur-sm">
        Drag the frame to position it on the wall
      </span>
    </div>
  )
}

const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n))
