/**
 * Fails on internal links that no route serves.  npm run links
 *
 * Written after /art-prints, /sizes/<w>x<h> and /browse/<category> all shipped as dead
 * links. Next's own typedRoutes would catch these, but it also rejects every href built
 * from a query string, and this shop is mostly those.
 *
 * Only literal hrefs are checked. A template literal is checked by the part before the
 * first `${`, which is exactly how /browse/${slug} would have been caught.
 */

import { readFileSync } from 'node:fs'
import { globSync } from 'node:fs'

const routes = new Set(
  globSync('app/**/page.tsx')
    .map((f) =>
      f
        .replace(/^app/, '')
        .replace(/\/page\.tsx$/, '')
        .replace(/\/\([^/]+\)/g, ''), // route groups are not in the URL
    )
    .map((r) => (r === '' ? '/' : r)),
)

/** /frames/[slug] serves /frames/anything. */
const dynamic = [...routes]
  .filter((r) => r.includes('['))
  .map((r) => new RegExp('^' + r.replace(/\[[^\]]+\]/g, '[^/]+') + '$'))

const serves = (path: string) =>
  routes.has(path) || dynamic.some((re) => re.test(path)) || path.startsWith('/api/')

/**
 * Links that are meant to exist and do not yet. Each one is a page the client still owes
 * content for — Razorpay will not approve a merchant account without the first three.
 * Registered as D25. Delete an entry the moment its page ships.
 */
const ALLOWED = new Set(['/privacy', '/terms', '/dispatch'])

const files = globSync('{app,components}/**/*.tsx')
const bad: { file: string; href: string }[] = []

for (const file of files) {
  const src = readFileSync(file, 'utf8')
  // href="/x", href={'/x'}, href={`/x/${y}`}, and href: '/x' in nav arrays
  for (const m of src.matchAll(/href[=:]\s*\{?\s*["'`](\/[^"'`\s]*)["'`]?/g)) {
    const raw = m[1]
    if (raw.startsWith('//')) continue

    // An interpolated segment stands in for a real one, so /frames/${slug} is checked
    // against /frames/[slug] rather than being cut down to a /frames that serves nothing.
    // A nested template such as `${a ? `?${b}` : ''}` leaves debris behind, so cut at
    // the first character that cannot appear in a path.
    const path =
      raw
        .replace(/\$\{[^}]*\}/g, 'x')
        // A nested template cuts the capture short, leaving a dangling `${`.
        .split('${')[0]
        .split(/[\s`'"?#]/)[0]
        .replace(/\/$/, '') || '/'

    if (path === '/' || serves(path) || ALLOWED.has(path)) continue
    bad.push({ file, href: raw })
  }
}

if (bad.length === 0) {
  console.log(`\n  ${files.length} files, every internal link resolves.\n`)
  process.exit(0)
}

console.error(`\n  ${bad.length} dead link${bad.length === 1 ? '' : 's'}:\n`)
for (const b of bad) console.error(`    ${b.href.padEnd(34)} ${b.file}`)
console.error('')
process.exit(1)
