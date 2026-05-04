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
//   · Curve: quadratic Bézier midpoint smoothing — clean, no overshoot, no library
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
 * Build a smooth path through points using quadratic Bezier curves.
 * Each segment ends at the midpoint between successive points — the classic
 * Apple Stocks smoothing. Clean, no overshoot, no library.
 */
function smoothPath(pts: ReadonlyArray<readonly [number, number]>): string {
  if (pts.length === 0) return ''
  if (pts.length === 1) return `M${pts[0][0]} ${pts[0][1]}`
  let d = `M${pts[0][0]} ${pts[0][1]}`
  for (let i = 1; i < pts.length - 1; i++) {
    const [x0, y0] = pts[i]
    const [x1, y1] = pts[i + 1]
    const mx = (x0 + x1) / 2
    const my = (y0 + y1) / 2
    d += ` Q${x0} ${y0} ${mx} ${my}`
  }
  const last = pts[pts.length - 1]
  d += ` T${last[0]} ${last[1]}`
  return d
}

function buildPath(
  series: number[],
  w: number,
  h: number,
): { line: string; area: string; lastPt: readonly [number, number] } {
  // 12px breathing room top + bottom — Apple never lets curves hit the SVG edge
  const padY = 12

  if (series.length < 2) {
    const midY = h / 2
    const flat = `M0 ${midY} L${w} ${midY}`
    return {
      line: flat,
      area: `${flat} L${w} ${h} L0 ${h} Z`,
      lastPt: [w, midY] as const,
    }
  }

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
  const { line, area, lastPt } = buildPath(series, width, height)
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
