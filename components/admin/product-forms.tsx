'use client'

import { useActionState, useState } from 'react'
import {
  createProduct,
  updateProduct,
  deleteProduct,
  setProductCategory,
  type ProductResult,
} from '@/app/actions/product-admin.ts'
import { Icon } from '@/components/admin/shell.tsx'
import { artworkFor } from '@/lib/artwork.ts'

/** Must match MAX_BYTES in lib/catalogue-upload.ts and bodySizeLimit in next.config.ts. */
const MAX_IMAGE_BYTES = 5 * 1024 * 1024

export type Option = { id: string; name: string; swatch?: string }

export type ProductDraft = {
  id?: string
  slug?: string
  title: string
  number: string | null
  description: string | null
  categoryId: string | null
  defaultMaterialId: string | null
  artworkImage: string | null
  isNew: boolean
  specs: [string, string][]
}

const BLANK: ProductDraft = {
  title: '',
  number: null,
  description: null,
  categoryId: null,
  defaultMaterialId: null,
  artworkImage: null,
  isNew: true,
  specs: [
    ['Moulding', ''],
    ['Material', ''],
    ['Glazing', ''],
    ['Hanging', ''],
  ],
}

export function AddProductButton({
  categories,
  materials,
}: {
  categories: Option[]
  materials: Option[]
}) {
  const [open, setOpen] = useState(false)

  if (!open)
    return (
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-1 rounded-lg bg-violet px-4 py-2 font-display text-[13px] font-semibold text-white"
      >
        <Icon name="add_circle" className="text-[18px]" />
        Add frame
      </button>
    )

  return (
    <ProductEditor
      draft={BLANK}
      categories={categories}
      materials={materials}
      onClose={() => setOpen(false)}
    />
  )
}

export function EditProductButton({
  draft,
  categories,
  materials,
  sold,
}: {
  draft: ProductDraft
  categories: Option[]
  materials: Option[]
  sold: number
}) {
  const [open, setOpen] = useState(false)
  const [delState, delAction, delPending] = useActionState<ProductResult, FormData>(deleteProduct, {})

  return (
    <>
      <span className="flex flex-col items-end gap-1">
        <span className="flex items-center gap-1">
          <button
            onClick={() => setOpen(true)}
            className="flex items-center gap-1 rounded-lg bg-subtle px-2 py-[5px] text-[11px] font-bold text-t2"
          >
            <Icon name="edit" className="text-[14px]" />
            Edit
          </button>
          <form
            action={delAction}
            onSubmit={(e) => {
              if (!confirm(`Delete "${draft.title}"? This cannot be undone.`)) e.preventDefault()
            }}
          >
            <input type="hidden" name="id" value={draft.id} />
            <button
              disabled={delPending || sold > 0}
              title={sold > 0 ? `Ordered ${sold} times — hide it instead` : undefined}
              className="flex items-center gap-1 rounded-lg bg-bad-bg px-2 py-[5px] text-[11px] font-bold text-bad disabled:opacity-40"
            >
              <Icon name="delete" className="text-[14px]" />
              Delete
            </button>
          </form>
        </span>
        {delState.error && (
          <span className="max-w-80 text-right text-[11px] font-medium text-bad">{delState.error}</span>
        )}
      </span>

      {open && (
        <ProductEditor
          draft={draft}
          categories={categories}
          materials={materials}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  )
}

/**
 * One editor for both adding and editing — the fields are identical, and two of them
 * would drift apart the first time a column is added.
 */
function ProductEditor({
  draft,
  categories,
  materials,
  onClose,
}: {
  draft: ProductDraft
  categories: Option[]
  materials: Option[]
  onClose: () => void
}) {
  const editing = Boolean(draft.id)
  const [state, action, pending] = useActionState<ProductResult, FormData>(
    editing ? updateProduct : createProduct,
    {},
  )
  const [artwork, setArtwork] = useState(draft.artworkImage ?? '')
  const [preview, setPreview] = useState<string | null>(null)
  const [fileName, setFileName] = useState<string | null>(null)
  const [fileError, setFileError] = useState<string | null>(null)
  const [materialId, setMaterialId] = useState(draft.defaultMaterialId ?? '')
  const [specs, setSpecs] = useState<[string, string][]>(
    draft.specs.length ? draft.specs : BLANK.specs,
  )

  const swatch = materials.find((m) => m.id === materialId)?.swatch ?? '#cccccc'

  return (
    <div className="fixed inset-0 z-[60] flex items-start justify-center overflow-y-auto bg-black/40 p-4">
      <form
        action={async (fd) => {
          const res = await action(fd)
          return res
        }}
        className="my-6 w-full max-w-[720px] rounded-xl bg-card p-5 shadow-2xl"
      >
        {editing && <input type="hidden" name="id" value={draft.id} />}

        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-display text-xl font-bold text-t1">
            {editing ? `Edit ${draft.title}` : 'New frame'}
          </h2>
          <button type="button" onClick={onClose} aria-label="Close" className="text-t3 hover:text-t1">
            <Icon name="close" className="text-[20px]" />
          </button>
        </div>

        <div className="grid gap-4 sm:grid-cols-[1fr_200px]">
          <div className="flex flex-col gap-3">
            <Field label="Frame name" name="title" defaultValue={draft.title} required maxLength={80} />

            <div className="grid grid-cols-2 gap-3">
              <Field
                label="Number"
                name="number"
                defaultValue={draft.number ?? ''}
                placeholder="007"
                hint="shown as No."
              />
              <Select
                label="Category"
                name="categoryId"
                defaultValue={draft.categoryId ?? ''}
                options={categories}
                blank="No category"
              />
            </div>

            <label className="flex flex-col">
              <Label>Preselected finish</Label>
              <select
                name="defaultMaterialId"
                value={materialId}
                onChange={(e) => setMaterialId(e.target.value)}
                required
                className="rounded-lg border border-rule bg-card px-3 py-2 text-[13px] text-t1 outline-none focus:ring-2 focus:ring-violet/40"
              >
                <option value="">Choose a moulding…</option>
                {materials.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name}
                  </option>
                ))}
              </select>
              <span className="mt-1 text-[11px] leading-4 text-t3">
                The chip that starts selected, and the rate card the &ldquo;from&rdquo; price is
                quoted against. It does not limit the finishes — every Offered moulding shows
                on every frame.
              </span>
            </label>

            <label className="flex flex-col">
              <Label>Description</Label>
              <textarea
                name="description"
                defaultValue={draft.description ?? ''}
                rows={3}
                maxLength={600}
                className="rounded-lg border border-rule bg-card px-3 py-2 text-[13px] leading-[18px] text-t1 outline-none focus:ring-2 focus:ring-violet/40"
              />
            </label>
          </div>

          <div className="flex flex-col gap-3">
            <div>
              <Label>Artwork preview</Label>
              <div
                className="h-[150px] rounded-lg ring-1 ring-black/10"
                style={{
                  background: preview
                    ? `center / cover no-repeat url("${preview}")`
                    : artworkFor(draft.slug ?? '', artwork),
                }}
              />
            </div>

            <div className="flex flex-col gap-2">
              <Label>Artwork · required</Label>

              <label className="cursor-pointer rounded-lg border border-dashed border-violet/50 bg-violet-tint/30 px-3 py-3 text-center">
                <input
                  type="file"
                  name="artworkFile"
                  accept="image/jpeg,image/png,image/webp,image/avif"
                  className="sr-only"
                  onChange={(e) => {
                    const f = e.target.files?.[0]
                    // Checked here as well as on the server: an oversized file would
                    // otherwise be rejected by Next's body limit as an opaque 500 long
                    // after the upload appeared to start.
                    if (f && f.size > MAX_IMAGE_BYTES) {
                      setFileError(
                        `That image is ${(f.size / 1024 / 1024).toFixed(1)} MB. The limit is 5 MB — try exporting it smaller.`,
                      )
                      e.target.value = ''
                      setFileName(null)
                      setPreview((old) => {
                        if (old) URL.revokeObjectURL(old)
                        return null
                      })
                      return
                    }
                    setFileError(null)
                    setFileName(f?.name ?? null)
                    // Show the chosen file straight away; the object URL is only for
                    // this preview and is replaced whenever a new file is picked.
                    setPreview((old) => {
                      if (old) URL.revokeObjectURL(old)
                      return f ? URL.createObjectURL(f) : null
                    })
                  }}
                />
                <span className="flex items-center justify-center gap-1 text-[12px] font-semibold text-violet-ink">
                  <Icon name="upload" className="text-[16px]" />
                  {fileName ? 'Choose a different image' : 'Upload an image'}
                </span>
                <span className="mt-[2px] block text-[11px] text-t3">
                  {fileName ?? 'JPEG, PNG, WebP or AVIF · up to 5 MB'}
                </span>
              </label>

              {fileError && (
                <p className="rounded-lg bg-bad-bg px-2 py-[6px] text-[11px] font-medium text-bad">
                  {fileError}
                </p>
              )}

              <details className="text-[11px] text-t3">
                <summary className="cursor-pointer font-semibold text-violet-deep">
                  Or use an address
                </summary>
                <input
                  name="artworkImage"
                  value={artwork}
                  onChange={(e) => setArtwork(e.target.value)}
                  placeholder="https://… or linear-gradient(…)"
                  className="mt-2 w-full rounded-lg border border-rule bg-card px-2 py-2 text-[12px] text-t1 outline-none focus:ring-2 focus:ring-violet/40"
                />
                <span className="mt-1 block leading-4">
                  An image address, or any CSS background. An uploaded file wins over this.
                  Every readymade frame is listed with its picture in it.
                </span>
              </details>
            </div>

            <span className="flex items-center gap-2 rounded-lg bg-subtle p-2">
              <span
                className="size-4 shrink-0 rounded-full ring-1 ring-black/10"
                style={{ background: swatch }}
              />
              <span className="text-[11px] text-t3">Moulding colour on the card</span>
            </span>

            <label className="flex cursor-pointer items-center gap-2">
              <input
                type="checkbox"
                name="isNew"
                defaultChecked={draft.isNew}
                className="size-4 accent-[color:var(--violet-deep)]"
              />
              <span className="text-[12px] text-t2">Show a NEW badge</span>
            </label>

            <label className="flex cursor-pointer items-center gap-2">
              <input
                type="checkbox"
                name="active"
                defaultChecked
                className="size-4 accent-[color:var(--violet-deep)]"
              />
              <span className="text-[12px] text-t2">Live on the storefront</span>
            </label>
          </div>
        </div>

        <div className="mt-4">
          <Label>Specifications</Label>
          <div className="flex flex-col gap-2">
            {specs.map(([label, value], i) => (
              <div key={i} className="flex gap-2">
                <input
                  name="specLabel"
                  value={label}
                  onChange={(e) =>
                    setSpecs((s) => s.map((r, k) => (k === i ? [e.target.value, r[1]] : r)))
                  }
                  placeholder="Glazing"
                  className="w-40 shrink-0 rounded-lg border border-rule bg-card px-2 py-[6px] text-[12px] text-t1 outline-none"
                />
                <input
                  name="specValue"
                  value={value}
                  onChange={(e) =>
                    setSpecs((s) => s.map((r, k) => (k === i ? [r[0], e.target.value] : r)))
                  }
                  placeholder="3 mm styrene, 97% clarity"
                  className="min-w-0 flex-1 rounded-lg border border-rule bg-card px-2 py-[6px] text-[12px] text-t1 outline-none"
                />
                <button
                  type="button"
                  onClick={() => setSpecs((s) => s.filter((_, k) => k !== i))}
                  aria-label="Remove specification"
                  className="shrink-0 text-t3 hover:text-bad"
                >
                  <Icon name="close" className="text-[16px]" />
                </button>
              </div>
            ))}
          </div>
          <button
            type="button"
            onClick={() => setSpecs((s) => [...s, ['', '']])}
            className="mt-2 text-[12px] font-semibold text-violet-deep"
          >
            + Add a row
          </button>
          <p className="mt-1 text-[11px] text-t3">
            Blank rows are dropped. Order matters — this is the table on the product page.
          </p>
        </div>

        {editing && (
          <label className="mt-4 flex cursor-pointer items-center gap-[6px]">
            <input type="checkbox" name="reslug" className="size-[13px] accent-[color:var(--violet-deep)]" />
            <span className="text-[11px] text-t3">
              Also update the web address (breaks existing links to{' '}
              <code className="font-mono">/frames/{draft.slug}</code>)
            </span>
          </label>
        )}

        {state.error && (
          <p className="mt-3 rounded-lg bg-bad-bg px-3 py-2 text-xs font-medium text-bad">{state.error}</p>
        )}
        {state.ok && !state.error && (
          <p className="mt-3 rounded-lg bg-ok-bg px-3 py-2 text-xs font-medium text-ok">{state.ok}</p>
        )}

        <div className="mt-4 flex items-center justify-end gap-2">
          <button type="button" onClick={onClose} className="px-3 py-2 text-[13px] font-semibold text-t3">
            Close
          </button>
          <button
            disabled={pending || fileError !== null}
            className="rounded-lg bg-violet px-5 py-2 font-display text-[13px] font-bold text-white disabled:opacity-50"
          >
            {pending ? 'Saving…' : editing ? 'Save changes' : 'Add frame'}
          </button>
        </div>
      </form>
    </div>
  )
}

function Label({ children }: { children: React.ReactNode }) {
  return (
    <span className="mb-1 block text-[11px] font-semibold uppercase tracking-[0.04em] text-t3">
      {children}
    </span>
  )
}

function Field({
  label,
  name,
  defaultValue,
  placeholder,
  hint,
  required,
  maxLength,
}: {
  label: string
  name: string
  defaultValue?: string
  placeholder?: string
  hint?: string
  required?: boolean
  maxLength?: number
}) {
  return (
    <label className="flex flex-col">
      <Label>
        {label}
        {hint && <span className="font-normal normal-case tracking-normal"> · {hint}</span>}
      </Label>
      <input
        name={name}
        defaultValue={defaultValue}
        placeholder={placeholder}
        required={required}
        maxLength={maxLength}
        className="rounded-lg border border-rule bg-card px-3 py-2 text-[13px] text-t1 outline-none focus:ring-2 focus:ring-violet/40"
      />
    </label>
  )
}

function Select({
  label,
  name,
  defaultValue,
  options,
  blank,
}: {
  label: string
  name: string
  defaultValue: string
  options: Option[]
  blank: string
}) {
  return (
    <label className="flex flex-col">
      <Label>{label}</Label>
      <select
        name={name}
        defaultValue={defaultValue}
        className="rounded-lg border border-rule bg-card px-3 py-2 text-[13px] text-t1 outline-none focus:ring-2 focus:ring-violet/40"
      >
        <option value="">{blank}</option>
        {options.map((o) => (
          <option key={o.id} value={o.id}>
            {o.name}
          </option>
        ))}
      </select>
    </label>
  )
}

/** The inline category move on each table row — saves as soon as the choice changes. */
export function CategoryCell({
  id,
  categoryId,
  categories,
}: {
  id: string
  categoryId: string | null
  categories: Option[]
}) {
  return (
    <form action={setProductCategory}>
      <input type="hidden" name="id" value={id} />
      <select
        name="categoryId"
        defaultValue={categoryId ?? ''}
        onChange={(e) => e.currentTarget.form?.requestSubmit()}
        className="rounded-lg bg-subtle px-2 py-[5px] text-[12px] text-t1"
      >
        <option value="">No category</option>
        {categories.map((c) => (
          <option key={c.id} value={c.id}>
            {c.name}
          </option>
        ))}
      </select>
    </form>
  )
}
