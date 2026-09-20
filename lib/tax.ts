/**
 * GST. The second and last place money is calculated (see lib/pricing.ts for the first).
 *
 * Seller is in West Bengal:
 *   ship-to West Bengal   ->  CGST + SGST, half the rate each
 *   ship-to anywhere else ->  IGST, the full rate
 *
 * The customer pays the same either way. Only the split on the invoice changes.
 *
 * PRICES ARE GST-INCLUSIVE. A rate of Rs 4/sq-in produces the FINAL price the customer
 * pays. Tax is worked backwards out of it for the invoice, never added on top:
 *
 *   Rs 154 inclusive @ 12%  ->  net Rs 137.50 + GST Rs 16.50  =  Rs 154.00
 *
 * Two consequences worth knowing:
 *   - the customer's total is exactly subtotal - discount + shipping, every time
 *   - switching GST on changes no price anywhere, only the invoice breakdown
 *
 * Order of operations, which is the order the GST rules require:
 *   1. discount comes off first, spread across lines by value
 *   2. shipping is added and spread the same way (composite supply: shipping is
 *      taxed at the rate of the goods it carries)
 *   3. tax is extracted from each line at ITS OWN rate — wood and metal differ
 *
 * Units are paise throughout. Shares are apportioned with largest-remainder and net is
 * derived by subtraction, so the parts always add up to the whole — no stray paisa.
 */

export type TaxLineInput = {
  linePaise: number // GST-INCLUSIVE, from lib/pricing.ts
  gstRateBp: number // basis points: 12% -> 1200
}

export type TaxLineResult = TaxLineInput & {
  discountSharePaise: number
  shippingSharePaise: number
  grossPaise: number // what this line contributes to the total
  netPaise: number // gross minus the tax inside it
  taxPaise: number // the tax inside gross
}

export type TaxInput = {
  lines: TaxLineInput[]
  discountPaise?: number
  shippingPaise?: number
  sellerState: string
  shipToState: string
  gstEnabled: boolean
}

export type TaxResult = {
  intraState: boolean
  subtotalPaise: number
  discountPaise: number
  shippingPaise: number
  netPaise: number // taxable value on the invoice
  cgstPaise: number
  sgstPaise: number
  igstPaise: number
  totalTaxPaise: number
  totalPaise: number // = subtotal - discount + shipping, always
  lines: TaxLineResult[]
}

export class TaxError extends Error {}

const normalizeState = (s: string): string => s.trim().toLowerCase().replace(/\s+/g, ' ')

/**
 * Split `total` across `weights` so the shares are whole paise AND sum to exactly
 * `total`. Naive rounding leaves a paisa behind and then the invoice doesn't balance.
 */
export function apportion(total: number, weights: number[]): number[] {
  const sum = weights.reduce((a, b) => a + b, 0)
  if (weights.length === 0) return []
  if (sum <= 0) {
    // Nothing to weigh by — put it all on the first line rather than losing it.
    return weights.map((_, i) => (i === 0 ? total : 0))
  }
  const exact = weights.map((w) => (total * w) / sum)
  const shares = exact.map(Math.floor)
  const leftover = total - shares.reduce((a, b) => a + b, 0)
  const byFraction = exact
    .map((e, i) => ({ i, frac: e - Math.floor(e) }))
    .sort((a, b) => b.frac - a.frac || a.i - b.i)
  for (let k = 0; k < leftover; k++) shares[byFraction[k % byFraction.length].i]++
  return shares
}

/**
 * The tax already contained in a GST-inclusive amount.
 *   gross = net * (1 + rate)   =>   net = gross / (1 + rate)
 * Net is rounded and tax is the remainder, so net + tax === gross exactly.
 */
export function extractTax(grossPaise: number, gstRateBp: number): { netPaise: number; taxPaise: number } {
  const netPaise = Math.round((grossPaise * 10_000) / (10_000 + gstRateBp))
  return { netPaise, taxPaise: grossPaise - netPaise }
}

export function calcTax(input: TaxInput): TaxResult {
  const { lines, sellerState, shipToState, gstEnabled } = input
  const discountPaise = input.discountPaise ?? 0
  const shippingPaise = input.shippingPaise ?? 0

  if (lines.length === 0) throw new TaxError('Cannot tax an order with no items')
  if (discountPaise < 0 || shippingPaise < 0) throw new TaxError('Discount and shipping cannot be negative')

  const subtotalPaise = lines.reduce((a, l) => a + l.linePaise, 0)
  if (discountPaise > subtotalPaise) throw new TaxError('Discount cannot exceed the order subtotal')

  const intraState = normalizeState(sellerState) === normalizeState(shipToState)

  const weights = lines.map((l) => l.linePaise)
  const discountShares = apportion(discountPaise, weights)
  const shippingShares = apportion(shippingPaise, weights)

  const taxedLines: TaxLineResult[] = lines.map((l, i) => {
    const grossPaise = l.linePaise - discountShares[i] + shippingShares[i]
    const { netPaise, taxPaise } = gstEnabled
      ? extractTax(grossPaise, l.gstRateBp)
      : { netPaise: grossPaise, taxPaise: 0 }
    return {
      ...l,
      discountSharePaise: discountShares[i],
      shippingSharePaise: shippingShares[i],
      grossPaise,
      netPaise,
      taxPaise,
    }
  })

  const netPaise = taxedLines.reduce((a, l) => a + l.netPaise, 0)
  const totalTaxPaise = taxedLines.reduce((a, l) => a + l.taxPaise, 0)

  // Half each, and the odd paisa goes to CGST so the two always sum to the total.
  const cgstPaise = intraState ? Math.floor(totalTaxPaise / 2) : 0
  const sgstPaise = intraState ? totalTaxPaise - cgstPaise : 0
  const igstPaise = intraState ? 0 : totalTaxPaise

  return {
    intraState,
    subtotalPaise,
    discountPaise,
    shippingPaise,
    netPaise,
    cgstPaise,
    sgstPaise,
    igstPaise,
    totalTaxPaise,
    totalPaise: subtotalPaise - discountPaise + shippingPaise,
    lines: taxedLines,
  }
}
