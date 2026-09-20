import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  /*
   * typedRoutes stays off. It does catch dead links, but it also rejects every href
   * built from a query string — filters, sorting, pagination — and this shop is full of
   * them. Eighteen call sites would need casts that suppress the very check being added.
   *
   * `npm run links` does the useful half instead: it walks every literal href in the
   * source and fails on any that no route serves. Query-string hrefs are checked by
   * their path, which is what actually went wrong three times.
   */

  experimental: {
    /*
     * Product artwork is posted through a server action, and Next caps action bodies at
     * 1 MB by default. lib/catalogue-upload.ts allows a 5 MB image, so anything between
     * the two failed with an opaque 500 and a digest.
     *
     * 6 MB leaves room for the multipart overhead around a 5 MB file. Raise both numbers
     * together, or move the upload to a signed URL straight from the browser if images
     * ever need to be bigger than this.
     */
    serverActions: { bodySizeLimit: '6mb' },
  },
}

export default nextConfig
