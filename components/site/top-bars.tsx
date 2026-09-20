/** Figma 3:10657 — the violet offer strip above the header. */

const GUARANTEES = [
  { icon: '/figma/pdp-ship.svg', label: 'Flat-packed Shipping' },
  { icon: '/figma/pdp-returns.svg', label: '30-Day Returns' },
  { icon: '/figma/pdp-secure.svg', label: 'Secure Checkout' },
]

/** Codes match db/seed-data.ts — the strip is the storefront face of those coupons. */
const OFFERS = [
  { code: 'FRAME10', text: '10% off orders above ₹500' },
  { code: 'FRAME5', text: '5% off orders above ₹200' },
]

export function TopBars() {
  return (
    <div className="bg-violet px-4 py-1 sm:px-10">
      <div className="mx-auto flex max-w-[1280px] items-center justify-between gap-4">
        <div className="flex min-w-0 items-center gap-2 overflow-hidden">
          {OFFERS.map((o, i) => (
            <div key={o.code} className="flex shrink-0 items-center gap-2">
              {i > 0 && <span className="px-1 text-base leading-6 text-[#e4daff]">•</span>}
              <span className="rounded-full bg-accent px-2 py-[2px] text-[11px] font-bold uppercase leading-[14px] tracking-[0.05em] text-accent-ink">
                {o.code}
              </span>
              <span className="whitespace-nowrap text-xs leading-4 text-white">{o.text}</span>
            </div>
          ))}
        </div>

        <div className="hidden items-center gap-6 lg:flex">
          {GUARANTEES.map((g) => (
            <span key={g.label} className="flex items-center gap-1">
              <img src={g.icon} alt="" className="size-[13px]" />
              <span className="whitespace-nowrap text-xs leading-4 text-white">{g.label}</span>
            </span>
          ))}
        </div>
      </div>
    </div>
  )
}
