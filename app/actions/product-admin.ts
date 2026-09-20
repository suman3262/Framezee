'use server'

import { and, eq, ne, sql } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'
import { db } from '@/db/index.ts'
import { orderItems, products } from '@/db/schema.ts'
import { requireWrite } from '@/lib/auth.ts'
import { uploadCatalogueImage } from '@/lib/catalogue-upload.ts'

export type ProductResult = { error?: string; ok?: string }

function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60)
}

async function freeSlug(base: string, exceptId?: string): Promise<string> {
  for (let n = 0; n < 50; n++) {
    const slug = n === 0 ? base : `${base}-${n + 1}`
    const clash = await db
      .select({ id: products.id })
      .from(products)
      .where(exceptId ? and(eq(products.slug, slug), ne(products.id, exceptId)) : eq(products.slug, slug))
      .limit(1)
    if (clash.length === 0) return slug
  }
  return `${base}-${Date.now()}`
}

/** Blank select values arrive as "", which must become null rather than an empty uuid. */
const orNull = (v: FormDataEntryValue | null) => {
  const s = String(v ?? '').trim()
  return s === '' ? null : s
}

type Fields = {
  title: string
  number: string | null
  description: string | null
  categoryId: string | null
  defaultMaterialId: string | null
  artworkImage: string
  isNew: boolean
  specs: [string, string][]
}

async function read(form: FormData): Promise<Fields | string> {
  const title = String(form.get('title') ?? '').trim().replace(/\s+/g, ' ')
  if (title.length < 2 || title.length > 80) return 'Give the frame a name between 2 and 80 characters.'

  const materialId = orNull(form.get('defaultMaterialId'))
  if (!materialId) return 'Choose a preselected finish — the "from" price is computed from its rate card.'

  // Specs arrive as parallel label/value rows; empty pairs are dropped rather than saved
  // as blank rows on the product page.
  const labels = form.getAll('specLabel').map(String)
  const values = form.getAll('specValue').map(String)
  const specs = labels
    .map((l, i) => [l.trim(), (values[i] ?? '').trim()] as [string, string])
    .filter(([l, v]) => l !== '' && v !== '')

  // A chosen file wins over the text field, so uploading replaces whatever was pasted.
  let artworkImage = String(form.get('artworkImage') ?? '').trim()
  const file = form.get('artworkFile')
  if (file instanceof File && file.size > 0) {
    const up = await uploadCatalogueImage(file, slugify(title))
    if ('error' in up) return up.error
    artworkImage = up.url
  }

  /*
   * Required. A readymade frame is sold with the artwork in it — a customer can buy the
   * frame and this picture together without uploading anything of their own, and the
   * listing has to show what they are getting. lib/artwork.ts still falls back for the
   * six seeded frames, but nothing new may be added without one.
   */
  if (!artworkImage)
    return 'Add the artwork for this frame — upload an image or give an address. A readymade frame is listed with its picture in it.'

  return {
    title,
    number: orNull(form.get('number')),
    description: orNull(form.get('description')),
    categoryId: orNull(form.get('categoryId')),
    defaultMaterialId: materialId,
    artworkImage,
    isNew: String(form.get('isNew') ?? '') === 'on',
    specs,
  }
}

export async function createProduct(_prev: ProductResult, form: FormData): Promise<ProductResult> {
  const gate = await requireWrite()
  if ('error' in gate) return gate

  const f = await read(form)
  if (typeof f === 'string') return { error: f }

  const slug = await freeSlug(slugify(f.title))

  await db.insert(products).values({
    ...f,
    slug,
    specs: f.specs,
    active: String(form.get('active') ?? '') === 'on',
  })

  revalidatePath('/admin/products')
  revalidatePath('/browse')
  revalidatePath('/')
  return { ok: `${f.title} added at /frames/${slug}.` }
}

export async function updateProduct(_prev: ProductResult, form: FormData): Promise<ProductResult> {
  const gate = await requireWrite()
  if ('error' in gate) return gate

  const id = String(form.get('id') ?? '')
  const [before] = await db.select().from(products).where(eq(products.id, id)).limit(1)
  if (!before) return { error: 'That frame no longer exists.' }

  const f = await read(form)
  if (typeof f === 'string') return { error: f }

  // As with categories, the address only changes when asked. Order items store the
  // title as frozen text, so renaming never rewrites an invoice either.
  const slug =
    String(form.get('reslug') ?? '') === 'on' ? await freeSlug(slugify(f.title), id) : before.slug

  await db.update(products).set({ ...f, slug, specs: f.specs }).where(eq(products.id, id))

  revalidatePath('/admin/products')
  revalidatePath('/browse')
  revalidatePath(`/frames/${slug}`)
  if (slug !== before.slug) revalidatePath(`/frames/${before.slug}`)
  return { ok: `${f.title} saved.` }
}

/**
 * Deleting is refused once a frame has been ordered.
 *
 * Order items hold the title as frozen text, so an invoice would survive — but the
 * dashboard's "top frame" and sold counts join back on that title, and reviews cascade.
 * Hiding keeps every number honest and is reversible, which is nearly always what was
 * actually wanted.
 */
export async function deleteProduct(_prev: ProductResult, form: FormData): Promise<ProductResult> {
  const gate = await requireWrite()
  if ('error' in gate) return gate

  const id = String(form.get('id') ?? '')
  const [row] = await db.select().from(products).where(eq(products.id, id)).limit(1)
  if (!row) return { error: 'That frame no longer exists.' }

  const [{ sold }] = await db
    .select({ sold: sql<number>`coalesce(sum(${orderItems.qty}),0)::int` })
    .from(orderItems)
    .where(eq(orderItems.title, row.title))

  if (sold > 0)
    return {
      error: `${row.title} has been ordered ${sold} time${sold === 1 ? '' : 's'}. Hide it instead — deleting would break the sold figures on the dashboard.`,
    }

  await db.delete(products).where(eq(products.id, id))

  revalidatePath('/admin/products')
  revalidatePath('/browse')
  revalidatePath('/')
  return { ok: `${row.title} deleted.` }
}

/** Moving a frame between categories, straight from the table. */
export async function setProductCategory(form: FormData): Promise<void> {
  if ('error' in (await requireWrite())) return

  const id = String(form.get('id') ?? '')
  if (!id) return

  await db
    .update(products)
    .set({ categoryId: orNull(form.get('categoryId')) })
    .where(eq(products.id, id))

  revalidatePath('/admin/products')
  revalidatePath('/admin/categories')
  revalidatePath('/browse')
}
