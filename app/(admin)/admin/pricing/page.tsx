import { asc, eq, sql } from 'drizzle-orm'
import { db } from '@/db/index.ts'
import {
  glazingOptions,
  glazingRates,
  materialRates,
  materials,
  paperQualities,
  paperRates,
  products,
  settings,
  sizes,
  frameThicknesses,
  matRates,
} from '@/db/schema.ts'
import { requireSuperAdmin } from '@/lib/auth.ts'
import { AdminShell, Card, Icon } from '@/components/admin/shell.tsx'
import { RateCard, type RateRow } from '@/components/admin/rate-card.tsx'
import { SettingsForm } from '@/components/admin/settings-form.tsx'
import {
  AddMouldingButton,
  EditMouldingButton,
  AddGlazingButton,
  AddPaperButton,
  DeleteSimple,
} from '@/components/admin/material-forms.tsx'
import {
  AddSizeForm,
  AddThicknessForm,
  EditThickness,
  AddMatBandForm,
} from '@/components/admin/size-forms.tsx'
import { toggleMaterial, toggleGlazing, togglePaper } from '@/app/actions/pricing-admin.ts'
import { toggleSize, deleteSize, toggleThickness, deleteMatBand } from '@/app/actions/size-admin.ts'
import { OpenOnHash } from '@/components/admin/open-on-hash.tsx'
import { shapeOf } from '@/lib/frame-options.ts'
import { fmtIn } from '@/lib/pricing.ts'

/**
 * Four things live here, and the page used to show all of them expanded at once — six
 * mouldings times six bands meant nobody ever scrolled as far as Glazing. Each rate card
 * is now a <details>, closed by default, and the sections have jump links.
 */
export default async function PricingControl() {
  const staff = await requireSuperAdmin()

  const [materialRows, materialRateRows, paperRows, paperRateRows, glazingRows, glazingRateRows, [config], usage, sizeRows, thicknessRows, matBands] =
    await Promise.all([
      db.select().from(materials).orderBy(asc(materials.name)),
      db.select().from(materialRates),
      db.select().from(paperQualities).orderBy(asc(paperQualities.name)),
      db.select().from(paperRates),
      db.select().from(glazingOptions).orderBy(asc(glazingOptions.sortOrder)),
      db.select().from(glazingRates),
      db.select().from(settings).limit(1),
      db
        .select({ id: products.defaultMaterialId, n: sql<number>`count(*)::int` })
        .from(products)
        .groupBy(products.defaultMaterialId),
      db.select().from(sizes).orderBy(asc(sizes.sortOrder)),
      db.select().from(frameThicknesses).orderBy(asc(frameThicknesses.sortOrder)),
      db.select().from(matRates),
    ])

  const defaultFor = new Map(usage.map((u) => [u.id, u.n]))
  const offered = materialRows.filter((m) => m.active).length
  const hasIncluded = glazingRows.some((g) => g.included)

  const bandsFor = <T extends { id: string; maxWidthTenths: number; maxHeightTenths: number; ratePaisePerSqIn: number }>(
    rows: T[],
    match: (r: T) => boolean,
  ): RateRow[] =>
    rows.filter(match).map((r) => ({
      id: r.id,
      maxWidthTenths: r.maxWidthTenths,
      maxHeightTenths: r.maxHeightTenths,
      ratePaisePerSqIn: r.ratePaisePerSqIn,
    }))

  return (
    <AdminShell staff={staff} active="/admin/pricing" eyebrow="Pricing" title="Price & material control">
      <p className="max-w-3xl text-[13px] leading-[18px] text-t3">
        Every price in the shop is computed from these rate cards — nothing is stored on a
        product. Change a rate and the whole catalogue moves at once. Orders already placed
        keep their frozen prices and are never affected.
      </p>

      <OpenOnHash />

      <nav className="sticky top-16 z-20 -mx-4 flex gap-1 overflow-x-auto bg-page/90 px-4 py-2 backdrop-blur sm:-mx-6 sm:px-6">
        {[
          ['#mouldings', 'Mouldings', materialRows.length],
          ['#glazing', 'Glazing', glazingRows.length],
          ['#papers', 'Print papers', paperRows.length],
          ['#sizes', 'Sizes', sizeRows.length],
          ['#thickness', 'Thickness', thicknessRows.length],
          ['#mat', 'Mat board', matBands.length],
          ['#store', 'Delivery, tax & payment', null],
        ].map(([href, label, n]) => (
          <a
            key={href as string}
            href={href as string}
            className="flex shrink-0 items-center gap-[6px] rounded-lg bg-card px-3 py-[6px] text-[12px] font-semibold text-t2 shadow-sm hover:text-violet-deep"
          >
            {label}
            {n !== null && (
              <span className="rounded-full bg-subtle px-[6px] text-[11px] text-t3">{n as number}</span>
            )}
          </a>
        ))}
      </nav>

      {/* ── Mouldings ── */}
      <Section
        id="mouldings"
        title="Mouldings"
        note={`${offered} of ${materialRows.length} offered`}
        action={<AddMouldingButton />}
      >
        <div className="rounded-lg bg-info-bg px-3 py-2 text-[12px] leading-[17px] text-info">
          <Icon name="info" className="mr-1 align-[-3px] text-[15px]" />
          Every <strong>Offered</strong> moulding appears as a finish on <strong>every frame</strong>{' '}
          in the shop — mouldings are not attached to products one by one. A frame&rsquo;s
          &ldquo;preselected finish&rdquo; only decides which chip starts selected, and which
          rate card its &ldquo;from&rdquo; price is quoted against. Mark one Hidden to take it
          off every product page at once.
        </div>

        {materialRows.map((m) => {
          const bands = bandsFor(materialRateRows, (r) => r.materialId === m.id)
          const asDefault = defaultFor.get(m.id) ?? 0
          return (
            <Card key={m.id} className={`p-0 ${m.active ? '' : 'opacity-70'}`}>
              <div className="flex flex-wrap items-start justify-between gap-3 p-4">
                <span className="min-w-0">
                  <span className="flex flex-wrap items-center gap-2">
                    <span className="size-4 shrink-0 rounded ring-1 ring-black/10" style={{ background: m.swatch }} />
                    <span className="font-display text-[15px] font-bold text-t1">{m.name}</span>
                    <span className="rounded-full bg-subtle px-2 py-[1px] text-[11px] text-t3">{m.kind}</span>
                  </span>
                  <span className="mt-1 block text-[12px] text-t3">
                    GST {m.gstRateBp / 100}% · HSN {m.hsnCode ?? '—'} · makes{' '}
                    {fmtIn(m.minWidthTenths)}–{fmtIn(m.maxWidthTenths)} ×{' '}
                    {fmtIn(m.minHeightTenths)}–{fmtIn(m.maxHeightTenths)} in
                  </span>
                  <span className="mt-[2px] block text-[12px] text-t3">
                    {bands.length} rate band{bands.length === 1 ? '' : 's'} ·{' '}
                    {asDefault > 0 ? `default for ${asDefault} frame${asDefault === 1 ? '' : 's'}` : 'not a default'}
                    {m.active ? ' · offered on all frames' : ' · hidden from the shop'}
                  </span>
                </span>

                <span className="flex items-center gap-2">
                  <EditMouldingButton
                    usedBy={asDefault}
                    draft={{
                      id: m.id,
                      name: m.name,
                      kind: m.kind,
                      swatch: m.swatch,
                      description: m.description,
                      gstRatePercent: String(m.gstRateBp / 100),
                      hsnCode: m.hsnCode,
                      minWidth: fmtIn(m.minWidthTenths),
                      maxWidth: fmtIn(m.maxWidthTenths),
                      minHeight: fmtIn(m.minHeightTenths),
                      maxHeight: fmtIn(m.maxHeightTenths),
                    }}
                  />
                  <Toggle action={toggleMaterial} id={m.id} active={m.active} on="Offered" off="Hidden" />
                </span>
              </div>

              <Drawer summary={`Rate card · ${bands.length} band${bands.length === 1 ? '' : 's'}`}>
                <RateCard
                  kind="material"
                  ownerId={m.id}
                  ownerName={m.name}
                  bands={bands}
                  limits={{ maxWidthTenths: m.maxWidthTenths, maxHeightTenths: m.maxHeightTenths }}
                  canDeleteLast={false}
                />
              </Drawer>
            </Card>
          )
        })}
      </Section>

      {/* ── Glazing ── */}
      <Section
        id="glazing"
        title="Glazing"
        note="One is included in the frame price; the rest are upgrades"
        action={<AddGlazingButton hasIncluded={hasIncluded} />}
      >
        {glazingRows.map((g) => {
          const bands = bandsFor(glazingRateRows, (r) => r.glazingOptionId === g.id)
          return (
            <Card key={g.id} className={`p-0 ${g.active ? '' : 'opacity-70'}`}>
              <div className="flex flex-wrap items-start justify-between gap-3 p-4">
                <span className="min-w-0">
                  <span className="flex flex-wrap items-center gap-2">
                    <span className="font-display text-[15px] font-bold text-t1">{g.name}</span>
                    {g.included && (
                      <span className="rounded-full bg-violet-tint px-2 py-[1px] text-[11px] font-semibold text-violet-ink">
                        Included
                      </span>
                    )}
                  </span>
                  <span className="mt-1 block text-[12px] text-t3">{g.description}</span>
                  <span className="mt-[2px] block text-[12px] text-t3">
                    GST {g.gstRateBp / 100}% · HSN {g.hsnCode ?? '—'}
                  </span>
                </span>
                <span className="flex items-center gap-2">
                  {!g.included && <DeleteSimple id={g.id} name={g.name} kind="glazing" />}
                  <Toggle action={toggleGlazing} id={g.id} active={g.active} on="Offered" off="Hidden" />
                </span>
              </div>

              {g.included ? (
                <p className="border-t border-rule px-4 py-3 text-[12px] text-t3">
                  No rate card. Having no bands at all is exactly what makes this one free at
                  every size — it is still named on the invoice.
                </p>
              ) : (
                <Drawer summary={`Rate card · ${bands.length} band${bands.length === 1 ? '' : 's'}`}>
                  <RateCard kind="glazing" ownerId={g.id} ownerName={g.name} bands={bands} canDeleteLast />
                </Drawer>
              )}
            </Card>
          )
        })}
      </Section>

      {/* ── Print papers ── */}
      <Section
        id="papers"
        title="Print papers"
        note="Charged on top when a customer sends their own photo"
        action={<AddPaperButton />}
      >
        {paperRows.map((p) => {
          const bands = bandsFor(paperRateRows, (r) => r.paperQualityId === p.id)
          return (
            <Card key={p.id} className={`p-0 ${p.active ? '' : 'opacity-70'}`}>
              <div className="flex flex-wrap items-start justify-between gap-3 p-4">
                <span className="min-w-0">
                  <span className="font-display text-[15px] font-bold text-t1">{p.name}</span>
                  <span className="mt-1 block text-[12px] text-t3">{p.description}</span>
                  <span className="mt-[2px] block text-[12px] text-t3">
                    GST {p.gstRateBp / 100}% · HSN {p.hsnCode ?? '—'}
                  </span>
                </span>
                <span className="flex items-center gap-2">
                  <DeleteSimple id={p.id} name={p.name} kind="paper" />
                  <Toggle action={togglePaper} id={p.id} active={p.active} on="Offered" off="Hidden" />
                </span>
              </div>
              <Drawer summary={`Rate card · ${bands.length} band${bands.length === 1 ? '' : 's'}`}>
                <RateCard kind="paper" ownerId={p.id} ownerName={p.name} bands={bands} canDeleteLast />
              </Drawer>
            </Card>
          )
        })}
      </Section>

      {/* ── Sizes ── */}
      <Section
        id="sizes"
        collapsible
        title="Sizes"
        note="The ready-made size list. A frame offers whichever of these its moulding can cut."
      >
        <Card>
          <AddSizeForm />
        </Card>
        <Card className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[520px] text-left">
              <thead>
                <tr className="border-b border-rule bg-subtle text-[11px] font-semibold uppercase tracking-[0.03em] text-t3">
                  <th className="px-4 py-2">Size</th>
                  <th className="px-4 py-2">Shape</th>
                  <th className="px-4 py-2">Area</th>
                  <th className="px-4 py-2">Offered</th>
                  <th className="px-4 py-2 text-right">Remove</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-rule">
                {sizeRows.map((z) => (
                  <tr key={z.id} className={z.active ? '' : 'bg-subtle/40'}>
                    <td className="px-4 py-2 text-[13px] font-semibold text-t1">
                      {fmtIn(z.widthTenths)} × {fmtIn(z.heightTenths)} in
                    </td>
                    <td className="px-4 py-2 text-[12px] text-t3">
                      {shapeOf(z.widthTenths, z.heightTenths)}
                    </td>
                    <td className="px-4 py-2 text-[12px] text-t3">
                      {(z.widthTenths * z.heightTenths) / 100} sq-in
                    </td>
                    <td className="px-4 py-2">
                      <Toggle action={toggleSize} id={z.id} active={z.active} on="Offered" off="Hidden" />
                    </td>
                    <td className="px-4 py-2 text-right">
                      <form action={deleteSize}>
                        <input type="hidden" name="id" value={z.id} />
                        <button className="text-[11px] font-bold text-bad hover:underline">Remove</button>
                      </form>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
        <p className="text-[12px] leading-[17px] text-t3">
          Removing one is safe — order items store their own width and height, so nothing
          about a past order depends on this list. Custom sizes do not come from here; they
          are typed by the customer in the Custom Studio.
        </p>
      </Section>

      {/* ── Frame thickness ── */}
      <Section
        id="thickness"
        collapsible
        title="Frame thickness"
        note="A thin moulding bows under a large sheet of glazing, so it can be capped"
      >
        <Card>
          <AddThicknessForm />
        </Card>
        {thicknessRows.map((t) => (
          <Card key={t.id}>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <span>
                <span className="font-display text-[15px] font-bold text-t1">{t.label}</span>
                <span className="ml-2 font-mono text-[12px] text-t3">{fmtIn(t.tenths)} in</span>
                <span className="mt-[2px] block text-[12px] text-t3">
                  {t.maxLongTenths === null && t.maxShortTenths === null
                    ? 'Fits any size'
                    : `Only up to ${t.maxShortTenths === null ? 'any' : fmtIn(t.maxShortTenths)} × ${t.maxLongTenths === null ? 'any' : fmtIn(t.maxLongTenths)} in`}
                </span>
              </span>
              <span className="flex items-center gap-2">
                <EditThickness
                  id={t.id}
                  label={t.label}
                  maxLong={t.maxLongTenths === null ? '' : fmtIn(t.maxLongTenths)}
                  maxShort={t.maxShortTenths === null ? '' : fmtIn(t.maxShortTenths)}
                />
                <Toggle action={toggleThickness} id={t.id} active={t.active} on="Offered" off="Hidden" />
              </span>
            </div>
          </Card>
        ))}
      </Section>

      {/* ── Mat board ── */}
      <Section
        id="mat"
        collapsible
        title="Mat board"
        note={matBands.length === 0 ? 'Free at every size' : `${matBands.length} rate band${matBands.length === 1 ? '' : 's'}`}
        action={<AddMatBandForm hasBands={matBands.length > 0} />}
      >
        {matBands.length === 0 ? (
          <Card>
            <p className="text-[13px] leading-[18px] text-t2">
              The mat is <strong>free</strong> right now, because this rate card is empty —
              the same rule that makes the included glazing free.
            </p>
            <p className="mt-2 text-[12px] leading-[17px] text-t3">
              Add a band when you want to start charging for it. It applies to the whole shop
              at once: every basket reprices on its next load, and orders already placed keep
              the totals they were charged.
            </p>
          </Card>
        ) : (
          <Card className="p-0">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-rule bg-subtle text-[11px] font-semibold uppercase tracking-[0.03em] text-t3">
                  <th className="px-4 py-2">Up to</th>
                  <th className="px-4 py-2">Rate / sq-in</th>
                  <th className="px-4 py-2">A 12 × 16 in mat</th>
                  <th className="px-4 py-2 text-right">Remove</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-rule">
                {matBands.map((b) => (
                  <tr key={b.id}>
                    <td className="px-4 py-2 text-[13px] text-t1">
                      {fmtIn(b.maxWidthTenths)} × {fmtIn(b.maxHeightTenths)} in
                    </td>
                    <td className="px-4 py-2 text-[13px] font-semibold text-t1">
                      ₹{(b.ratePaisePerSqIn / 100).toFixed(2)}
                    </td>
                    <td className="px-4 py-2 text-[12px] text-t3">
                      ₹{((b.ratePaisePerSqIn * 192) / 100).toFixed(2)}
                    </td>
                    <td className="px-4 py-2 text-right">
                      <form action={deleteMatBand}>
                        <input type="hidden" name="id" value={b.id} />
                        <button className="text-[11px] font-bold text-bad hover:underline">Remove</button>
                      </form>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        )}
      </Section>

      {/* ── Store settings ── */}
      <Section id="store" title="Delivery, tax and payment">
        <Card>
          {config ? (
            <SettingsForm
              flatShippingPaise={config.flatShippingPaise}
              freeShippingThresholdPaise={config.freeShippingThresholdPaise}
              sellerGstin={config.sellerGstin}
              sellerState={config.sellerState}
              gstEnabled={config.gstEnabled}
              codEnabled={config.codEnabled}
            />
          ) : (
            <p className="text-[13px] text-t3">
              No settings row. Run <code className="font-mono">npm run seed</code>.
            </p>
          )}
        </Card>
      </Section>
    </AdminShell>
  )
}

/** Closed by default — the whole point of the reorganisation. */
function Drawer({ summary, children }: { summary: string; children: React.ReactNode }) {
  return (
    <details className="group border-t border-rule">
      <summary className="flex cursor-pointer list-none items-center gap-1 px-4 py-[10px] text-[12px] font-semibold text-violet-deep">
        <Icon name="expand_more" className="text-[16px] transition-transform group-open:rotate-180" />
        {summary}
      </summary>
      <div className="px-4 pb-4">{children}</div>
    </details>
  )
}

function Toggle({
  action,
  id,
  active,
  on,
  off,
}: {
  action: (form: FormData) => Promise<void>
  id: string
  active: boolean
  on: string
  off: string
}) {
  return (
    <form action={action}>
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="active" value={String(!active)} />
      <button
        className={`rounded-full px-3 py-1 text-[11px] font-semibold ${
          active ? 'bg-ok-bg text-ok' : 'bg-subtle text-t3'
        }`}
      >
        {active ? on : off}
      </button>
    </form>
  )
}

function Section({
  id,
  title,
  note,
  action,
  collapsible,
  children,
}: {
  id: string
  title: string
  note?: string
  action?: React.ReactNode
  /** Starts closed. OpenOnHash reopens it when a jump link points here. */
  collapsible?: boolean
  children: React.ReactNode
}) {
  const heading = (
    <span className="flex flex-wrap items-baseline gap-2">
      <h2 className="font-display text-xl font-bold text-t1">{title}</h2>
      {note && <span className="text-[12px] text-t3">{note}</span>}
    </span>
  )

  if (collapsible)
    return (
      <details id={id} className="group scroll-mt-32">
        <summary className="flex cursor-pointer list-none flex-wrap items-center justify-between gap-2 rounded-xl bg-card px-4 py-3 shadow-[0_1px_2px_rgba(0,0,0,0.05)]">
          <span className="flex items-center gap-2">
            <Icon
              name="chevron_right"
              className="text-[20px] text-t3 transition-transform group-open:rotate-90"
            />
            {heading}
          </span>
          <span className="text-[11px] font-semibold uppercase tracking-[0.03em] text-violet-deep group-open:hidden">
            Open
          </span>
        </summary>
        <div className="flex flex-col gap-3 pt-3">
          {action && <div className="flex justify-end">{action}</div>}
          {children}
        </div>
      </details>
    )

  return (
    <section id={id} className="flex scroll-mt-32 flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        {heading}
        {action}
      </div>
      {children}
    </section>
  )
}
