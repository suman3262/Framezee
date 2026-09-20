/**
 * What fills the frame on a card, the product page and the wall preview.
 *
 * `products.artwork_image` holds whatever the admin typed: an image URL, an uploaded
 * path, or a CSS background such as a gradient. Both end up as a CSS background value,
 * so one column covers "we have a photo" and "we do not yet".
 *
 * The gradients below are the launch placeholders for the six seeded frames. They stay
 * until there is real photography — a product added from the admin uses its own value
 * and never falls back to them.
 */

const GRADIENTS: Record<string, string> = {
  'natural-oak-001': 'linear-gradient(160deg,#f97316,#fb7185 55%,#38bdf8)',
  'matte-black-ash-002': 'linear-gradient(170deg,#1f2937,#4b5563 60%,#111827)',
  'white-maple-003': 'linear-gradient(180deg,#0f3d3e,#134e4a 60%,#0b2b2c)',
  'dark-walnut-004': 'linear-gradient(170deg,#fbbf24,#f59e0b 60%,#b45309)',
  'brushed-aluminium-005': 'linear-gradient(180deg,#0b1026,#1e1b4b)',
  'poplar-blush-006': 'linear-gradient(175deg,#14532d,#4d7c0f)',
}

const FALLBACK = 'linear-gradient(160deg,#a8a29e,#57534e)'

/**
 * The seed wrote `/mock/art/<slug>.jpg` for every frame and no such file was ever added.
 * Treating those as real would render six broken images, so they are ignored here rather
 * than migrated away — the column is about to hold real values anyway.
 */
const isDeadMockPath = (v: string) => v.startsWith('/mock/')

const isImage = (v: string) =>
  v.startsWith('http://') || v.startsWith('https://') || v.startsWith('/') || v.startsWith('data:')

/**
 * Turns a stored value into a CSS `background` SHORTHAND.
 *
 * It must be assigned to `background`, never `backgroundImage` — an image needs its
 * position and sizing, and backgroundImage drops a shorthand silently, leaving a blank
 * frame with no error anywhere.
 */
export function toBackground(stored: string): string {
  const v = stored.trim()
  return isImage(v) ? `center / cover no-repeat url("${v}")` : v
}

export function artworkFor(slug: string, stored?: string | null): string {
  const v = stored?.trim()
  if (v && !isDeadMockPath(v)) return toBackground(v)
  return GRADIENTS[slug] ?? FALLBACK
}
