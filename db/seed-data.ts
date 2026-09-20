/**
 * Mock data for development. Replace with real numbers before launch — every
 * value here is a placeholder chosen to look plausible, not a business decision.
 *
 * The rate curve is reverse-engineered from the "Shop by Size" prices in the Figma
 * mockup, so the dev site looks like the design. Small frames cost more per square
 * inch because cutting waste and labour do not scale down.
 *
 * !! GST RATES AND HSN CODES BELOW ARE UNVERIFIED — confirm with your CA. !!
 */

import type { Band } from '../lib/pricing.ts'

/** inches -> tenths */
const IN = (n: number) => Math.round(n * 10)
/** rupees -> paise */
const RS = (n: number) => Math.round(n * 100)

/** Base rate curve, modelled on Pine. Other materials scale off this. */
const BASE_CURVE: Array<[maxSideIn: number, ratePerSqIn: number]> = [
  [6, 6.9],
  [10, 4.4],
  [13, 3.6],
  [16, 3.0],
  [22, 2.4],
  [60, 2.1],
]

const curve = (rows: typeof BASE_CURVE, multiplier = 1): Band[] =>
  rows.map(([maxSide, rate]) => ({
    maxWidthTenths: IN(maxSide),
    maxHeightTenths: IN(maxSide),
    ratePaisePerSqIn: RS(rate * multiplier),
  }))

// ── materials ───────────────────────────────────────────────────────────────

export type SeedMaterial = {
  key: string
  name: string
  kind: string
  description: string
  gstRateBp: number
  hsnCode: string
  swatch: string
  minIn: number
  maxIn: number
  multiplier: number
}

const WOOD = { gstRateBp: 1200, hsnCode: '4414' } // unverified
const METAL = { gstRateBp: 1800, hsnCode: '8306' } // unverified

export const materials: SeedMaterial[] = [
  {
    key: 'ash',
    name: 'Matte Black Ash',
    kind: 'wood',
    swatch: '#202020',
    description: 'Close-grained ash in a matte black lacquer. Disappears into the art.',
    ...WOOD,
    minIn: 4,
    maxIn: 48,
    multiplier: 0.85,
  },
  {
    key: 'maple',
    name: 'White Maple',
    kind: 'wood',
    swatch: '#e8e4dc',
    description: 'White maple moulding, 15 mm face, with a 9 mm rebate.',
    ...WOOD,
    minIn: 4,
    maxIn: 48,
    multiplier: 1,
  },
  {
    key: 'golden',
    name: 'Natural Oak',
    kind: 'wood',
    swatch: '#d7a152',
    description: 'Honey-toned oak with an open grain and a soft wax finish.',
    ...WOOD,
    minIn: 4,
    maxIn: 60,
    multiplier: 1.2,
  },
  {
    key: 'poplar',
    name: 'Poplar Blush',
    kind: 'wood',
    swatch: '#b8523c',
    description: 'Poplar stained a warm terracotta. Lighter than it looks.',
    ...WOOD,
    minIn: 4,
    maxIn: 36,
    multiplier: 1.35,
  },
  {
    key: 'aluminium',
    name: 'Brushed Aluminium',
    kind: 'metal',
    swatch: '#c0c0c0',
    description: 'Slim brushed profile. Modern, and light enough for very large sizes.',
    ...METAL,
    minIn: 4,
    maxIn: 60,
    multiplier: 1.5,
  },
  {
    key: 'walnut',
    name: 'Dark Walnut',
    kind: 'wood',
    swatch: '#5c4033',
    description: 'Indian walnut, deep grain, heavier profile. Our flagship moulding.',
    ...WOOD,
    minIn: 5,
    maxIn: 60,
    multiplier: 1.75,
  },
]

export const materialRates: Record<string, Band[]> = Object.fromEntries(
  materials.map((m) => [m.key, curve(BASE_CURVE, m.multiplier)]),
)

export const materialLimits = Object.fromEntries(
  materials.map((m) => [
    m.key,
    {
      minWidthTenths: IN(m.minIn),
      maxWidthTenths: IN(m.maxIn),
      minHeightTenths: IN(m.minIn),
      maxHeightTenths: IN(m.maxIn),
    },
  ]),
)

// ── print service ───────────────────────────────────────────────────────────

const PAPER_CURVE: Array<[number, number]> = [
  [10, 1.8],
  [20, 1.4],
  [60, 1.2],
]

export const paperQualities = [
  {
    key: 'standard-matte',
    name: 'Standard Matte 200gsm',
    description: 'Everyday matte print. No glare.',
    gstRateBp: 1200,
    hsnCode: '4911', // unverified
    multiplier: 1,
  },
  {
    key: 'premium-lustre',
    name: 'Premium Lustre 250gsm',
    description: 'Richer blacks, slight sheen. Best for portraits.',
    gstRateBp: 1200,
    hsnCode: '4911',
    multiplier: 1.65,
  },
  {
    key: 'museum-archival',
    name: 'Museum Archival 310gsm',
    description: 'Cotton rag, fade-resistant for decades.',
    gstRateBp: 1200,
    hsnCode: '4911',
    multiplier: 2.9,
  },
]

export const paperRates: Record<string, Band[]> = Object.fromEntries(
  paperQualities.map((p) => [p.key, curve(PAPER_CURVE, p.multiplier)]),
)

// ── glazing (Custom Studio step 05) ─────────────────────────────────────────

/**
 * The standard styrene is included in the frame price and carries no rate.
 * The upgrade is Rs 6.05/sq-in, which reproduces the design's "+Rs 1,162" on 192 sq in.
 */
export const glazingOptions = [
  {
    key: 'styrene-3mm',
    name: '3 mm styrene',
    description: 'Lightweight, clarity treated, safe shipping',
    included: true,
    gstRateBp: 1200,
    hsnCode: '3920', // unverified
    ratePaisePerSqIn: 0,
  },
  {
    key: 'uv-acrylic',
    name: 'UV acrylic, 99% filtration',
    description: 'Archival gallery grade, anti-fade barrier',
    included: false,
    gstRateBp: 1200,
    hsnCode: '3920',
    ratePaisePerSqIn: 605,
  },
]

/** Wall colours offered when the customer has no room photo (Figma 3:1230). */
export const wallPresets = [
  { key: 'classic-navy', name: 'Classic Navy', hex: '#2c3550' },
  { key: 'warm-clay', name: 'Warm Clay', hex: '#d8bfae' },
  { key: 'studio-grey', name: 'Studio Grey', hex: '#8f8f8f' },
  { key: 'slate', name: 'Slate', hex: '#5a6672' },
  { key: 'midnight', name: 'Midnight', hex: '#1b2540' },
]

export const matColours = [
  { key: 'white', name: 'Crisp White', hex: '#fbf9f5' },
  { key: 'black', name: 'Deep Black', hex: '#1c1c19' },
]

// ── catalog ─────────────────────────────────────────────────────────────────

/** Icons are the emoji used on the category pills in the design. */
export const categories = [
  { slug: 'anime', name: 'Anime', icon: '✦' },
  { slug: 'nature', name: 'Nature', icon: '⛰' },
  { slug: 'space', name: 'Space', icon: '👁' },
  { slug: 'car', name: 'Car', icon: '🚗' },
  { slug: 'bike', name: 'Bike', icon: '🏍' },
  { slug: 'city', name: 'City', icon: '🏛' },
  { slug: 'abstract', name: 'Abstract', icon: '🎨' },
  { slug: 'botanical', name: 'Botanical', icon: '🌿' },
].map((c, i) => ({ ...c, sortOrder: i, active: true }))

/** The "Shop by Size" grid, straight from the mockup. */
export const sizes = [
  // landscape
  [7, 5],
  [8, 6],
  [12, 8],
  [14, 10],
  [18, 12],
  [20, 14],
  // portrait
  [5, 7],
  [6, 8],
  [8, 12],
  [10, 14],
  [12, 18],
  [14, 20],
  // square
  [4, 4],
  [6, 6],
  [8, 8],
  [12, 12],
  [16, 16],
  [20, 20],
].map(([w, h], i) => ({ widthTenths: IN(w), heightTenths: IN(h), sortOrder: i, active: true }))

/**
 * The catalogue is frames, named by moulding and number — the PDP design's own
 * products. "White Maple 003" is the one the design was drawn against, so its copy,
 * specs and rating come straight from Figma.
 */
export const products = [
  {
    slug: 'natural-oak-001',
    number: '001',
    title: 'Natural Oak 001',
    category: 'nature',
    finish: 'golden',
    isNew: false,
    description:
      'Honey-toned oak moulding, 15 mm face, with a 9 mm rebate. Glazed in 3 mm styrene, acid-free backing, sprung clips, two hooks and a paper hanging template in the box.',
    specs: [
      ['Moulding', 'Natural oak, 15 mm'],
      ['Material', 'Waxed hardwood'],
      ['Glazing', '3 mm styrene, 97% clarity'],
      ['Hanging', 'Two hooks and a paper template'],
    ],
  },
  {
    slug: 'matte-black-ash-002',
    number: '002',
    title: 'Matte Black Ash 002',
    category: 'abstract',
    finish: 'ash',
    isNew: false,
    description:
      'Close-grained ash in a matte black lacquer, 15 mm face. Glazed in 3 mm styrene, acid-free backing, sprung clips, two hooks and a paper hanging template in the box.',
    specs: [
      ['Moulding', 'Black ash, 15 mm'],
      ['Material', 'Lacquered hardwood'],
      ['Glazing', '3 mm styrene, 97% clarity'],
      ['Hanging', 'Two hooks and a paper template'],
    ],
  },
  {
    slug: 'white-maple-003',
    number: '003',
    title: 'White Maple 003',
    category: 'nature',
    finish: 'maple',
    isNew: true,
    description:
      'White maple moulding, 15 mm face, with a 9 mm rebate. Glazed in 3 mm styrene, acid-free backing, sprung clips, two hooks and a paper hanging template in the box.',
    specs: [
      ['Moulding', 'White maple, 15 mm'],
      ['Material', 'Painted'],
      ['Glazing', '3 mm styrene, 97% clarity'],
      ['Hanging', 'Two hooks and a paper template'],
    ],
  },
  {
    slug: 'dark-walnut-004',
    number: '004',
    title: 'Dark Walnut 004',
    category: 'city',
    finish: 'walnut',
    isNew: false,
    description:
      'Indian walnut moulding with a deep grain and a heavier 18 mm face. Glazed in 3 mm styrene, acid-free backing, sprung clips, two hooks and a paper hanging template in the box.',
    specs: [
      ['Moulding', 'Dark walnut, 18 mm'],
      ['Material', 'Hand-sanded solid timber'],
      ['Glazing', '3 mm styrene, 97% clarity'],
      ['Hanging', 'Dual wall brackets & level guide'],
    ],
  },
  {
    slug: 'brushed-aluminium-005',
    number: '005',
    title: 'Brushed Aluminium 005',
    category: 'space',
    finish: 'aluminium',
    isNew: false,
    description:
      'A slim brushed aluminium profile, 12 mm face. Light enough for gallery-large sizes. Glazed in 3 mm styrene with acid-free backing and a level guide in the box.',
    specs: [
      ['Moulding', 'Brushed aluminium, 12 mm'],
      ['Material', 'Anodised aluminium'],
      ['Glazing', '3 mm styrene, 97% clarity'],
      ['Hanging', 'Dual wall brackets & level guide'],
    ],
  },
  {
    slug: 'poplar-blush-006',
    number: '006',
    title: 'Poplar Blush 006',
    category: 'botanical',
    finish: 'poplar',
    isNew: true,
    description:
      'Poplar stained a warm terracotta, 15 mm face. Glazed in 3 mm styrene, acid-free backing, sprung clips, two hooks and a paper hanging template in the box.',
    specs: [
      ['Moulding', 'Stained poplar, 15 mm'],
      ['Material', 'Stained softwood'],
      ['Glazing', '3 mm styrene, 97% clarity'],
      ['Hanging', 'Two hooks and a paper template'],
    ],
  },
].map((p) => ({ ...p, artworkImage: `/mock/art/${p.slug}.jpg`, active: true }))

/**
 * Written reviews from the design, plus rating-only rows so the histogram matches the
 * 219 ratings it shows. Every aggregate on the page is computed from these rows.
 */
export const writtenReviews = [
  {
    product: 'white-maple-003',
    authorName: 'Om Trivedi',
    rating: 4,
    title: 'Decent, but mat could be thicker',
    body: 'Frame itself is nicely made, but I expected the mat board to feel a bit sturdier for the price. Still looks good on the wall though.',
    daysAgo: 92,
  },
  {
    product: 'white-maple-003',
    authorName: 'Parth Krishnamurthy',
    rating: 5,
    title: 'Great finish and precision joinery',
    body: 'Arrived in sturdy flat-packed with zero scratches. The white maple moulding adds such a crisp modern touch to our living room gallery wall.',
    daysAgo: 90,
  },
  {
    product: 'white-maple-003',
    authorName: 'Ritu Nambiar',
    rating: 3,
    title: 'Good packaging, minor scuff on arrival',
    body: 'One corner had a small scuff from shipping but otherwise the frame itself is well made and glass clarity is top-notch.',
    daysAgo: 4,
  },
]

/** 5★ 43%, 4★ 29%, 3★ 21%, 2★ 7%, 1★ 0% of 219 — the distribution drawn in Figma. */
export const ratingHistogram: Record<number, number> = { 5: 94, 4: 64, 3: 46, 2: 15, 1: 0 }

// ── coupons (the two in the mockup's top bar, plus a welcome offer) ──────────

export const coupons = [
  {
    code: 'FRAME5', // the code shown in the storefront ticker
    type: 'percent' as const,
    value: 500, // 5%
    minOrderPaise: RS(200),
    maxDiscountPaise: null,
    newCustomersOnly: false,
    usageLimit: null,
    active: true,
  },
  {
    code: 'FRAME10',
    type: 'percent' as const,
    value: 1000, // 10%
    minOrderPaise: RS(500),
    maxDiscountPaise: RS(750),
    newCustomersOnly: false,
    usageLimit: null,
    active: true,
  },
  {
    code: 'NEW15',
    type: 'percent' as const,
    value: 1500, // 15%
    minOrderPaise: RS(0),
    maxDiscountPaise: RS(500),
    newCustomersOnly: true,
    usageLimit: null,
    active: true,
  },
]

// ── config ──────────────────────────────────────────────────────────────────

export const settings = {
  id: 1,
  // Placeholder until registration comes through — 19 is the West Bengal state code.
  // Must be replaced with the real GSTIN before launch (see Sprint 11).
  sellerGstin: '19AAAAA0000A1Z5',
  sellerState: 'West Bengal',
  flatShippingPaise: RS(79),
  freeShippingThresholdPaise: RS(1499),
  codEnabled: false, // after the Razorpay trial period
  gstEnabled: false, // flip on the day the GSTIN lands
}

export const staff = [
  { name: 'Suman Dutta', role: 'super_admin' as const, email: 'securethread@gmail.com' },
  { name: 'Hub Operator', role: 'admin' as const, email: 'ops@framezee.example' },
]
