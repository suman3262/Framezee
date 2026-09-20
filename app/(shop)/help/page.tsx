import Link from 'next/link'
import { eq } from 'drizzle-orm'
import { db } from '@/db/index.ts'
import { settings, sizes } from '@/db/schema.ts'
import { Container } from '@/components/home/section-heading.tsx'
import { SizeChart, type ChartSize } from '@/components/help/size-chart.tsx'
import { loadCatalog, cheapestForSize } from '@/lib/storefront.ts'
import { BUSINESS } from '@/lib/business.ts'
import { fmtInr } from '@/lib/pricing.ts'

export const metadata = {
  title: 'Help centre — Framezee',
  description: 'Sizing, delivery, returns — everything you need to know.',
}

const TOPICS = [
  { title: 'Sizing guide', body: 'How to measure your artwork and pick the right frame proportion and mat margin.', href: '#sizes' },
  { title: 'Delivery', body: 'Dispatch times, courier tracking, and free-delivery thresholds.', href: '#faq' },
  { title: 'Returns', body: '30-day returns, how to start one, and refund timing.', href: '#faq' },
]

export default async function HelpCentre() {
  const { sizeList, finishById } = await loadCatalog()
  const [config] = await db.select().from(settings).limit(1)
  const finishes = [...finishById.values()]

  const chart: ChartSize[] = sizeList.map((s) => ({
    widthTenths: s.widthTenths,
    heightTenths: s.heightTenths,
    fromPaise: cheapestForSize(finishes, s.widthTenths, s.heightTenths),
    popular: s.widthTenths === 120 && s.heightTenths === 80,
  }))

  const free = config?.freeShippingThresholdPaise
  const flat = config?.flatShippingPaise ?? 0

  const FAQ = [
    {
      q: 'How long does a custom frame take to arrive?',
      a: `Every custom frame is precision-cut by hand in our ${BUSINESS.address.line2} workshop within 48 hours of order confirmation. Standard delivery across India takes 4–6 business days; metro areas are usually quicker.`,
    },
    {
      q: 'Can I change the mat after I have ordered?',
      a: 'Tell us within 24 hours of ordering and we can usually still change it, because the moulding is cut before the mat is mounted. After that the mat is already cut to size.',
    },
    {
      q: "What's your returns policy?",
      a: '30 days from delivery. Frames arrive flat-packed and insured; if anything is damaged in transit, send us a photo and we remake it at no cost.',
    },
    {
      q: 'Do you deliver all over India?',
      a: `Yes, pan-India. Delivery is ${flat === 0 ? 'free' : `a flat ${fmtInr(flat)}`}${free ? `, and free on orders over ${fmtInr(free)}` : ''}. The threshold is measured after any coupon.`,
    },
    {
      q: 'How do I use a coupon code?',
      a: 'Enter it in your basket, under the order summary. The discount is recalculated every time the basket loads, so a code that expires stops applying on its own.',
    },
    {
      q: 'Do you take bulk or corporate orders?',
      a: `Yes. Anything over about 20 frames is quoted directly rather than through the basket, because the rate improves with volume and the sizes are usually identical. Call ${BUSINESS.phone} or email ${BUSINESS.email} with the sizes, finish and quantity.`,
    },
    {
      q: 'What mat board and glazing do you use?',
      a: 'Acid-free mat board throughout. Glazing is 3 mm styrene as standard — lightweight and shatter-resistant for transit — with UV acrylic available as an upgrade in the Custom Studio.',
    },
  ]

  return (
    <Container className="py-6">
      <nav className="flex items-center gap-2 text-xs text-body">
        <Link href="/" className="hover:text-ink">Home</Link>
        <span className="text-faint">/</span>
        <span className="text-ink">Help centre</span>
      </nav>

      <h1 className="mt-3 font-display text-2xl font-bold tracking-[-0.02em] text-ink sm:text-3xl">
        Help centre
      </h1>
      <p className="mt-1 max-w-2xl text-sm text-body">
        Sizing, delivery, returns — everything you need to know, plus a few ways to reach us
        if you can&rsquo;t find it here.
      </p>

      <div className="mt-6 grid gap-3 md:grid-cols-3">
        {TOPICS.map((t) => (
          <a
            key={t.title}
            href={t.href}
            className="rounded-2xl bg-surface p-5 shadow-[0_1px_1px_rgba(0,0,0,0.05)] hover:shadow-md"
          >
            <span className="grid size-8 place-items-center rounded-full bg-subtle text-body">?</span>
            <h2 className="mt-3 text-sm font-bold text-ink">{t.title}</h2>
            <p className="mt-1 text-xs leading-4 text-body">{t.body}</p>
          </a>
        ))}
      </div>

      <section id="sizes" className="mt-8 scroll-mt-24">
        <h2 className="font-display text-xl font-bold text-ink">Compare frame sizes</h2>
        <p className="mt-1 text-sm text-body">
          Horizontal, vertical and square frames, all drawn to scale with exact measurements.
        </p>
        <div className="mt-4">
          <SizeChart sizes={chart} />
        </div>
      </section>

      <section id="faq" className="mt-8 scroll-mt-24">
        <h2 className="font-display text-xl font-bold text-ink">Frequently asked questions</h2>
        <p className="mt-1 text-sm text-body">
          Quick clarity on materials, fulfilment timelines, and ordering policies.
        </p>

        <div className="mt-4 flex flex-col gap-2">
          {FAQ.map((f) => (
            <details
              key={f.q}
              className="group rounded-2xl bg-surface p-5 shadow-[0_1px_1px_rgba(0,0,0,0.05)]"
            >
              <summary className="cursor-pointer list-none text-sm font-bold text-ink marker:content-['']">
                <span className="flex items-center justify-between gap-3">
                  {f.q}
                  <span className="shrink-0 text-faint transition-transform group-open:rotate-180">⌄</span>
                </span>
              </summary>
              <p className="mt-3 text-[13px] leading-5 text-body">{f.a}</p>
            </details>
          ))}
        </div>
      </section>

      <section className="mt-8 rounded-2xl bg-violet-tint/40 p-5">
        <h2 className="text-sm font-bold text-ink">Still need a hand?</h2>
        <p className="mt-1 text-xs text-body">
          Our framing team typically replies within a few hours.
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          <a
            href={BUSINESS.phoneHref}
            className="rounded-full bg-surface px-4 py-2 text-xs font-semibold text-ink shadow-[0_1px_1px_rgba(0,0,0,0.05)]"
          >
            {BUSINESS.phone}
          </a>
          <a
            href={`mailto:${BUSINESS.email}`}
            className="rounded-full bg-surface px-4 py-2 text-xs font-semibold text-ink shadow-[0_1px_1px_rgba(0,0,0,0.05)]"
          >
            {BUSINESS.email}
          </a>
          <a
            href={`https://wa.me/${BUSINESS.phone.replace(/\D/g, '')}`}
            className="rounded-full bg-emerald-600 px-4 py-2 text-xs font-bold text-white"
          >
            WhatsApp us
          </a>
        </div>
      </section>
    </Container>
  )
}
