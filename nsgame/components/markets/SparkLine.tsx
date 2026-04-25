'use client'

// A 24h sparkline. Pure SVG, no axes, no fill, no dots.
// Renders nothing if there isn't enough data to draw a line —
// silence is preferable to a fake plot.

interface SparkLineProps {
  values: number[]
  width?: number
  height?: number
  trend?: 'up' | 'down' | 'flat'
  className?: string
}

const STROKE: Record<NonNullable<SparkLineProps['trend']>, string> = {
  up: '#10b981',     // emerald-500
  down: '#f43f5e',   // rose-500
  flat: '#a1a1aa',   // zinc-400
}

export function SparkLine({
  values,
  width = 60,
  height = 16,
  trend = 'flat',
  className = '',
}: SparkLineProps) {
  if (!values || values.length < 2) return null

  const min = Math.min(...values)
  const max = Math.max(...values)
  const range = max - min || 1

  // 5% vertical padding so endpoints don't kiss the edge.
  const padY = height * 0.05
  const innerH = height - padY * 2

  const stepX = values.length > 1 ? width / (values.length - 1) : 0

  const points = values
    .map((v, i) => {
      const x = i * stepX
      const norm = (v - min) / range
      // Invert Y — SVG origin is top-left.
      const y = padY + (1 - norm) * innerH
      return `${x.toFixed(2)},${y.toFixed(2)}`
    })
    .join(' ')

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      className={className}
      role="img"
      aria-label="24h trend"
    >
      <polyline
        points={points}
        fill="none"
        stroke={STROKE[trend]}
        strokeWidth={1}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}
