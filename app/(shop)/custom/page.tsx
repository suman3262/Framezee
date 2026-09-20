import Link from 'next/link'
import { loadThicknesses, loadMatBands } from '@/lib/frame-catalog.ts'
import { eq } from 'drizzle-orm'
import { db } from '@/db/index.ts'
import { glazingOptions, glazingRates, materialRates, materials } from '@/db/schema.ts'
import { Container } from '@/components/home/section-heading.tsx'
import { Studio, type Finish, type Glazing } from '@/components/studio/studio.tsx'
import { wallPresets, matColours } from '@/db/seed-data.ts'

export const metadata = {
  title: 'Build your own frame — Framezee',
  description: 'Any size from 4 × 4 to 40 × 60 in, cut and dispatched in five working days.',
}

export default async function CustomStudioPage() {
  const [materialRows, rateRows, glazingRows, glazingRateRows, thicknesses, matBands] = await Promise.all([
    db.select().from(materials).where(eq(materials.active, true)),
    db.select().from(materialRates).where(eq(materialRates.active, true)),
    db.select().from(glazingOptions).where(eq(glazingOptions.active, true)).orderBy(glazingOptions.sortOrder),
    db.select().from(glazingRates).where(eq(glazingRates.active, true)),
    loadThicknesses(),
    loadMatBands(),
  ])

  const finishes: Finish[] = materialRows.map((m) => ({
    id: m.id,
    slug: m.slug,
    name: m.name,
    swatch: m.swatch,
    description: m.description,
    limits: {
      minWidthTenths: m.minWidthTenths,
      maxWidthTenths: m.maxWidthTenths,
      minHeightTenths: m.minHeightTenths,
      maxHeightTenths: m.maxHeightTenths,
    },
    bands: rateRows
      .filter((r) => r.materialId === m.id)
      .map((r) => ({
        maxWidthTenths: r.maxWidthTenths,
        maxHeightTenths: r.maxHeightTenths,
        ratePaisePerSqIn: r.ratePaisePerSqIn,
      })),
  }))

  const glazings: Glazing[] = glazingRows.map((g) => ({
    id: g.id,
    name: g.name,
    description: g.description,
    included: g.included,
    bands: glazingRateRows
      .filter((r) => r.glazingOptionId === g.id)
      .map((r) => ({
        maxWidthTenths: r.maxWidthTenths,
        maxHeightTenths: r.maxHeightTenths,
        ratePaisePerSqIn: r.ratePaisePerSqIn,
      })),
  }))

  return (
    <Container className="py-6">
      <nav className="flex items-center gap-2 text-xs text-body">
        <Link href="/" className="hover:text-ink">Home</Link>
        <span className="text-faint">›</span>
        <Link href="/browse" className="hover:text-ink">Frames</Link>
        <span className="text-faint">›</span>
        <span className="text-ink">Custom framing</span>
      </nav>

      <h1 className="mt-3 font-display text-2xl font-bold tracking-[-0.02em] text-ink sm:text-3xl">
        Build your own frame
      </h1>
      <p className="mt-1 max-w-2xl text-sm text-body">
        Any size from 4 × 4 to 40 × 60 in. Price updates as you go — cut and dispatched in
        five working days.
      </p>

      <div className="mt-6">
        <Studio
              thicknesses={thicknesses}
              matBands={matBands}
          finishes={finishes}
          glazings={glazings}
          wallPresets={[...wallPresets]}
          matColours={[...matColours]}
        />
      </div>
    </Container>
  )
}
