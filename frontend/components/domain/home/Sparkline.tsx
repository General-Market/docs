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

function buildPath(series: number[], w: number, h: number): { line: string; area: string } {
  if (series.length < 2) {
    const flat = `M0 ${h / 2} L${w} ${h / 2}`
    return { line: flat, area: `${flat} L${w} ${h} L0 ${h} Z` }
  }
  const min = Math.min(...series)
  const max = Math.max(...series)
  const range = max - min || 1
  const stepX = w / (series.length - 1)
  const padY = 2

  const pts = series.map((v, i) => {
    const x = i * stepX
    const y = h - padY - ((v - min) / range) * (h - padY * 2)
    return [x, y] as const
  })

  const line = pts
    .map(([x, y], i) => (i === 0 ? `M${x} ${y}` : `L${x} ${y}`))
    .join(' ')

  const area = `${line} L${w} ${h} L0 ${h} Z`
  return { line, area }
}

function SparklineImpl({
  series,
  width = 320,
  height = 64,
  stroke = 'var(--apple-accent)',
  fill = 'var(--apple-accent)',
  className,
  ariaLabel = 'sparkline',
}: SparklineProps) {
  const { line, area } = buildPath(series, width, height)
  const gradientId = `apple-spark-${stroke.replace(/[^a-z0-9]/gi, '')}`

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      width="100%"
      height={height}
      preserveAspectRatio="none"
      role="img"
      aria-label={ariaLabel}
      className={className}
    >
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={fill} stopOpacity="0.18" />
          <stop offset="100%" stopColor={fill} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={area} fill={`url(#${gradientId})`} />
      <path d={line} fill="none" stroke={stroke} strokeWidth={1.5} strokeLinecap="round" />
    </svg>
  )
}

export const Sparkline = memo(SparklineImpl)
