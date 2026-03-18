'use client'

import { useMemo, useState, useRef, useEffect } from 'react'
import type { SectionProps } from '../SectionRenderer'

const COLORS = [
  '#1a1a2e', '#e94560', '#0f3460', '#f97316', '#06b6d4',
  '#8b5cf6', '#ec4899', '#14b8a6', '#f59e0b', '#3b82f6',
  '#94a3b8',
]

export function PortfolioBreakdown({ enrichment }: SectionProps) {
  const holdings = enrichment?.holdings ?? []

  const data = useMemo(() => {
    if (holdings.length === 0) return []
    const sorted = [...holdings].sort((a, b) => b.weight - a.weight)
    const top10 = sorted.slice(0, 10).map(h => ({
      name: h.symbol,
      value: Math.round(h.weight * 10000) / 100,
    }))
    const otherWeight = sorted.slice(10).reduce((s, h) => s + h.weight, 0)
    if (otherWeight > 0) {
      top10.push({ name: 'Other', value: Math.round(otherWeight * 10000) / 100 })
    }
    return top10
  }, [holdings])

  if (data.length === 0) return null

  return (
    <section>
      <h2 className="text-2xl font-bold text-text-primary mb-6">
        Portfolio Composition
      </h2>
      <div className="py-4">
        <div className="flex flex-col md:flex-row items-center gap-8">
          <div className="w-64 h-64 flex-shrink-0">
            <AnimatedDonut data={data} />
          </div>

          <div className="flex-1 grid grid-cols-2 gap-x-6 gap-y-1.5">
            {data.map((d, i) => (
              <div key={d.name} className="flex items-center gap-2 text-sm fluid-press cursor-default">
                <div
                  className="w-3 h-3 rounded-sm flex-shrink-0"
                  style={{ backgroundColor: COLORS[i % COLORS.length] }}
                />
                <span className="text-text-secondary truncate">{d.name}</span>
                <span className="ml-auto font-mono tabular-nums text-text-primary">
                  {d.value.toFixed(1)}%
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}

// ── Animated SVG donut — segments arc in on viewport entry ──
function AnimatedDonut({ data }: { data: { name: string; value: number }[] }) {
  const [revealed, setRevealed] = useState(false)
  const [hovIdx, setHovIdx] = useState<number | null>(null)
  const svgRef = useRef<SVGSVGElement>(null)

  useEffect(() => {
    const el = svgRef.current; if (!el) return
    const obs = new IntersectionObserver(([e]) => {
      if (e.isIntersecting) { setRevealed(true); obs.disconnect() }
    }, { threshold: 0.3 })
    obs.observe(el)
    return () => obs.disconnect()
  }, [])

  const size = 256
  const cx = size / 2
  const cy = size / 2
  const r = 80
  const sw = 40
  const C = 2 * Math.PI * r

  const total = data.reduce((s, d) => s + d.value, 0)
  let cumDeg = 0
  const segs = data.map((d, i) => {
    const frac = d.value / total
    const arc = frac * C + 0.5 // tiny overlap prevents hairline gaps
    const start = cumDeg
    cumDeg += frac * 360
    return { name: d.name, value: d.value, arc, start, color: COLORS[i % COLORS.length] }
  })

  return (
    <svg
      ref={svgRef}
      viewBox={`0 0 ${size} ${size}`}
      width="100%"
      height="100%"
      className="overflow-visible"
    >
      <g transform={`rotate(-90, ${cx}, ${cy})`}>
        {segs.map((seg, i) => (
          <circle
            key={seg.name}
            cx={cx}
            cy={cy}
            r={r}
            fill="none"
            stroke={seg.color}
            strokeWidth={hovIdx === i ? sw + 6 : sw}
            strokeDasharray={revealed ? `${seg.arc} ${C}` : `0 ${C}`}
            transform={`rotate(${seg.start}, ${cx}, ${cy})`}
            style={{
              transition: 'stroke-dasharray 0.8s var(--ease-out-expo), stroke-width 0.2s ease',
              transitionDelay: revealed ? `${i * 80}ms` : '0ms',
              cursor: 'pointer',
            }}
            onMouseEnter={() => setHovIdx(i)}
            onMouseLeave={() => setHovIdx(null)}
          />
        ))}
      </g>

      {/* Center text on hover */}
      {hovIdx != null && (
        <g style={{ pointerEvents: 'none' }}>
          <text
            x={cx}
            y={cy - 8}
            textAnchor="middle"
            dominantBaseline="middle"
            style={{ fontSize: 13, fontWeight: 600, fill: '#555' }}
          >
            {segs[hovIdx].name}
          </text>
          <text
            x={cx}
            y={cy + 14}
            textAnchor="middle"
            dominantBaseline="middle"
            style={{
              fontSize: 20,
              fontWeight: 800,
              fill: '#1a1a1a',
              fontFamily: 'var(--mono)',
              fontFeatureSettings: "'tnum' 1",
            }}
          >
            {segs[hovIdx].value.toFixed(1)}%
          </text>
        </g>
      )}
    </svg>
  )
}
