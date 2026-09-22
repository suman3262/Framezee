import Link from 'next/link'
import { asc, eq, sql } from 'drizzle-orm'
import { db } from '@/db/index.ts'
import { categories, materials, orderItems, products } from '@/db/schema.ts'
import { requireStaff } from '@/lib/auth.ts'
import { Submit } from '@/components/admin/submit.tsx'
import { AdminShell, Card, Icon } from '@/components/admin/shell.tsx'
import {
  AddProductButton,
  EditProductButton,
  CategoryCell,
  type Option,
} from '@/components/admin/product-forms.tsx'
import { toggleProduct } from '@/app/actions/admin.ts'
import { loadCatalog } from '@/lib/storefront.ts'
import { artworkFor } from '@/lib/artwork.ts'
import { fmtInrRupees } from '@/lib/pricing.ts'

export default async function AdminProducts() {
  const staff = await requireStaff()
  const readOnly = staff.role !== 'super_admin' && staff.permission !== 'read_write'

  const [rows, priced, materialRows, categoryRows] = await Promise.all([
    db
      .select({
        id: products.id,
        slug: products.slug,
        title: products.title,
        number: products.number,
        description: products.description,
        artworkImage: products.artworkImage,
        specs: products.specs,
        active: products.active,
        isNew: products.isNew,
        ratingTenths: products.ratingTenths,
        ratingCount: products.ratingCount,
        categoryId: products.categoryId,
        categoryName: categories.name,
        defaultMaterialId: products.defaultMaterialId,
        materialName: materials.name,
        swatch: materials.swatch,
        sold: sql<number>`(select coalesce(sum(${orderItems.qty}),0)::int from ${orderItems}
                            where ${orderItems.title} = ${products.title})`,
      })
      .from(products)
      .leftJoin(categories, eq(products.categoryId, categories.id))
      .leftJoin(materials, eq(products.defaultMaterialId, materials.id))
      .orderBy(asc(products.number)),
    loadCatalog(),
    db.select().from(materials).where(eq(materials.active, true)).orderBy(asc(materials.name)),
    db.select().from(categories).orderBy(asc(categories.sortOrder)),
  ])

  const fromBySlug = new Map(priced.items.map((i) => [i.slug, i.fromPaise]))

  const categoryOptions: Option[] = categoryRows.map((c) => ({
    id: c.id,
    name: `${c.icon ?? ''} ${c.name}`.trim(),
  }))
  const materialOptions: Option[] = materialRows.map((m) => ({
    id: m.id,
    name: m.name,
    swatch: m.swatch,
  }))

  const live = rows.filter((r) => r.active).length
  const unfiled = rows.filter((r) => !r.categoryId).length

  return (
    <AdminShell
      staff={staff}
      active="/admin/products"
      eyebrow="Catalogue"
      title="Products & frames"
      actions={
        !readOnly && <AddProductButton categories={categoryOptions} materials={materialOptions} />
      }
    >
      <div className="grid gap-5 sm:grid-cols-3">
        <Stat label="Frames" value={String(rows.length)} note={`${live} live on the storefront`} icon="crop_original" />
        <Stat label="Mouldings" value={String(materialRows.length)} note="each with its own rate card" icon="palette" />
        <Stat
          label="Without a category"
          value={String(unfiled)}
          note={unfiled > 0 ? 'these sit under no storefront pill' : 'every frame is filed'}
          icon="help_center"
          warn={unfiled > 0}
        />
      </div>

      <p className="max-w-2xl text-[13px] leading-[18px] text-t3">
        Prices are not stored on a frame — they are computed from its moulding&rsquo;s rate card,
        so editing a rate moves every frame using it at once. Rate cards live in{' '}
        <Link href="/admin/pricing" className="font-semibold text-violet-deep">
          Price &amp; Material Control
        </Link>
        .
      </p>

      <Card className="p-0">
        {rows.length === 0 ? (
          <p className="px-4 py-10 text-center text-[13px] text-t3">
            No frames yet. Add the first one above, or run{' '}
            <code className="font-mono text-t2">npm run seed</code>.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px] text-left">
              <thead>
                <tr className="border-b border-rule bg-subtle text-[11px] font-semibold uppercase tracking-[0.03em] text-t3">
                  <th className="px-4 py-3">Frame</th>
                  <th className="px-4 py-3">Category</th>
                  <th className="px-4 py-3">Preselected finish</th>
                  <th className="px-4 py-3">From</th>
                  <th className="px-4 py-3">Rating</th>
                  <th className="px-4 py-3">Sold</th>
                  <th className="px-4 py-3">Live</th>
                  {!readOnly && <th className="px-4 py-3 text-right">Edit</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-rule">
                {rows.map((p) => (
                  <tr key={p.id} className={p.active ? '' : 'bg-subtle/40'}>
                    <td className="px-4 py-3">
                      <span className="flex items-center gap-3">
                        <span
                          className="size-10 shrink-0 rounded-lg ring-1 ring-black/10"
                          style={{ background: artworkFor(p.slug, p.artworkImage) }}
                        />
                        <span className="min-w-0">
                          <Link
                            href={`/frames/${p.slug}`}
                            className={`text-[13px] font-semibold hover:underline ${p.active ? 'text-t1' : 'text-t3'}`}
                          >
                            {p.title}
                          </Link>
                          {p.isNew && (
                            <span className="ml-2 rounded-full bg-accent px-2 py-[1px] text-[10px] font-bold text-accent-ink">
                              NEW
                            </span>
                          )}
                          <span className="block font-mono text-[11px] text-t3">
                            {p.number ? `No. ${p.number} · ` : ''}
                            {p.slug}
                          </span>
                        </span>
                      </span>
                    </td>

                    <td className="px-4 py-3">
                      {readOnly ? (
                        <span className="text-[13px] text-t2">{p.categoryName ?? '—'}</span>
                      ) : (
                        <CategoryCell
                          id={p.id}
                          categoryId={p.categoryId}
                          categories={categoryOptions}
                        />
                      )}
                    </td>

                    <td className="px-4 py-3">
                      <span className="flex items-center gap-2 text-[13px] text-t2">
                        <span
                          className="size-3 shrink-0 rounded-full ring-1 ring-black/10"
                          style={{ background: p.swatch ?? '#ccc' }}
                        />
                        {p.materialName ?? '—'}
                      </span>
                    </td>

                    <td className="px-4 py-3 text-[13px] font-semibold text-t1">
                      {fromBySlug.get(p.slug) != null ? fmtInrRupees(fromBySlug.get(p.slug)!) : '—'}
                    </td>

                    <td className="px-4 py-3 text-[13px] text-t2">
                      {p.ratingTenths ? `${(p.ratingTenths / 10).toFixed(1)} (${p.ratingCount})` : '—'}
                    </td>

                    <td className="px-4 py-3 text-[13px] text-t2">{p.sold}</td>

                    <td className="px-4 py-3">
                      {readOnly ? (
                        <span className={`text-[12px] ${p.active ? 'text-ok' : 'text-t3'}`}>
                          {p.active ? 'Live' : 'Hidden'}
                        </span>
                      ) : (
                        <form action={toggleProduct}>
                          <input type="hidden" name="id" value={p.id} />
                          <input type="hidden" name="active" value={String(!p.active)} />
                          <Submit
                            className={`rounded-full px-3 py-1 text-[11px] font-semibold ${
                              p.active ? 'bg-ok-bg text-ok' : 'bg-subtle text-t3'
                            }`}
                            pendingLabel="…"
                          >
                            {p.active ? 'Live' : 'Hidden'}
                          </Submit>
                        </form>
                      )}
                    </td>

                    {!readOnly && (
                      <td className="px-4 py-3 text-right">
                        <EditProductButton
                          sold={p.sold}
                          categories={categoryOptions}
                          materials={materialOptions}
                          draft={{
                            id: p.id,
                            slug: p.slug,
                            title: p.title,
                            number: p.number,
                            description: p.description,
                            categoryId: p.categoryId,
                            defaultMaterialId: p.defaultMaterialId,
                            artworkImage: p.artworkImage,
                            isNew: p.isNew,
                            specs: Array.isArray(p.specs) ? (p.specs as [string, string][]) : [],
                          }}
                        />
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {readOnly && (
        <p className="rounded-lg bg-info-bg px-3 py-2 text-[12px] font-medium text-info">
          Your access is read-only, so frames can be viewed but not changed.
        </p>
      )}
    </AdminShell>
  )
}

function Stat({
  label,
  value,
  note,
  icon,
  warn,
}: {
  label: string
  value: string
  note: string
  icon: string
  warn?: boolean
}) {
  return (
    <Card className={warn ? 'ring-1 ring-warn/30' : ''}>
      <div className="flex items-start justify-between gap-2">
        <span className="text-[12px] text-t3">{label}</span>
        <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-subtle text-violet-deep">
          <Icon name={icon} className="text-[18px]" />
        </span>
      </div>
      <p className="mt-2 font-display text-[28px] font-bold leading-8 tracking-[-0.01em] text-t1">
        {value}
      </p>
      <p className="mt-1 text-[12px] text-t3">{note}</p>
    </Card>
  )
}
