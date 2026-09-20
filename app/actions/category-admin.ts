'use server'

import { and, asc, eq, ne, sql } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'
import { db } from '@/db/index.ts'
import { categories, products } from '@/db/schema.ts'
import { requireWrite } from '@/lib/auth.ts'

export type CategoryResult = { error?: string; ok?: string }

/** "Anime & Pop Culture" → "anime-pop-culture". */
function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48)
}

/** Slugs are in storefront URLs, so a clash has to be resolved rather than rejected. */
async function freeSlug(base: string, exceptId?: string): Promise<string> {
  for (let n = 0; n < 50; n++) {
    const slug = n === 0 ? base : `${base}-${n + 1}`
    const clash = await db
      .select({ id: categories.id })
      .from(categories)
      .where(exceptId ? and(eq(categories.slug, slug), ne(categories.id, exceptId)) : eq(categories.slug, slug))
      .limit(1)
    if (clash.length === 0) return slug
  }
  return `${base}-${Date.now()}`
}

function readName(form: FormData): string | null {
  const name = String(form.get('name') ?? '').trim().replace(/\s+/g, ' ')
  return name.length >= 2 && name.length <= 40 ? name : null
}

/** One emoji, or nothing. Anything longer would break the storefront pill. */
function readIcon(form: FormData): string | null {
  const icon = String(form.get('icon') ?? '').trim()
  return icon ? [...icon][0] ?? null : null
}

export async function createCategory(_prev: CategoryResult, form: FormData): Promise<CategoryResult> {
  const gate = await requireWrite()
  if ('error' in gate) return gate

  const name = readName(form)
  if (!name) return { error: 'Give the category a name between 2 and 40 characters.' }

  const slug = await freeSlug(slugify(name))
  if (!slug) return { error: 'That name does not make a usable web address. Try letters and numbers.' }

  // New categories go last so adding one never reshuffles the storefront.
  const [{ next }] = await db
    .select({ next: sql<number>`coalesce(max(${categories.sortOrder}), -1) + 1` })
    .from(categories)

  await db.insert(categories).values({
    name,
    slug,
    icon: readIcon(form),
    sortOrder: Number(next),
    active: String(form.get('active') ?? '') === 'on',
  })

  revalidatePath('/admin/categories')
  revalidatePath('/browse')
  return { ok: `${name} added.` }
}

/**
 * Renaming keeps the old slug. A slug that has been shared, bookmarked or indexed must
 * keep working, and a typo fix is not worth breaking every link into that category.
 * "Fix the web address" is a separate, deliberate action.
 */
export async function renameCategory(_prev: CategoryResult, form: FormData): Promise<CategoryResult> {
  const gate = await requireWrite()
  if ('error' in gate) return gate

  const id = String(form.get('id') ?? '')
  const name = readName(form)
  if (!name) return { error: 'Give the category a name between 2 and 40 characters.' }

  const [before] = await db.select().from(categories).where(eq(categories.id, id)).limit(1)
  if (!before) return { error: 'That category no longer exists.' }

  const slug =
    String(form.get('reslug') ?? '') === 'on' ? await freeSlug(slugify(name), id) : before.slug

  await db.update(categories).set({ name, icon: readIcon(form), slug }).where(eq(categories.id, id))

  revalidatePath('/admin/categories')
  revalidatePath('/browse')
  return {
    ok: slug === before.slug ? `Renamed to ${name}.` : `Renamed to ${name}, web address is now /${slug}.`,
  }
}

/** Swaps with the neighbour, so the order stays a contiguous run with no gaps. */
export async function moveCategory(form: FormData): Promise<void> {
  if ('error' in (await requireWrite())) return

  const id = String(form.get('id') ?? '')
  const up = String(form.get('up') ?? '') === 'true'
  if (!id) return

  const rows = await db
    .select({ id: categories.id, sortOrder: categories.sortOrder })
    .from(categories)
    .orderBy(asc(categories.sortOrder))

  const i = rows.findIndex((r) => r.id === id)
  const j = up ? i - 1 : i + 1
  if (i === -1 || j < 0 || j >= rows.length) return

  await db.transaction(async (tx) => {
    await tx.update(categories).set({ sortOrder: rows[j].sortOrder }).where(eq(categories.id, rows[i].id))
    await tx.update(categories).set({ sortOrder: rows[i].sortOrder }).where(eq(categories.id, rows[j].id))
  })

  revalidatePath('/admin/categories')
  revalidatePath('/browse')
}

/**
 * Deleting is refused while frames still point at the category.
 *
 * The column is nullable, so the delete would otherwise succeed and quietly orphan every
 * frame in it — they would vanish from the storefront's category pills with nothing to
 * say why. Hiding is almost always what was meant anyway.
 */
export async function deleteCategory(_prev: CategoryResult, form: FormData): Promise<CategoryResult> {
  const gate = await requireWrite()
  if ('error' in gate) return gate

  const id = String(form.get('id') ?? '')
  const [row] = await db.select().from(categories).where(eq(categories.id, id)).limit(1)
  if (!row) return { error: 'That category no longer exists.' }

  const [{ n }] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(products)
    .where(eq(products.categoryId, id))

  if (n > 0)
    return {
      error: `${row.name} still holds ${n} frame${n === 1 ? '' : 's'}. Move them to another category first, or hide this one instead.`,
    }

  await db.delete(categories).where(eq(categories.id, id))

  // Close the gap so the remaining order stays 0,1,2… rather than drifting apart.
  const rest = await db
    .select({ id: categories.id })
    .from(categories)
    .orderBy(asc(categories.sortOrder))
  await db.transaction(async (tx) => {
    for (const [i, c] of rest.entries())
      await tx.update(categories).set({ sortOrder: i }).where(eq(categories.id, c.id))
  })

  revalidatePath('/admin/categories')
  revalidatePath('/browse')
  return { ok: `${row.name} deleted.` }
}
