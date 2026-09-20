'use client'

/**
 * Shrinks a photograph in the browser before it is uploaded.
 *
 * The balance here is storage against print quality, and print quality wins ties: this
 * is the file the workshop prints, so it is capped at a size that still prints well
 * rather than at whatever looks fine on a screen.
 *
 *   4,500 px on the long edge covers a 30 in print at 150 DPI, which is past the largest
 *   frame any moulding can make. Anything larger is detail nobody will ever see on paper.
 *
 * It is deliberately timid: if the browser cannot decode the file, or the re-encoded
 * version comes out no smaller, the original is uploaded untouched. A photo that uploads
 * larger than necessary is a cost; a photo that fails to upload is a lost order.
 */

const MAX_EDGE = 4500
const QUALITY = 0.9

export type Compressed = { file: File; before: number; after: number }

export async function compressImage(file: File): Promise<Compressed> {
  const untouched = { file, before: file.size, after: file.size }

  // PNGs of artwork are often flat colour where JPEG would add artefacts, and HEIC
  // cannot be decoded by canvas in most browsers at all.
  if (!/^image\/(jpeg|png|webp)$/.test(file.type)) return untouched

  let bitmap: ImageBitmap
  try {
    bitmap = await createImageBitmap(file)
  } catch {
    return untouched
  }

  const scale = Math.min(1, MAX_EDGE / Math.max(bitmap.width, bitmap.height))
  const w = Math.round(bitmap.width * scale)
  const h = Math.round(bitmap.height * scale)

  // Nothing to gain: already small, and JPEG would only re-encode existing artefacts.
  if (scale === 1 && file.type === 'image/jpeg' && file.size < 2 * 1024 * 1024) {
    bitmap.close()
    return untouched
  }

  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d')
  if (!ctx) {
    bitmap.close()
    return untouched
  }

  // A white floor, so a transparent PNG does not print as black.
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, w, h)
  ctx.drawImage(bitmap, 0, 0, w, h)
  bitmap.close()

  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, 'image/jpeg', QUALITY),
  )
  if (!blob || blob.size >= file.size) return untouched

  const name = file.name.replace(/\.[^.]+$/, '') + '.jpg'
  return {
    file: new File([blob], name, { type: 'image/jpeg', lastModified: Date.now() }),
    before: file.size,
    after: blob.size,
  }
}

export const mb = (bytes: number) => (bytes / 1024 / 1024).toFixed(1)
