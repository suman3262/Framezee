import Link from 'next/link'
import { asc, eq, sql } from 'drizzle-orm'
import { db } from '@/db/index.ts'
import { categories, products } from '@/db/schema.ts'
import { requireStaff } from '@/lib/auth.ts'
import { AdminShell, Card, Icon } from '@/components/admin/shell.tsx'
import { AddCategoryForm, EditCategory } from '@/components/admin/category-forms.tsx'
import { toggleCategory } from '@/app/actions/admin.ts'
import { moveCategory } from '@/app/actions/category-admin.ts'

export default async function AdminCategories() {
  const staff = await requireStaff()
  const readOnly = staff.role !== 'super_admin' && staff.permission !== 'read_write'

  const rows = await db
    .select({
      id: categories.id,
      slug: categories.slug,
      name: categories.name,
      icon: categories.icon,
      active: categories.active,
      sortOrder: categories.sortOrder,
      frames: sql<number>`(select count(*)::int from ${products}
                            where ${products.categoryId} = ${categories.id})`,
      live: sql<number>`(select count(*)::int from ${products}
                          where ${products.categoryId} = ${categories.id} and ${products.active})`,
    })
    .from(categories)
    .orderBy(asc(categories.sortOrder))

  const [{ unfiled }] = await db
    .select({ unfiled: sql<number>`count(*)::int` })
    .from(products)
    .where(sql`${products.categoryId} is null`)

  const shown = rows.filter((r) => r.active).length
  const filed = rows.reduce((n, r) => n + r.frames, 0)

  return (
    <AdminShell
      staff={staff}
      active="/admin/categories"
      eyebrow="Catalogue"
      title="Categories"
      actions={!readOnly && <AddCategoryForm />}
    >
      <div className="grid gap-5 sm:grid-cols-3">
        <Stat label="Categories" value={String(rows.length)} note={`${shown} shown on the storefront`} icon="category" />
        <Stat label="Frames filed" value={String(filed)} note="across all categories" icon="crop_original" />
        <Stat
          label="Unfiled frames"
          value={String(unfiled)}
          note={unfiled > 0 ? 'these show in Browse but under no pill' : 'every frame has a category'}
          icon="help_center"
          warn={unfiled > 0}
        />
      </div>

      <p className="max-w-2xl text-[13px] leading-[18px] text-t3">
        These are the pills across the top of the storefront, in this order. Hiding one takes
        it off the shop without touching the frames inside it — which is almost always what
        you want, because deleting is refused while a category still holds frames.
      </p>

      <Card className="p-0">
        {rows.length === 0 ? (
          <p className="px-4 py-10 text-center text-[13px] text-t3">
            No categories yet. Add the first one above.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-left">
              <thead>
                <tr className="border-b border-rule bg-subtle text-[11px] font-semibold uppercase tracking-[0.03em] text-t3">
                  <th className="px-4 py-3">Order</th>
                  <th className="px-4 py-3">Category</th>
                  <th className="px-4 py-3">Web address</th>
                  <th className="px-4 py-3">Frames</th>
                  <th className="px-4 py-3">Shown</th>
                  {!readOnly && <th className="px-4 py-3 text-right">Edit</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-rule">
                {rows.map((c, i) => (
                  <tr key={c.id} className={c.active ? '' : 'bg-subtle/40'}>
                    <td className="px-4 py-3">
                      <span className="flex items-center gap-1">
                        <span className="w-4 text-[12px] tabular-nums text-t3">{i + 1}</span>
                        {!readOnly && (
                          <>
                            <Move id={c.id} up disabled={i === 0} />
                            <Move id={c.id} up={false} disabled={i === rows.length - 1} />
                          </>
                        )}
                      </span>
                    </td>

                    <td className="px-4 py-3">
                      <span className="flex items-center gap-2">
                        <span aria-hidden className="text-[16px]">
                          {c.icon ?? '·'}
                        </span>
                        <span className={`text-[13px] font-semibold ${c.active ? 'text-t1' : 'text-t3'}`}>
                          {c.name}
                        </span>
                      </span>
                    </td>

                    <td className="px-4 py-3">
                      <Link
                        href={`/browse?category=${c.slug}`}
                        className="font-mono text-[12px] text-t3 hover:text-violet-deep hover:underline"
                      >
                        {c.slug}
                      </Link>
                    </td>

                    <td className="px-4 py-3 text-[13px] text-t2">
                      {c.frames}
                      {c.frames !== c.live && (
                        <span className="text-[12px] text-t3"> · {c.live} live</span>
                      )}
                    </td>

                    <td className="px-4 py-3">
                      {readOnly ? (
                        <span className={`text-[12px] ${c.active ? 'text-ok' : 'text-t3'}`}>
                          {c.active ? 'Shown' : 'Hidden'}
                        </span>
                      ) : (
                        <form action={toggleCategory}>
                          <input type="hidden" name="id" value={c.id} />
                          <input type="hidden" name="active" value={String(!c.active)} />
                          <button
                            className={`rounded-full px-3 py-1 text-[11px] font-semibold ${
                              c.active ? 'bg-ok-bg text-ok' : 'bg-subtle text-t3'
                            }`}
                          >
                            {c.active ? 'Shown' : 'Hidden'}
                          </button>
                        </form>
                      )}
                    </td>

                    {!readOnly && (
                      <td className="px-4 py-3 text-right">
                        <EditCategory
                          id={c.id}
                          name={c.name}
                          icon={c.icon}
                          slug={c.slug}
                          frames={c.frames}
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
          Your access is read-only, so categories can be viewed but not changed.
        </p>
      )}
    </AdminShell>
  )
}

function Move({ id, up, disabled }: { id: string; up: boolean; disabled: boolean }) {
  return (
    <form action={moveCategory}>
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="up" value={String(up)} />
      <button
        disabled={disabled}
        aria-label={up ? 'Move up' : 'Move down'}
        className="grid size-6 place-items-center rounded text-t3 hover:bg-subtle hover:text-t1 disabled:opacity-25 disabled:hover:bg-transparent"
      >
        <Icon name={up ? 'arrow_upward' : 'arrow_downward'} className="text-[15px]" />
      </button>
    </form>
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
