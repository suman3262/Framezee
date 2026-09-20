'use client'

import { createClient } from '@/lib/supabase/client.ts'
import { compressImage } from './compress.ts'

/** Only the printed artwork is ever uploaded. The wall preview stays in the browser. */
export type UploadKind = 'artwork'

export type UploadResult =
  | {
      ok: true
      path: string
      url: string
      widthPx: number
      heightPx: number
      /** Original and stored sizes in bytes, so the customer can be told what happened. */
      bytesBefore: number
      bytesAfter: number
    }
  | { ok: false; error: string }

const MAX_BYTES = 25 * 1024 * 1024
const TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/heic']

/**
 * Straight from the browser into Supabase Storage. The file never passes through the app
 * server, and lands under the signed-in user's own folder, which is what the storage
 * policies in migration 0004 allow.
 *
 * Only the photo that gets printed comes through here. A room photo used for the wall
 * preview is never uploaded — see components/studio/wall-stage.tsx.
 */
export async function uploadImage(file: File, kind: UploadKind): Promise<UploadResult> {
  if (!TYPES.includes(file.type)) return { ok: false, error: 'Use a JPG, PNG or WebP image.' }
  if (file.size > MAX_BYTES) return { ok: false, error: 'That image is over 25 MB.' }

  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: 'Sign in to upload a photo.' }

  // Resized and re-encoded before it leaves the browser, so storage holds a file the
  // workshop can print rather than whatever a 48-megapixel phone produced.
  const { file: upload, before, after } = await compressImage(file)

  const dims = await readDimensions(upload)
  if (!dims) return { ok: false, error: 'That file is not a readable image.' }

  const ext = upload.name.split('.').pop()?.toLowerCase().replace(/[^a-z0-9]/g, '') || 'jpg'
  const path = `${user.id}/${kind}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`

  const { error } = await supabase.storage.from('studio').upload(path, upload, {
    contentType: upload.type,
    upsert: false,
  })
  if (error) return { ok: false, error: error.message }

  // The bucket is private, so the preview needs a signed URL.
  const { data: signed } = await supabase.storage.from('studio').createSignedUrl(path, 60 * 60)
  if (!signed?.signedUrl) return { ok: false, error: 'Uploaded, but the preview could not load.' }

  return {
    ok: true,
    path,
    url: signed.signedUrl,
    widthPx: dims.w,
    heightPx: dims.h,
    bytesBefore: before,
    bytesAfter: after,
  }
}

function readDimensions(file: File): Promise<{ w: number; h: number } | null> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file)
    const img = new Image()
    img.onload = () => {
      resolve({ w: img.naturalWidth, h: img.naturalHeight })
      URL.revokeObjectURL(url)
    }
    img.onerror = () => {
      resolve(null)
      URL.revokeObjectURL(url)
    }
    img.src = url
  })
}

/**
 * Print quality at the chosen size. Below 150 DPI a print looks soft, and a customer
 * who is told before paying does not ask for a refund after.
 */
export function dpiFor(pixels: number, tenths: number): number {
  return Math.floor(pixels / (tenths / 10))
}

export function printQuality(
  widthPx: number,
  heightPx: number,
  widthTenths: number,
  heightTenths: number,
): { dpi: number; ok: boolean } {
  const dpi = Math.min(dpiFor(widthPx, widthTenths), dpiFor(heightPx, heightTenths))
  return { dpi, ok: dpi >= 150 }
}
