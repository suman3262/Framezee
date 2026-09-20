/**
 * Rules for the Custom Frame Studio (Figma 3:1088).
 *
 * "Any size from 4 × 4 to 40 × 60 in" — read as a rule rather than two numbers: no side
 * under 4 in, the long side no more than 60 in, the short side no more than 40 in. That
 * way a 60 × 40 and a 40 × 60 are both makeable, which is what a workshop would expect.
 */

export const MIN_SIDE_TENTHS = 40 // 4 in
export const MAX_LONG_TENTHS = 600 // 60 in
export const MAX_SHORT_TENTHS = 400 // 40 in

/** The moulding's visible face, which is what makes the outer size bigger than the art. */
const FACE_RATIO = 0.8

export type SizeProblem =
  | { ok: true }
  | { ok: false; field: 'width' | 'height' | 'both'; message: string }

export function validateCustomSize(widthTenths: number, heightTenths: number): SizeProblem {
  if (!Number.isInteger(widthTenths) || !Number.isInteger(heightTenths))
    return { ok: false, field: 'both', message: 'Enter a size in whole tenths of an inch.' }

  if (widthTenths < MIN_SIDE_TENTHS)
    return { ok: false, field: 'width', message: 'Width must be at least 4 in.' }
  if (heightTenths < MIN_SIDE_TENTHS)
    return { ok: false, field: 'height', message: 'Height must be at least 4 in.' }

  const long = Math.max(widthTenths, heightTenths)
  const short = Math.min(widthTenths, heightTenths)

  if (long > MAX_LONG_TENTHS)
    return {
      ok: false,
      field: widthTenths >= heightTenths ? 'width' : 'height',
      message: 'The longer side can be at most 60 in.',
    }
  if (short > MAX_SHORT_TENTHS)
    return {
      ok: false,
      field: widthTenths <= heightTenths ? 'width' : 'height',
      message: 'The shorter side can be at most 40 in.',
    }

  return { ok: true }
}

/**
 * Outer size of the finished frame, which is what has to fit the customer's wall.
 * 12 × 16 in art in a 1 inch moulding measures 13.6 × 17.6 in — the design's own figure.
 */
export function outerSizeTenths(
  widthTenths: number,
  heightTenths: number,
  thicknessTenths: number,
): { widthTenths: number; heightTenths: number } {
  const face = Math.round(thicknessTenths * FACE_RATIO)
  return { widthTenths: widthTenths + face * 2, heightTenths: heightTenths + face * 2 }
}

/** Area shown beside the size fields, in whole square inches. */
export const areaSqIn = (widthTenths: number, heightTenths: number) =>
  Math.round((widthTenths * heightTenths) / 100)

// ── units ───────────────────────────────────────────────────────────────────

export type Unit = 'in' | 'cm'

const CM_PER_INCH = 2.54

/** Whatever the customer typed, in their unit, becomes tenths of an inch. */
export function toTenths(value: number, unit: Unit): number {
  if (!Number.isFinite(value)) return NaN
  return unit === 'in' ? Math.round(value * 10) : Math.round((value / CM_PER_INCH) * 10)
}

/** Tenths of an inch back into the customer's unit, for the input box. */
export function fromTenths(tenths: number, unit: Unit): number {
  return unit === 'in'
    ? Math.round(tenths) / 10
    : Math.round((tenths / 10) * CM_PER_INCH * 10) / 10
}
