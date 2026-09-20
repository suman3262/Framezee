import Link from 'next/link'
import { BUSINESS, addressLines } from '@/lib/business.ts'

/** Figma 3:10555 — the support strip above the footer. */
export function SupportBar() {
  return (
    <section className="bg-subtle">
      <div className="mx-auto flex max-w-[1280px] flex-col gap-4 px-4 py-6 sm:px-10 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <p className="font-display text-sm font-bold text-ink">We&rsquo;re always here to help</p>
          <p className="mt-[2px] text-xs leading-4 text-body">
            Reach our artisanal framing specialists 7 days a week for bespoke consultations.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Pill href="/help" icon="/figma/support-help.svg" label="Help Centre" />
          <Pill href={BUSINESS.phoneHref} icon="/figma/support-phone.svg" label={BUSINESS.phone} />
          <Pill href={`mailto:${BUSINESS.email}`} icon="/figma/support-mail.svg" label={BUSINESS.email} />
        </div>
      </div>
    </section>
  )
}

function Pill({ href, icon, label }: { href: string; icon: string; label: string }) {
  return (
    <a
      href={href}
      className="flex items-center gap-2 rounded-full bg-surface px-3 py-2 text-xs font-semibold text-ink shadow-[0_1px_1px_rgba(0,0,0,0.05)]"
    >
      <img src={icon} alt="" className="size-[13px] dark:invert" />
      {label}
    </a>
  )
}

const EXPLORE = [
  { label: 'Archival Timber Mouldings', href: '/browse' },
  { label: 'Custom Dimension Framing', href: '/custom' },
  { label: 'Shop by Size', href: '/sizes' },
  { label: 'Track Your Order', href: '/account/orders' },
]

const CARE = [
  { label: 'Help & FAQ', href: '/help' },
  { label: 'Compare Frame Sizes', href: '/help#sizes' },
  { label: 'Shipping & Delivery', href: '/help#faq' },
  { label: '30-Day Return Guarantee', href: '/help#faq' },
  { label: 'Bulk & Corporate Orders', href: '/help#faq' },
]

const SOCIAL = [
  { icon: '/figma/pdp-instagram.svg', label: 'Instagram', href: 'https://instagram.com/framezee' },
  { icon: '/figma/pdp-pinterest.svg', label: 'Pinterest', href: 'https://pinterest.com/framezee' },
  { icon: '/figma/pdp-community.svg', label: 'WhatsApp', href: `https://wa.me/${BUSINESS.phone.replace(/\D/g, '')}` },
  { icon: '/figma/pdp-share.svg', label: 'Email us', href: `mailto:${BUSINESS.email}` },
]

/** Figma 3:10554 */
export function Footer() {
  return (
    <footer className="bg-page">
      <div className="mx-auto flex max-w-[1280px] flex-col gap-10 px-4 py-10 sm:px-10">
        <div className="grid gap-10 md:grid-cols-2 lg:grid-cols-5">
          <div className="flex flex-col gap-2 lg:col-span-2">
            <div className="flex items-center gap-2">
              <span className="font-display text-xl font-semibold tracking-[-0.025em] text-ink">
                {BUSINESS.tradingName}
              </span>
              <span className="rounded-full bg-violet-tint px-2 py-[2px] text-[11px] font-bold tracking-[0.04em] text-violet-ink">
                Studio
              </span>
            </div>
            <p className="max-w-96 text-sm leading-5 text-body">{BUSINESS.tagline}</p>
            <div className="flex flex-col gap-1 pt-1">
              <span className="flex items-center gap-1 text-[13px] font-semibold text-ink">
                <img src="/figma/pdp-pin.svg" alt="" className="size-[13px] dark:invert" />
                Studio &amp; Workshop Address
              </span>
              {addressLines.map((l) => (
                <span key={l} className="text-xs leading-4 text-body">
                  {l}
                </span>
              ))}
            </div>
          </div>

          <FooterNav title="Explore Frames" links={EXPLORE} />
          <FooterNav title="Customer Care" links={CARE} />

          <div className="flex flex-col gap-2">
            <h2 className="font-display text-base font-semibold text-ink">Connect With Us</h2>
            <div className="flex items-center gap-1">
              {SOCIAL.map((s) => (
                <a
                  key={s.label}
                  href={s.href}
                  aria-label={s.label}
                  className="grid size-9 place-items-center rounded-full bg-subtle"
                >
                  <img src={s.icon} alt="" className="size-[15px] dark:invert" />
                </a>
              ))}
            </div>
            <p className="pt-1 text-xs leading-4 text-faint">
              Subscribe to artisanal drops and exclusive seasonal coupon codes.
            </p>
          </div>
        </div>

        <div className="flex flex-col gap-3 border-t border-line pt-6 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs leading-4 text-faint">
            © {BUSINESS.copyrightYear} {BUSINESS.legalName}. All rights reserved.{' '}
            {BUSINESS.address.line2}, {BUSINESS.address.state}.
          </p>
          <div className="flex items-center gap-4">
            {[
              { label: 'Privacy Policy', href: '/privacy' },
              { label: 'Terms of Service', href: '/terms' },
              { label: 'Dispatch Policy', href: '/dispatch' },
            ].map((l) => (
              <Link key={l.href} href={l.href} className="text-xs leading-4 text-faint hover:text-ink">
                {l.label}
              </Link>
            ))}
          </div>
        </div>
      </div>
    </footer>
  )
}

function FooterNav({ title, links }: { title: string; links: { label: string; href: string }[] }) {
  return (
    <nav className="flex flex-col gap-2">
      <h2 className="font-display text-base font-semibold text-ink">{title}</h2>
      <ul className="flex flex-col gap-2">
        {links.map((l) => (
          <li key={l.href}>
            <Link href={l.href} className="text-sm leading-5 text-body hover:text-ink">
              {l.label}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  )
}
