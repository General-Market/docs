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
 * Each segment ends at the midpoint between successive points and uses the
 * point itself as the control. This is the classic "smooth chart" trick from
 * Apple Stocks / Health: clean, no overshoot, no library dependency.
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

function buildPath(series: number[], w: number, h: number): { line: string; area: string } {
  if (series.length < 2) {
    const flat = `M0 ${h / 2} L${w} ${h / 2}`
    return { line: flat, area: `${flat} L${w} ${h} L0 ${h} Z` }
  }
  const min = Math.min(...series)
  const max = Math.max(...series)
  const range = max - min || 1
  const stepX = w / (series.length - 1)
  const padY = 4

  const pts: Array<readonly [number, number]> = series.map((v, i) => {
    const x = i * stepX
    const y = h - padY - ((v - min) / range) * (h - padY * 2)
    return [x, y] as const
  })

  const line = smoothPath(pts)
  const area = `${line} L${w} ${h} L0 ${h} Z`
  return { line, area }
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
  const { line, area } = buildPath(series, width, height)
  const fillColor = fill ?? stroke
  const gid = `apple-spark-${(stroke + (fill ?? '')).replace(/[^a-z0-9]/gi, '')}-${width}-${height}`

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
        <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={fillColor} stopOpacity="0.22" />
          <stop offset="100%" stopColor={fillColor} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={area} fill={`url(#${gid})`} />
      <path
        d={line}
        fill="none"
        stroke={stroke}
        strokeWidth={1.6}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

export const Sparkline = memo(SparklineImpl)
