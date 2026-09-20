/**
 * The configurable options on a frame, and the rules between them.
 *
 * Kept apart from lib/pricing.ts because these are availability rules, not money.
 *
 * Thicknesses used to be two constants here. They are rows in frame_thicknesses now, so
 * the workshop can add a 2 inch moulding without a deploy — the functions below take the
 * list rather than closing over it.
 */

export type Thickness = {
  tenths: number
  label: string
  /** Null means no limit. A thin moulding bows under a large sheet of glazing. */
  maxLongTenths: number | null
  maxShortTenths: number | null
}

export type ShapeKey = 'horizontal' | 'square' | 'vertical'

export const SHAPES: { key: ShapeKey; label: string }[] = [
  { key: 'horizontal', label: 'Horizontal' },
  { key: 'square', label: 'Square' },
  { key: 'vertical', label: 'Vertical' },
]

export function shapeOf(widthTenths: number, heightTenths: number): ShapeKey {
  if (widthTenths === heightTenths) return 'square'
  return widthTenths > heightTenths ? 'horizontal' : 'vertical'
}

export function thicknessAvailable(
  t: Thickness,
  widthTenths: number,
  heightTenths: number,
): boolean {
  const long = Math.max(widthTenths, heightTenths)
  const short = Math.min(widthTenths, heightTenths)
  if (t.maxLongTenths !== null && long > t.maxLongTenths) return false
  if (t.maxShortTenths !== null && short > t.maxShortTenths) return false
  return true
}

/** The thickness to fall back to when the chosen one stops being available. */
export function resolveThickness(
  wanted: number,
  widthTenths: number,
  heightTenths: number,
  list: Thickness[],
): number {
  const chosen = list.find((t) => t.tenths === wanted)
  if (chosen && thicknessAvailable(chosen, widthTenths, heightTenths)) return wanted
  const fallback = list.find((t) => thicknessAvailable(t, widthTenths, heightTenths))
  return fallback?.tenths ?? (list[0]?.tenths ?? 10)
}

/** "1/2 inch is only available up to 8 x 12 in." — built from whatever the rule now is. */
export function thicknessNote(list: Thickness[]): string | null {
  const limited = list.filter((t) => t.maxLongTenths !== null || t.maxShortTenths !== null)
  if (limited.length === 0) return null
  return limited
    .map((t) => {
      const parts: string[] = []
      if (t.maxShortTenths !== null) parts.push(`${t.maxShortTenths / 10} in`)
      if (t.maxLongTenths !== null) parts.push(`${t.maxLongTenths / 10} in`)
      return `${t.label} is only available up to ${parts.join(' x ')}.`
    })
    .join(' ')
}
