'use client'

import { useActionState, useMemo, useState } from 'react'
import { addRateBand, updateRateBand, deleteRateBand, type SaveResult } from '@/app/actions/pricing-admin.ts'
import { priceLine, fmtInr, fmtIn, PriceError, type Band } from '@/lib/pricing.ts'

export type RateRow = { id: string; maxWidthTenths: number; maxHeightTenths: number; ratePaisePerSqIn: number }

/**
 * A rate card with a live price preview beside it.
 *
 * The preview is the point: a rate is an abstract number until you see what it charges
 * for a real frame. A wrong figure should be obvious before it is saved, not after an
 * order arrives priced wrongly.
 */
export function RateCard({
  kind,
  ownerId,
  ownerName,
  bands,
  limits,
  canDeleteLast,
}: {
  kind: 'material' | 'paper' | 'glazing'
  ownerId: string
  ownerName: string
  bands: RateRow[]
  limits?: { maxWidthTenths: number; maxHeightTenths: number }
  canDeleteLast: boolean
}) {
  const [addState, addAction, adding] = useActionState<SaveResult, FormData>(addRateBand, {})
  const [editState, editAction, editing] = useActionState<SaveResult, FormData>(updateRateBand, {})

  const [previewW, setPreviewW] = useState(120)
  const [previewH, setPreviewH] = useState(160)

  const asBands: Band[] = useMemo(
    () => bands.map((b) => ({
      maxWidthTenths: b.maxWidthTenths,
      maxHeightTenths: b.maxHeightTenths,
      ratePaisePerSqIn: b.ratePaisePerSqIn,
    })),
    [bands],
  )

  const preview = useMemo(() => {
    try {
      const line = priceLine({
        widthTenths: previewW,
        heightTenths: previewH,
        qty: 1,
        material: {
          name: ownerName,
          limits: limits
            ? { minWidthTenths: 0, maxWidthTenths: 100_000, minHeightTenths: 0, maxHeightTenths: 100_000 }
            : { minWidthTenths: 0, maxWidthTenths: 100_000, minHeightTenths: 0, maxHeightTenths: 100_000 },
          bands: asBands,
        },
      })
      return { ok: true as const, line }
    } catch (e) {
      return { ok: false as const, message: e instanceof PriceError ? e.message : 'Cannot price this size.' }
    }
  }, [asBands, previewW, previewH, ownerName, limits])

  const sorted = [...bands].sort(
    (a, b) => a.maxWidthTenths * a.maxHeightTenths - b.maxWidthTenths * b.maxHeightTenths,
  )

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_240px]">
      <div>
        <table className="w-full text-left">
          <thead>
            <tr className="text-[10px] font-bold uppercase tracking-[0.05em] text-faint">
              <th className="pb-2">Up to</th>
              <th className="pb-2">Rate / sq·in</th>
              <th className="pb-2 text-right">—</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {sorted.map((b) => (
              <tr key={b.id}>
                <td className="py-2 text-[13px] text-body">
                  {fmtIn(b.maxWidthTenths)} × {fmtIn(b.maxHeightTenths)} in
                </td>
                <td className="py-2">
                  <form action={editAction} className="flex items-center gap-2">
                    <input type="hidden" name="kind" value={kind} />
                    <input type="hidden" name="id" value={b.id} />
                    <span className="text-body">₹</span>
                    <input
                      name="rate"
                      defaultValue={(b.ratePaisePerSqIn / 100).toFixed(2)}
                      inputMode="decimal"
                      aria-label={`Rate up to ${fmtIn(b.maxWidthTenths)} by ${fmtIn(b.maxHeightTenths)} inches`}
                      className="w-24 rounded-lg bg-subtle px-2 py-1 text-[13px] font-semibold text-ink"
                    />
                    <button disabled={editing} className="text-[11px] font-bold text-violet-deep disabled:opacity-50">
                      Save
                    </button>
                  </form>
                </td>
                <td className="py-2 text-right">
                  {(canDeleteLast || sorted.length > 1) && (
                    <form action={deleteRateBand}>
                      <input type="hidden" name="kind" value={kind} />
                      <input type="hidden" name="id" value={b.id} />
                      <input type="hidden" name="ownerId" value={ownerId} />
                      <button className="text-[11px] font-semibold text-faint hover:text-red-600">
                        Remove
                      </button>
                    </form>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {(addState.error || editState.error) && (
          <p className="mt-2 text-xs font-medium text-red-600">{addState.error ?? editState.error}</p>
        )}
        {(addState.ok || editState.ok) && !addState.error && !editState.error && (
          <p className="mt-2 text-xs font-medium text-emerald-700">{addState.ok ?? editState.ok}</p>
        )}

        <form action={addAction} className="mt-3 flex flex-wrap items-end gap-2">
          <input type="hidden" name="kind" value={kind} />
          <input type="hidden" name="ownerId" value={ownerId} />
          <Field label="Up to width (in)" name="maxWidth" placeholder="10" />
          <Field label="Up to height (in)" name="maxHeight" placeholder="10" />
          <Field label="Rate ₹/sq·in" name="rate" placeholder="4.00" />
          <button
            disabled={adding}
            className="rounded-full bg-ink px-4 py-[6px] text-[11px] font-bold text-page disabled:opacity-50"
          >
            {adding ? 'Adding…' : 'Add band'}
          </button>
        </form>
      </div>

      <div className="h-fit rounded-xl bg-subtle p-3">
        <p className="text-[10px] font-bold uppercase tracking-[0.05em] text-faint">What this charges</p>
        <div className="mt-2 flex items-center gap-1">
          <PreviewNum value={previewW} onChange={setPreviewW} label="Preview width" />
          <span className="text-body">×</span>
          <PreviewNum value={previewH} onChange={setPreviewH} label="Preview height" />
          <span className="text-[11px] text-faint">in</span>
        </div>
        <p className="mt-2 font-display text-xl font-extrabold text-ink">
          {preview.ok ? fmtInr(preview.line.framePaise) : '—'}
        </p>
        {preview.ok ? (
          <p className="text-[11px] leading-4 text-faint">
            {(previewW * previewH) / 100} sq·in at ₹{(preview.line.frameRatePaise / 100).toFixed(2)}
          </p>
        ) : (
          <p className="text-[11px] leading-4 text-red-600">{preview.message}</p>
        )}
      </div>
    </div>
  )
}

function Field({ label, name, placeholder }: { label: string; name: string; placeholder: string }) {
  return (
    <label className="flex flex-col">
      <span className="mb-1 text-[10px] font-bold uppercase tracking-[0.05em] text-faint">{label}</span>
      <input
        name={name}
        placeholder={placeholder}
        inputMode="decimal"
        className="w-28 rounded-lg bg-subtle px-2 py-1 text-[13px] text-ink"
      />
    </label>
  )
}

function PreviewNum({
  value,
  onChange,
  label,
}: {
  value: number
  onChange: (n: number) => void
  label: string
}) {
  return (
    <input
      type="number"
      aria-label={label}
      value={value / 10}
      min={1}
      step={1}
      onChange={(e) => onChange(Math.round(Number(e.target.value) * 10))}
      className="w-14 rounded-lg bg-surface px-2 py-1 text-[13px] font-semibold text-ink"
    />
  )
}
