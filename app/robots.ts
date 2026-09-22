import type { MetadataRoute } from 'next'
import { SITE_URL, isProduction } from '@/lib/env.ts'

/**
 * There was no robots.txt, so every crawler hit `/` — the most expensive page — and the
 * logs filled with Googlebot and backlink bots holding functions open for 300 seconds.
 *
 * Preview deployments disallow everything: a staging copy of the shop competing with the
 * real one in search results is worse than not being indexed at all.
 */
export default function robots(): MetadataRoute.Robots {
  if (!isProduction) return { rules: [{ userAgent: '*', disallow: '/' }] }

  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        // Nothing here is useful to a crawler, and some of it is expensive to render.
        disallow: ['/admin', '/framezee/', '/api/', '/checkout', '/cart', '/account', '/wishlist'],
      },
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
  }
}
