'use client'

import { useMemo } from 'react'

// Cumulative-PnL sparkline for the last 30 days. Pure SVG, no dependency.
// The series argument is daily PnL deltas in USDC base units (6 dec).
// We integrate to a cumulative line because a daily-delta plot for sparse
// fills looks like a heart attack — the cumulative line tells the story.

interface PnlSparklineProps {
  /** Daily PnL deltas, oldest first, as bigint strings. */
  series: ReadonlyArray<{ ts: number; pnl: string }>
  width?: number
  height?: number
  className?: string
}

function safeBig(v: string): bigint {
  try { return BigInt(v) } catch { return 0n }
}

export function PnlSparkline({
  series,
  width = 240,
  height = 56,
  className = '',
}: PnlSparklineProps) {
  const { points, area, trend, last, first, min, max } = useMemo(() => {
    if (series.length === 0) {
      return { points: '', area: '', trend: 'flat' as const, last: 0n, first: 0n, min: 0n, max: 0n }
    }
    let cum = 0n
    const cumSeries: bigint[] = []
    for (const p of series) {
      cum += safeBig(p.pnl)
      cumSeries.push(cum)
    }
    const minB = cumSeries.reduce((a, b) => (a < b ? a : b), cumSeries[0]!)
    const maxB = cumSeries.reduce((a, b) => (a > b ? a : b), cumSeries[0]!)
    // Convert to scaled numbers for SVG. Map [min..max] → [height-padY..padY].
    const padY = height * 0.1
    const innerH = height - padY * 2
    const padX = 2
    const innerW = width - padX * 2
    const span = maxB - minB
    const stepX = cumSeries.length > 1 ? innerW / (cumSeries.length - 1) : 0
    const pts = cumSeries.map((v, i) => {
      const x = padX + i * stepX
      // Linear-scale the bigint: cast (v - min) / span to float by
      // first scaling to a 1e6 integer ratio.
      let normInt = 0
      if (span > 0n) {
        const scaled = ((v - minB) * 1_000_000n) / span
        normInt = Number(scaled)
      } else {
        normInt = 500_000
      }
      const norm = normInt / 1_000_000
      const y = padY + (1 - norm) * innerH
      return `${x.toFixed(2)},${y.toFixed(2)}`
    })
    const polyline = pts.join(' ')
    // Closed area under the line for a subtle fill.
    const lastX = padX + (cumSeries.length - 1) * stepX
    const fill = `${padX},${height} ${polyline} ${lastX.toFixed(2)},${height}`
    const lastVal = cumSeries[cumSeries.length - 1]!
    const firstVal = cumSeries[0]!
    const tr = lastVal > firstVal ? 'up' : lastVal < firstVal ? 'down' : 'flat'
    return {
      points: polyline,
      area: fill,
      trend: tr as 'up' | 'down' | 'flat',
      last: lastVal,
      first: firstVal,
      min: minB,
      max: maxB,
    }
  }, [series, width, height])

  if (series.length === 0) {
    return (
      <div
        className={['flex items-center justify-center text-[11px] font-mono text-zinc-600', className].join(' ')}
        style={{ width, height }}
      >
        no fills yet
      </div>
    )
  }

  const stroke =
    trend === 'up' ? '#34d399' :
    trend === 'down' ? '#fb7185' :
    '#a1a1aa'
  const fill =
    trend === 'up' ? 'rgba(16,185,129,0.10)' :
    trend === 'down' ? 'rgba(244,63,94,0.10)' :
    'rgba(161,161,170,0.08)'

  // Suppress unused destructure warnings — first/min/max kept for future
  // tooltip variants.
  void first
  void last
  void min
  void max

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      className={className}
      role="img"
      aria-label="30-day cumulative PnL trend"
    >
      <polygon points={area} fill={fill} stroke="none" />
      <polyline
        points={points}
        fill="none"
        stroke={stroke}
        strokeWidth={1.25}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}
