'use client'

import { useMemo } from 'react'

interface SparklineHeaderProps {
  marketIds: string[]
}

/** Generate a synthetic sparkline path with a trend direction */
function generateSparklinePoints(
  seed: number,
  width: number,
  height: number,
  points: number,
  padding: number
): { path: string; trending: 'up' | 'down' } {
  // Seeded pseudo-random for deterministic visuals per market
  let s = seed
  const rand = () => {
    s = (s * 16807 + 0) % 2147483647
    return (s & 0x7fffffff) / 0x7fffffff
  }

  const yMin = padding
  const yMax = height - padding
  const yRange = yMax - yMin
  const xStep = (width - padding * 2) / (points - 1)

  // Random walk with drift
  const drift = rand() > 0.5 ? 0.3 : -0.3
  const values: number[] = []
  let val = yMin + yRange * 0.5

  for (let i = 0; i < points; i++) {
    val += (rand() - 0.5 + drift) * yRange * 0.08
    val = Math.max(yMin, Math.min(yMax, val))
    values.push(val)
  }

  // Invert Y so "up" in value = up visually (SVG Y is inverted)
  const trending = values[values.length - 1] < values[0] ? 'up' : 'down'

  const pathParts = values.map((y, i) => {
    const x = padding + i * xStep
    return `${i === 0 ? 'M' : 'L'} ${x.toFixed(1)} ${y.toFixed(1)}`
  })

  return { path: pathParts.join(' '), trending }
}

/** Hash a string to a numeric seed */
function hashStr(s: string): number {
  let h = 0
  for (let i = 0; i < s.length; i++) {
    h = ((h << 5) - h + s.charCodeAt(i)) | 0
  }
  return Math.abs(h)
}

export function SparklineHeader({ marketIds }: SparklineHeaderProps) {
  const sparklines = useMemo(() => {
    const count = marketIds.length
    const perWidth = Math.floor(300 / Math.max(count, 1))
    return marketIds.map((id) => {
      const seed = hashStr(id)
      const { path, trending } = generateSparklinePoints(seed, perWidth, 56, 20, 4)
      return { id, path, trending, width: perWidth }
    })
  }, [marketIds])

  return (
    <div className="h-16 bg-surface rounded mb-3 flex items-center justify-around px-2 overflow-hidden">
      {sparklines.map((sp) => (
        <div key={sp.id} className="flex flex-col items-center gap-0.5">
          <svg
            width={sp.width}
            height={56}
            viewBox={`0 0 ${sp.width} 56`}
            className="overflow-visible"
          >
            {/* Gradient fill under the line */}
            <defs>
              <linearGradient id={`grad-${sp.id}`} x1="0" y1="0" x2="0" y2="1">
                <stop
                  offset="0%"
                  stopColor={sp.trending === 'up' ? '#16A34A' : '#DC2626'}
                  stopOpacity={0.15}
                />
                <stop
                  offset="100%"
                  stopColor={sp.trending === 'up' ? '#16A34A' : '#DC2626'}
                  stopOpacity={0}
                />
              </linearGradient>
            </defs>
            {/* Fill area */}
            <path
              d={`${sp.path} L ${sp.width - 4} 52 L 4 52 Z`}
              fill={`url(#grad-${sp.id})`}
            />
            {/* Sparkline stroke */}
            <path
              d={sp.path}
              fill="none"
              stroke={sp.trending === 'up' ? '#16A34A' : '#DC2626'}
              strokeWidth={1.5}
              strokeLinecap="round"
              strokeLinejoin="round"
              className="sparkline-animate"
            />
          </svg>
          <span className="text-[8px] font-mono text-text-muted truncate max-w-[50px]">
            {sp.id}
          </span>
        </div>
      ))}

      <style jsx>{`
        .sparkline-animate {
          stroke-dasharray: 500;
          stroke-dashoffset: 500;
          animation: sparkline-draw 1.2s ease-out forwards;
        }
        @keyframes sparkline-draw {
          to {
            stroke-dashoffset: 0;
          }
        }
      `}</style>
    </div>
  )
}
