/**
 * Prints what the mock rate cards actually charge, so the numbers can be eyeballed
 * before any UI exists.  Run:  npm run prices
 */

import { priceLine, fmtInr, fmtIn, PriceError } from '../lib/pricing.ts'
import { calcTax } from '../lib/tax.ts'
import { applyCoupon } from '../lib/coupons.ts'
import {
  materials,
  materialRates,
  materialLimits,
  paperQualities,
  paperRates,
  sizes,
  settings,
  coupons,
} from '../db/seed-data.ts'

const mat = (key: string) => {
  const m = materials.find((x) => x.key === key)!
  return { name: m.name, limits: materialLimits[key], bands: materialRates[key] }
}

const pad = (s: string, n: number) => s.padEnd(n)
const rpad = (s: string, n: number) => s.padStart(n)

console.log('\n\x1b[1mSHOP BY SIZE — final price per material (GST included)\x1b[0m\n')

const header = pad('Size', 12) + materials.map((m) => rpad(m.name.split(' ')[0], 12)).join('')
console.log('\x1b[2m' + header + '\x1b[0m')

for (const s of sizes) {
  const label = `${fmtIn(s.widthTenths)} x ${fmtIn(s.heightTenths)}`
  const cells = materials.map((m) => {
    try {
      const p = priceLine({ widthTenths: s.widthTenths, heightTenths: s.heightTenths, qty: 1, material: mat(m.key) })
      return rpad(fmtInr(p.unitPaise).replace('.00', ''), 12)
    } catch (e) {
      if (e instanceof PriceError) return rpad('—', 12)
      throw e
    }
  })
  console.log(pad(label, 12) + cells.join(''))
}

console.log('\n\x1b[1mPRINT SERVICE — added on top, same area\x1b[0m\n')
for (const p of paperQualities) {
  const row = sizes
    .filter((s) => [70, 120, 200].includes(s.widthTenths))
    .map((s) => {
      const q = priceLine({
        widthTenths: s.widthTenths,
        heightTenths: s.heightTenths,
        qty: 1,
        material: mat('pine-wood'),
        paper: { name: p.name, bands: paperRates[p.key] },
      })
      return `${fmtIn(s.widthTenths)}x${fmtIn(s.heightTenths)} +${fmtInr(q.printPaise).replace('.00', '')}`
    })
    .join('   ')
  console.log(pad(p.name, 26) + '\x1b[2m' + row + '\x1b[0m')
}

console.log('\n\x1b[1mSAMPLE ORDER\x1b[0m\n')

const teak = priceLine({ widthTenths: 400, heightTenths: 600, qty: 1, material: mat('teak-wood') })
const gift = priceLine({
  widthTenths: 80,
  heightTenths: 60,
  qty: 2,
  material: mat('aluminium'),
  paper: { name: 'Premium Lustre 250gsm', bands: paperRates['premium-lustre'] },
})

console.log(`  Teak Wood 40 x 60 in                 ${rpad(fmtInr(teak.linePaise), 12)}`)
console.log(`  Aluminium 8 x 6 in + print  x2       ${rpad(fmtInr(gift.linePaise), 12)}`)

for (const state of ['West Bengal', 'Maharashtra']) {
  for (const gstEnabled of [false, true]) {
    const subtotal = teak.linePaise + gift.linePaise
    const coupon = applyCoupon(
      coupons.find((c) => c.code === 'FRAME10'),
      { subtotalPaise: subtotal, customerOrderCount: 2 },
    )
    const t = calcTax({
      lines: [
        { linePaise: teak.linePaise, gstRateBp: 1200 },
        { linePaise: gift.linePaise, gstRateBp: 1800 },
      ],
      discountPaise: coupon.ok ? coupon.discountPaise : 0,
      shippingPaise: subtotal >= settings.freeShippingThresholdPaise! ? 0 : settings.flatShippingPaise,
      sellerState: settings.sellerState,
      shipToState: state,
      gstEnabled,
    })
    console.log(
      `\n  \x1b[2mship to ${state}, GST ${gstEnabled ? 'on' : 'off'}\x1b[0m` +
        `\n    subtotal ${fmtInr(t.subtotalPaise)}   FRAME10 -${fmtInr(t.discountPaise)}` +
        (coupon.ok && coupon.cappedAtMax ? ' \x1b[2m(capped)\x1b[0m' : '') +
        `   shipping ${fmtInr(t.shippingPaise)}` +
        (gstEnabled
          ? `\n    taxable value ${fmtInr(t.netPaise)}` +
            (t.intraState
              ? `   CGST ${fmtInr(t.cgstPaise)} + SGST ${fmtInr(t.sgstPaise)}`
              : `   IGST ${fmtInr(t.igstPaise)}`) +
            '   \x1b[2m(inside the price, not added)\x1b[0m'
          : '\n    no GST shown') +
        `\n    \x1b[1mtotal ${fmtInr(t.totalPaise)}\x1b[0m`,
    )
  }
}
console.log()
