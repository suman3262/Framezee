/**
 * The only place a price is calculated. Nothing else in the app multiplies money.
 *
 * Units — all integers, no floats anywhere in the money path:
 *   dimensions  tenths of an inch   (40 in  -> 400)
 *   rates       paise per sq inch   (Rs 4   -> 400)
 *   money       paise               (Rs 140 -> 14000)
 *
 * A band's dimensions only SELECT the rate. They never enter the multiplication:
 * the rate is charged against the frame's actual area.
 *
 *   40 x 60 in, band "under 100x100 -> Rs 4/sq-in"
 *   area = 2,400 sq-in  ->  2,400 x 400 paise = Rs 9,600
 */

export type Band = {
  maxWidthTenths: number
  maxHeightTenths: number
  ratePaisePerSqIn: number
}

export type Limits = {
  minWidthTenths: number
  maxWidthTenths: number
  minHeightTenths: number
  maxHeightTenths: number
}

export type AddOn = { name: string; bands: Band[] }

export type LineInput = {
  widthTenths: number
  heightTenths: number
  qty: number
  material: { name: string; limits: Limits; bands: Band[] }
  /** Printing the customer's photo. Optional and charged on top. */
  paper?: AddOn
  /** Upgraded glazing. The standard styrene is included, so it has no bands. */
  glazing?: AddOn
  /**
   * A mat board, when one is chosen. Like glazing, no bands means free — that is how
   * the mat ships free for launch and starts costing money later without a code change.
   */
  mat?: AddOn
}

export type LineBreakdown = {
  widthTenths: number
  heightTenths: number
  areaSqInHundredths: number
  framePaise: number
  frameRatePaise: number
  printPaise: number
  printRatePaise: number | null
  paperName: string | null
  glazingPaise: number
  glazingRatePaise: number | null
  glazingName: string | null
  matPaise: number
  matRatePaise: number | null
  matName: string | null
  unitPaise: number
  qty: number
  linePaise: number
}

export class PriceError extends Error {}

/** Frames rotate, so compare long side to long side. A 30x50 fits a 50x30 band. */
function fitsBand(w: number, h: number, b: Band): boolean {
  const [short, long] = w <= h ? [w, h] : [h, w]
  const [bShort, bLong] =
    b.maxWidthTenths <= b.maxHeightTenths
      ? [b.maxWidthTenths, b.maxHeightTenths]
      : [b.maxHeightTenths, b.maxWidthTenths]
  return short <= bShort && long <= bLong
}

/** Smallest band that still fits wins, so bands can be entered in any order. */
function selectBand(w: number, h: number, bands: Band[], what: string): Band {
  const hit = [...bands]
    .sort((a, b) => a.maxWidthTenths * a.maxHeightTenths - b.maxWidthTenths * b.maxHeightTenths)
    .find((b) => fitsBand(w, h, b))
  if (!hit) throw new PriceError(`No ${what} rate covers ${fmtIn(w)} x ${fmtIn(h)} in`)
  return hit
}

function charge(areaSqInHundredths: number, ratePaisePerSqIn: number): number {
  return Math.round((areaSqInHundredths * ratePaisePerSqIn) / 100)
}

export function priceLine(input: LineInput): LineBreakdown {
  const { widthTenths: w, heightTenths: h, qty, material, paper, glazing, mat } = input

  if (!Number.isInteger(w) || !Number.isInteger(h) || w <= 0 || h <= 0)
    throw new PriceError('Dimensions must be positive whole tenths of an inch')
  if (!Number.isInteger(qty) || qty <= 0) throw new PriceError('Quantity must be a positive whole number')

  const l = material.limits
  if (w < l.minWidthTenths || w > l.maxWidthTenths)
    throw new PriceError(
      `Width ${fmtIn(w)} in is outside ${material.name}: ${fmtIn(l.minWidthTenths)}-${fmtIn(l.maxWidthTenths)} in`,
    )
  if (h < l.minHeightTenths || h > l.maxHeightTenths)
    throw new PriceError(
      `Height ${fmtIn(h)} in is outside ${material.name}: ${fmtIn(l.minHeightTenths)}-${fmtIn(l.maxHeightTenths)} in`,
    )

  const areaSqInHundredths = w * h
  const frameBand = selectBand(w, h, material.bands, material.name)
  const framePaise = charge(areaSqInHundredths, frameBand.ratePaisePerSqIn)

  const paperBand = paper ? selectBand(w, h, paper.bands, paper.name) : null
  const printPaise = paperBand ? charge(areaSqInHundredths, paperBand.ratePaisePerSqIn) : 0

  // A glazing with no bands is the included one — selected, named on the invoice, free.
  const glazingBand =
    glazing && glazing.bands.length > 0 ? selectBand(w, h, glazing.bands, glazing.name) : null
  const glazingPaise = glazingBand ? charge(areaSqInHundredths, glazingBand.ratePaisePerSqIn) : 0

  // A mat with no bands is free at every size, exactly like the included glazing.
  const matBand = mat && mat.bands.length > 0 ? selectBand(w, h, mat.bands, mat.name) : null
  const matPaise = matBand ? charge(areaSqInHundredths, matBand.ratePaisePerSqIn) : 0

  const unitPaise = framePaise + printPaise + glazingPaise + matPaise

  return {
    widthTenths: w,
    heightTenths: h,
    areaSqInHundredths,
    framePaise,
    frameRatePaise: frameBand.ratePaisePerSqIn,
    printPaise,
    printRatePaise: paperBand?.ratePaisePerSqIn ?? null,
    paperName: paper?.name ?? null,
    glazingPaise,
    glazingRatePaise: glazingBand?.ratePaisePerSqIn ?? null,
    glazingName: glazing?.name ?? null,
    matPaise,
    matRatePaise: matBand?.ratePaisePerSqIn ?? null,
    matName: mat?.name ?? null,
    unitPaise,
    qty,
    linePaise: unitPaise * qty,
  }
}

/** Cheapest price across a set of sizes — the "from Rs x" on listing pages. */
export function priceFrom(sizes: Array<{ widthTenths: number; heightTenths: number }>, material: LineInput['material']): number | null {
  const prices = sizes.flatMap((s) => {
    try {
      return [priceLine({ ...s, qty: 1, material }).unitPaise]
    } catch {
      return [] // size this material can't make — skip it, don't fail the page
    }
  })
  return prices.length ? Math.min(...prices) : null
}

export const fmtIn = (tenths: number): string => (tenths / 10).toString()

/** Exact money, for carts, invoices and anything the customer pays. */
export const fmtInr = (paise: number): string =>
  '₹' + (paise / 100).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

/**
 * Whole rupees, for "from ₹x" and price ranges on listing pages.
 * Rounds UP so a advertised price is never lower than what actually gets charged.
 */
export const fmtInrRupees = (paise: number): string =>
  '₹' + Math.ceil(paise / 100).toLocaleString('en-IN')
