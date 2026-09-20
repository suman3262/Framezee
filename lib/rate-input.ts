/**
 * Parsing and checking what a super-admin types into the rate cards.
 *
 * This is a trust boundary with teeth: a rate saved as 0, or a band whose ceiling is
 * smaller than the frames it is meant to cover, silently misprices every future order.
 * The pricing engine itself is already tested — this guards what feeds it.
 */

export type FieldError = { field: string; message: string }

/** "4", "4.5", "₹4.50" → paise. Rejects anything that is not a sane positive amount. */
export function parseRupees(raw: unknown, field: string, { allowZero = false } = {}):
  | { ok: true; paise: number }
  | { ok: false; error: FieldError } {
  const text = String(raw ?? '').trim().replace(/^₹/, '').replace(/,/g, '')
  if (text === '') return { ok: false, error: { field, message: 'Enter an amount.' } }

  const value = Number(text)
  if (!Number.isFinite(value)) return { ok: false, error: { field, message: 'That is not a number.' } }
  if (value < 0) return { ok: false, error: { field, message: 'An amount cannot be negative.' } }
  if (!allowZero && value === 0)
    return { ok: false, error: { field, message: 'A rate of zero would make every frame free.' } }

  const paise = Math.round(value * 100)
  if (paise > 100_000_00)
    return { ok: false, error: { field, message: 'That looks like a typo — over ₹100,000.' } }

  return { ok: true, paise }
}

/** Inches typed by a human → tenths. */
export function parseInches(raw: unknown, field: string):
  | { ok: true; tenths: number }
  | { ok: false; error: FieldError } {
  const text = String(raw ?? '').trim()
  if (text === '') return { ok: false, error: { field, message: 'Enter a size in inches.' } }

  const value = Number(text)
  if (!Number.isFinite(value)) return { ok: false, error: { field, message: 'That is not a number.' } }
  if (value <= 0) return { ok: false, error: { field, message: 'A size must be greater than zero.' } }
  if (value > 500) return { ok: false, error: { field, message: 'That looks like a typo — over 500 in.' } }

  return { ok: true, tenths: Math.round(value * 10) }
}

export type BandDraft = { maxWidthTenths: number; maxHeightTenths: number; ratePaisePerSqIn: number }

/**
 * A material's bands, checked as a set rather than one at a time.
 *
 * The two things that actually break pricing:
 *   - no band large enough for the sizes the material claims to make, so `priceLine`
 *     throws and the frame silently disappears from the shop
 *   - two bands with the same ceiling, where which one wins is a coin toss
 */
export function checkBandSet(
  bands: BandDraft[],
  limits?: { maxWidthTenths: number; maxHeightTenths: number },
): FieldError[] {
  const errors: FieldError[] = []
  if (bands.length === 0) {
    errors.push({ field: 'bands', message: 'A moulding needs at least one rate band.' })
    return errors
  }

  const seen = new Set<string>()
  for (const b of bands) {
    const key = `${b.maxWidthTenths}x${b.maxHeightTenths}`
    if (seen.has(key)) {
      errors.push({ field: 'bands', message: `Two bands both stop at ${b.maxWidthTenths / 10} × ${b.maxHeightTenths / 10} in.` })
    }
    seen.add(key)
  }

  if (limits) {
    const widest = Math.max(...bands.map((b) => Math.max(b.maxWidthTenths, b.maxHeightTenths)))
    const needed = Math.max(limits.maxWidthTenths, limits.maxHeightTenths)
    if (widest < needed) {
      errors.push({
        field: 'bands',
        message: `The largest band stops at ${widest / 10} in, but this moulding is offered up to ${needed / 10} in. Frames between the two cannot be priced.`,
      })
    }
  }

  return errors
}
