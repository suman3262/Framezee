/**
 * Order intake over the last seven days — Figma's "Volume velocity" card.
 *
 * Plain SVG on purpose: a charting library would be the heaviest dependency in the
 * project for one sparkline that never needs zooming, panning or a legend. Each point
 * carries a <title>, so hovering still names the day and its takings.
 */

import { fmtInrRupees } from '@/lib/pricing.ts'

export type IntakePoint = { day: string; n: number; revenue: number }

const W = 320
const H = 120
const PAD = 8

export function IntakeChart({ series }: { series: IntakePoint[] }) {
  if (series.length === 0) return null

  // A flat run of zeros would divide by zero; a floor of 1 keeps the line on the floor.
  const max = Math.max(1, ...series.map((p) => p.n))
  const step = series.length > 1 ? (W - PAD * 2) / (series.length - 1) : 0
  const x = (i: number) => PAD + i * step
  const y = (n: number) => H - PAD - (n / max) * (H - PAD * 2)

  const line = series.map((p, i) => `${x(i)},${y(p.n)}`).join(' ')
  const area = `${PAD},${H} ${line} ${x(series.length - 1)},${H}`
  const peak = series.reduce((a, b, i) => (b.n >= series[a].n ? i : a), 0)

  return (
    <div className="mt-3">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="h-[120px] w-full"
        role="img"
        aria-label={`Orders per day over the last ${series.length} days`}
        preserveAspectRatio="none"
      >
        <defs>
          <linearGradient id="intake-fill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--violet)" stopOpacity="0.28" />
            <stop offset="100%" stopColor="var(--violet)" stopOpacity="0" />
          </linearGradient>
        </defs>

        {[0.25, 0.5, 0.75].map((f) => (
          <line
            key={f}
            x1={PAD}
            x2={W - PAD}
            y1={PAD + f * (H - PAD * 2)}
            y2={PAD + f * (H - PAD * 2)}
            stroke="var(--rule)"
            strokeDasharray="3 4"
          />
        ))}

        <polygon points={area} fill="url(#intake-fill)" />
        <polyline
          points={line}
          fill="none"
          stroke="var(--violet)"
          strokeWidth="2"
          strokeLinejoin="round"
          strokeLinecap="round"
          vectorEffect="non-scaling-stroke"
        />

        {series.map((p, i) => (
          <circle
            key={p.day + i}
            cx={x(i)}
            cy={y(p.n)}
            r={i === peak && p.n > 0 ? 4 : 3}
            fill={i === peak && p.n > 0 ? 'var(--violet)' : 'var(--card)'}
            stroke="var(--violet)"
            strokeWidth="2"
            vectorEffect="non-scaling-stroke"
          >
            <title>{`${p.day}: ${p.n} order${p.n === 1 ? '' : 's'} · ${fmtInrRupees(p.revenue)}`}</title>
          </circle>
        ))}
      </svg>

      <div className="mt-1 flex justify-between">
        {series.map((p, i) => (
          <span
            key={p.day + i}
            className={`text-[11px] ${i === peak && p.n > 0 ? 'font-semibold text-violet-deep' : 'text-t3'}`}
          >
            {p.day}
          </span>
        ))}
      </div>
    </div>
  )
}
