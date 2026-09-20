import Link from 'next/link'
import { Container } from './section-heading.tsx'

/**
 * The hero: a headline, then a shelf of real framed photographs beneath it.
 *
 * Two things changed from the Figma staging. The headline sat on top of the frames and
 * collided with them at every width, so it now has its own band above the scene — the
 * design's intent was a poster, and a poster whose title crosses the artwork is a worse
 * poster. And the made-to-measure card is small and glass now rather than a solid panel,
 * so it sits over the photographs without blocking them.
 *
 * The scene stays light in both themes because it stands in for a photograph, so its
 * text is pinned to dark stone rather than the theme-following ink token.
 */

/** Four real frames, each taking its turn to step forward. */
const SHELF = [
  {
    src: '/hero/3.webp',
    caption: 'Family portrait',
    moulding: '#d6d3d1',
    mount: '#f6f2ea',
    className: 'h-[104px] w-[78px] sm:h-[168px] sm:w-[126px]',
    delay: '-12s',
  },
  {
    src: '/hero/1.webp',
    caption: 'Landscape mist',
    moulding: '#c5a059',
    mount: '#fdf8ea',
    className: 'h-[92px] w-[69px] sm:h-[150px] sm:w-[112px]',
    delay: '-8s',
  },
  {
    src: '/hero/2.webp',
    caption: 'Wedding memories',
    moulding: '#6e4f32',
    mount: '#fffdf9',
    className: 'h-[140px] w-[105px] sm:h-[226px] sm:w-[170px]',
    delay: '0s',
  },
  {
    src: '/hero/4.webp',
    caption: 'Postcard',
    moulding: '#b99878',
    mount: '#f6f2ea',
    className: 'h-[104px] w-[78px] sm:h-[178px] sm:w-[134px]',
    delay: '-4s',
  },
]

export function Hero() {
  return (
    <section className="pt-4 sm:pt-6">
      <Container>
        <div className="overflow-hidden rounded-2xl border border-line bg-[#ece7df]">
          {/* The headline owns its own band, clear of the photographs. */}
          <div className="px-6 pb-2 pt-8 text-center sm:pt-10">
            <h1 className="font-serif text-[40px] font-normal leading-[1.02] tracking-[-0.01em] text-stone-900 sm:text-[58px] lg:text-[76px]">
              THE ART <em className="italic">OF</em> <em className="italic">FRAMING</em>
            </h1>
            <p className="mt-3 text-[10px] font-semibold uppercase tracking-[0.22em] text-stone-500 sm:text-[12px] sm:tracking-[0.3em]">
              PRESERVING YOUR PRECIOUS MOMENTS BEAUTIFULLY
            </p>
          </div>

          <div className="relative h-[250px] sm:h-[330px] lg:h-[360px]">
            <div className="absolute inset-0 bg-gradient-to-b from-[#f0e9e1] via-[#e7ded3] to-[#e2d8cd]" />

            {/* A pool of light behind the shelf, so the frames sit in a room. */}
            <div className="absolute inset-x-[10%] bottom-[16%] h-[70%] rounded-[50%] bg-white/40 blur-3xl" />

            <div className="absolute inset-x-[4%] bottom-[16%] flex items-end justify-center gap-3 sm:gap-6 lg:pr-[330px]">
              {SHELF.map((f) => (
                <ShelfFrame key={f.src} {...f} />
              ))}
            </div>

            {/* shelf */}
            <div className="absolute inset-x-[5%] bottom-[14%] h-[12px] rounded-[3px] bg-gradient-to-b from-[#9a734c] to-[#3d2513] shadow-[0_12px_22px_-12px_rgba(61,37,19,0.7)]" />
            <div className="absolute inset-x-[7%] bottom-[11%] h-[10px] rounded-b-[4px] bg-gradient-to-b from-[#2f1c0e]/45 to-transparent blur-[2px]" />

            {/*
             * Glass, and small: it overlaps the photographs rather than replacing a
             * chunk of them. Below lg it drops into flow, because a 390px-wide scene has
             * no room for an overlay that does not cover something worth seeing.
             */}
            <div className="lg:absolute lg:bottom-6 lg:right-6 lg:w-[292px]">
              <div className="glass glass-dim hidden rounded-2xl p-4 lg:block">
                <span className="inline-flex items-center gap-[6px] rounded-md bg-white/30 px-2 py-[3px] text-[10px] font-bold uppercase tracking-wide text-stone-800 ring-1 ring-inset ring-white/50">
                  <img src="/figma/frame.svg" alt="" className="size-[12px]" />
                  Made to measure
                </span>
                <h2 className="mt-2 text-[15px] font-bold leading-5 text-stone-900 drop-shadow-[0_1px_1px_rgba(255,255,255,0.7)]">
                  Not finding your type of frame?
                </h2>
                <p className="mt-[2px] text-[11px] leading-4 text-stone-800 drop-shadow-[0_1px_1px_rgba(255,255,255,0.6)]">
                  Cut and dispatched in five working days
                </p>
                <Link
                  href="/custom"
                  className="mt-3 block rounded-lg bg-accent py-2 text-center text-[13px] font-bold text-stone-900 transition-transform hover:scale-[1.02]"
                >
                  Build a custom frame
                </Link>
              </div>
            </div>
          </div>

          {/* The same offer, in flow, on the widths where the overlay is hidden. */}
          <div className="p-4 lg:hidden">
            <div className="rounded-2xl border border-white/60 bg-white/70 p-4 backdrop-blur-md">
              <h2 className="text-[15px] font-bold text-stone-900">
                Not finding your type of frame?
              </h2>
              <p className="mt-[2px] text-[11px] text-stone-700">
                Made to measure, cut and dispatched in five working days
              </p>
              <Link
                href="/custom"
                className="mt-3 block rounded-lg bg-accent py-2 text-center text-[13px] font-bold text-stone-900"
              >
                Build a custom frame
              </Link>
            </div>
          </div>
        </div>
      </Container>
    </section>
  )
}

function ShelfFrame({
  src,
  caption,
  moulding,
  mount,
  className,
  delay,
}: {
  src: string
  caption: string
  moulding: string
  mount: string
  className: string
  delay: string
}) {
  return (
    <div
      className={`hero-frame flex shrink-0 flex-col border-[5px] p-[4px] shadow-[0_10px_20px_-10px_rgba(28,25,23,0.55)] sm:border-[7px] sm:p-[6px] ${className}`}
      style={{ borderColor: moulding, background: mount, animationDelay: delay }}
    >
      <img
        src={src}
        alt={caption}
        loading="eager"
        decoding="async"
        className="size-full border border-black/10 object-cover"
      />
    </div>
  )
}
