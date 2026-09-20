import Link from 'next/link'
import { Container } from './section-heading.tsx'
import { Logo } from '@/components/site/logo.tsx'

/**
 * Figma 2:292 — one wide brand card beside two stacked collection cards.
 *
 * The brand card carries a photograph now rather than a coded gradient. It has white
 * text over it, so the scrim is not decoration: without it the wordmark disappears into
 * the sky whenever the photograph is replaced with a brighter one.
 *
 * The two collection cards are glass, matching the hero. Glass needs something behind it
 * to be glass, so the column they sit in has its own soft colour field — over the flat
 * page background they would read as plain white panels, which is what happened the
 * first time this was tried in the hero.
 */
export function PromoBanners() {
  return (
    <section className="py-8">
      <Container>
        <div className="grid gap-4 lg:grid-cols-2">
          <div className="relative flex min-h-[260px] flex-col justify-between overflow-hidden rounded-2xl bg-[#111a35] p-6 lg:min-h-[403px]">
            <img
              src="/hero/section-1.webp"
              alt=""
              aria-hidden
              loading="lazy"
              decoding="async"
              className="absolute inset-0 size-full object-cover"
            />
            {/* Dark at the foot, clear at the head — the text lives at the bottom. */}
            <div
              aria-hidden
              className="absolute inset-0 bg-gradient-to-t from-[#0b1026] via-[#0b1026]/55 to-[#0b1026]/15"
            />

            <div className="relative [&_span]:text-white [&_span]:drop-shadow-[0_1px_4px_rgba(0,0,0,0.5)]">
              <Logo size={32} />
            </div>
            <div className="relative">
              <p className="font-serif text-3xl leading-tight text-white drop-shadow-[0_2px_8px_rgba(0,0,0,0.45)] lg:text-[38px]">
                Every memory
                <br />
                deserves a frame.
              </p>
              <p className="mt-4 text-[11px] tracking-[0.2em] text-white/70">www.framezee.com</p>
            </div>
          </div>

          {/* The colour field the glass cards sit on. */}
          <div className="relative grid gap-4 overflow-hidden rounded-2xl p-4">
            <div
              aria-hidden
              className="absolute inset-0 bg-gradient-to-br from-violet-tint via-page to-accent/45"
            />
            <div aria-hidden className="absolute -left-12 top-4 size-56 rounded-full bg-violet/45 blur-3xl" />
            <div aria-hidden className="absolute -bottom-10 right-2 size-64 rounded-full bg-accent/55 blur-3xl" />

            <CollectionCard
              eyebrow="Museum-grade board"
              title="Discover our mat board collection"
              href="/custom"
              cta="Choose a mat"
              art={
                <div className="grid w-[120px] shrink-0 gap-1">
                  <div className="rounded-[3px] border-[5px] border-stone-800 bg-stone-100 p-[6px] shadow-md">
                    <div className="aspect-[4/5] rounded-[2px] bg-gradient-to-b from-[#ef4444] to-[#f59e0b]" />
                  </div>
                  <p className="text-center text-[9px] text-faint">Acid-free · 30 mm bevel</p>
                </div>
              }
            />

            <CollectionCard
              eyebrow="Six frames, one wall"
              title="Explore our gallery wall sets"
              href="/browse"
              cta="Explore all"
              art={
                <div className="w-[128px] shrink-0 overflow-hidden [mask-image:linear-gradient(90deg,transparent,#000_18%,#000_82%,transparent)]">
                  <div className="wall-track flex items-end gap-[6px]">
                    {/* Twice, so the loop has somewhere seamless to restart. */}
                    {[0, 1].map((copy) => (
                      <div key={copy} className="flex items-end gap-[6px] pr-[6px]">
                        <span className="block h-16 w-11 shrink-0 rounded-[2px] border-[4px] border-stone-800 bg-stone-100 shadow-sm" />
                        <span className="block h-[72px] w-10 shrink-0 rounded-[2px] border-[4px] border-[#c5a059] bg-[#fdf3c4] shadow-sm" />
                        <span className="block h-14 w-10 shrink-0 rounded-[2px] border-[4px] border-[#6e4f32] bg-stone-100 shadow-sm" />
                        <span className="block h-[68px] w-11 shrink-0 rounded-[2px] border-[4px] border-[#9a734c] bg-stone-50 shadow-sm" />
                      </div>
                    ))}
                  </div>
                </div>
              }
            />
          </div>
        </div>
      </Container>
    </section>
  )
}

function CollectionCard({
  eyebrow,
  title,
  href,
  cta,
  art,
}: {
  eyebrow: string
  title: string
  href: string
  cta: string
  art: React.ReactNode
}) {
  return (
    <div className="glass glass-dim relative flex items-center gap-4 rounded-2xl p-5">
      {art}
      <div>
        <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-body">{eyebrow}</p>
        <h3 className="mt-1 text-base font-bold leading-5 text-ink">{title}</h3>
        <Link
          href={href}
          className="mt-3 inline-block rounded-lg bg-violet-deep px-3 py-[6px] text-xs font-bold text-white transition-transform hover:scale-[1.03]"
        >
          {cta}
        </Link>
      </div>
    </div>
  )
}
