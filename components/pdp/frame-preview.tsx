/**
 * A frame drawn to the chosen proportions, so the preview changes as the customer
 * configures. Sprint 5 replaces this with the interactive wall visualiser — the design
 * calls for uploading a room photo and dragging the frame onto it.
 */
export function FramePreview({
  widthTenths,
  heightTenths,
  swatch,
  thicknessTenths,
  matBoard,
  artwork,
  className = '',
}: {
  widthTenths: number
  heightTenths: number
  swatch: string
  thicknessTenths: number
  matBoard: boolean
  /**
   * A CSS `background` shorthand from lib/artwork.ts — a gradient, or a positioned
   * `url(...)`. It must go on `background`, not `backgroundImage`: the shorthand carries
   * position and sizing, and backgroundImage silently drops the whole value, which is
   * exactly how uploaded photographs came out as empty frames.
   */
  artwork: string
  className?: string
}) {
  const ratio = widthTenths / heightTenths
  const border = thicknessTenths === 5 ? 10 : 18
  const mat = matBoard ? 22 : 0

  return (
    <div className={`grid place-items-center ${className}`}>
      <div
        className="shadow-[0_18px_40px_-18px_rgba(28,28,25,0.45)]"
        style={{
          aspectRatio: String(ratio),
          maxWidth: '100%',
          maxHeight: '100%',
          width: ratio >= 1 ? '78%' : 'auto',
          height: ratio >= 1 ? 'auto' : '78%',
          border: `${border}px solid ${swatch}`,
          background: matBoard ? '#fbf9f5' : swatch,
          padding: mat,
        }}
      >
        <div className="size-full overflow-hidden" style={{ background: artwork }} />
      </div>
    </div>
  )
}
