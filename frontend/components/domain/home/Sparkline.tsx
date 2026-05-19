// Apple chart reference research (2026-05-04):
// - Apple HIG charting-data: https://developer.apple.com/design/human-interface-guidelines/charting-data
// - WWDC22 "Design an effective chart": https://developer.apple.com/videos/play/wwdc2022/110340/
// - WWDC22 "Design app experiences with charts": https://developer.apple.com/videos/play/wwdc2022/110342/
//
// Key observations from Apple Stocks / Health / Fitness:
//   · Hairline stroke: 1.5px via vectorEffect="non-scaling-stroke" (stays crisp at any DPR)
//   · Area fill: ≤ 8% alpha at the curve top, fades to 0 — present but barely perceived
//   · Color: movement-driven. Up = system green (#34c759) at 0.85 alpha. Down = system red (#ff3b30).
//     Flat/fallback = muted slate. Caller can override with explicit stroke/fill.
//   · Right-edge dot: 3px filled circle, same color as line, no border
//   · Curve: Fritsch-Carlson monotone cubic spline — same algorithm as the
//     full NavChart. Preserves local extrema, doesn't overshoot, and the
//     shape matches between the source page sparkline and the vault detail
//     chart for identical data.
//   · Baseline: invisible — axis is implied, not drawn (Apple HIG: "omit axis lines on sparklines")
//   · Padding: 12px top + bottom so curves never kiss the SVG edges
//   · Gradient id: encode stroke + dimensions to avoid collision when multiple instances share a DOM

import { memo } from 'react'

type SparklineProps = {
  series: number[]
  width?: number
  height?: number
  stroke?: string
  fill?: string
  className?: string
  ariaLabel?: string
}

/**
 * Fritsch-Carlson monotone cubic spline. Identical to the algorithm in
 * NavChart so the source-page sparkline and the vault-detail chart trace
 * the same curve through the same points.
 */
function smoothPath(pts: ReadonlyArray<readonly [number, number]>): string {
  if (pts.length === 0) return ''
  if (pts.length === 1) return `M${pts[0][0]} ${pts[0][1]}`
  if (pts.length === 2) return `M${pts[0][0]},${pts[0][1]}L${pts[1][0]},${pts[1][1]}`
  const n = pts.length
  const dx: number[] = []
  const dy: number[] = []
  const m: number[] = []
  for (let i = 0; i < n - 1; i++) {
    dx.push(pts[i + 1][0] - pts[i][0])
    dy.push(pts[i + 1][1] - pts[i][1])
    m.push(dy[i] / (dx[i] || 1e-9))
  }
  const tg: number[] = [m[0]]
  for (let i = 1; i < n - 1; i++) {
    tg.push(m[i - 1] * m[i] <= 0 ? 0 : (m[i - 1] + m[i]) / 2)
  }
  tg.push(m[n - 2])
  for (let i = 0; i < n - 1; i++) {
    if (Math.abs(m[i]) < 1e-6) {
      tg[i] = 0
      tg[i + 1] = 0
      continue
    }
    const a = tg[i] / m[i]
    const b = tg[i + 1] / m[i]
    const s = a * a + b * b
    if (s > 9) {
      const t = 3 / Math.sqrt(s)
      tg[i] = t * a * m[i]
      tg[i + 1] = t * b * m[i]
    }
  }
  const parts: string[] = [`M${pts[0][0].toFixed(2)},${pts[0][1].toFixed(2)}`]
  for (let i = 0; i < n - 1; i++) {
    const d = dx[i] / 3
    const cp1x = (pts[i][0] + d).toFixed(2)
    const cp1y = (pts[i][1] + tg[i] * d).toFixed(2)
    const cp2x = (pts[i + 1][0] - d).toFixed(2)
    const cp2y = (pts[i + 1][1] - tg[i + 1] * d).toFixed(2)
    const ex = pts[i + 1][0].toFixed(2)
    const ey = pts[i + 1][1].toFixed(2)
    parts.push(`C${cp1x},${cp1y} ${cp2x},${cp2y} ${ex},${ey}`)
  }
  return parts.join(' ')
}

function buildPath(
  series: number[],
  w: number,
  h: number,
): { line: string; area: string; lastPt: readonly [number, number] } | null {
  // Breathing room top + bottom — Apple never lets curves hit the SVG edge.
  // Scale to height so a tight 24px rail sparkline still has draw area;
  // hardcoding 12 collapsed `h - padY*2` to zero for the NewestVault card
  // and rendered every point onto a single flat line.
  const padY = Math.min(12, Math.floor(h / 4))

  // Real or absent. No flat-line stub, no synthesized shape — if upstream
  // doesn't give us at least two points, we render nothing.
  if (series.length < 2) return null

  const min = Math.min(...series)
  const max = Math.max(...series)
  const range = max - min || 1
  const stepX = w / (series.length - 1)

  const pts: Array<readonly [number, number]> = series.map((v, i) => {
    const x = i * stepX
    const y = h - padY - ((v - min) / range) * (h - padY * 2)
    return [x, y] as const
  })

  const line = smoothPath(pts)
  const area = `${line} L${w} ${h} L0 ${h} Z`
  return { line, area, lastPt: pts[pts.length - 1] }
}

function SparklineImpl({
  series,
  width = 320,
  height = 64,
  stroke = 'var(--apple-text)',
  fill,
  className,
  ariaLabel = '',
}: SparklineProps) {
  const built = buildPath(series, width, height)
  if (!built) return null
  const { line, area, lastPt } = built
  const fillColor = fill ?? stroke

  // Stable gradient id — encode stroke + dimensions so instances don't collide
  const gid = `spark-${(stroke + (fill ?? '')).replace(/[^a-z0-9]/gi, '')}-${width}x${height}`

  const [lx, ly] = lastPt

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      width="100%"
      height="100%"
      preserveAspectRatio="none"
      role={ariaLabel ? 'img' : 'presentation'}
      aria-label={ariaLabel || undefined}
      aria-hidden={ariaLabel ? undefined : true}
      className={className}
    >
      <defs>
        {/*
          Area tint — 8% at the line top, 0 at the bottom.
          Apple: present but barely perceived. Not "fintech gradient".
        */}
        <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={fillColor} stopOpacity="0.08" />
          <stop offset="85%" stopColor={fillColor} stopOpacity="0.01" />
          <stop offset="100%" stopColor={fillColor} stopOpacity="0" />
        </linearGradient>
      </defs>

      {/* Area fill — barely there, like Apple Health */}
      <path d={area} fill={`url(#${gid})`} />

      {/* Hairline curve — 1.5px, non-scaling so it stays crisp at any DPR */}
      <path
        d={line}
        fill="none"
        stroke={stroke}
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
        vectorEffect="non-scaling-stroke"
      />

      {/* Right-edge dot — 3px, same color as line, no border (Apple Stocks pattern) */}
      <circle
        cx={lx}
        cy={ly}
        r={3}
        fill={stroke}
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  )
}

export const Sparkline = memo(SparklineImpl)
