'use client'

import { useState, useRef, useCallback, useEffect } from 'react'

interface HistoryEntry {
  date: string
  value: number
  classification: string
}

type TimeRange = '30d' | '90d' | '1y'

const RANGES: { key: TimeRange; label: string; days: number }[] = [
  { key: '30d', label: '30D', days: 30 },
  { key: '90d', label: '90D', days: 90 },
  { key: '1y', label: '1Y', days: 365 },
]

// Zone colors matching the server component
function getColor(value: number): string {
  if (value <= 25) return '#DC2626'
  if (value <= 40) return '#EA580C'
  if (value <= 60) return '#6B7280'
  if (value <= 75) return '#16A34A'
  return '#15803D'
}

function getClassification(value: number): string {
  if (value <= 25) return 'Extreme Fear'
  if (value <= 40) return 'Fear'
  if (value <= 60) return 'Neutral'
  if (value <= 75) return 'Greed'
  return 'Extreme Greed'
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00')
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function formatDateFull(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00')
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

export function FearGreedChart({ history }: { history: HistoryEntry[] }) {
  const [range, setRange] = useState<TimeRange>('90d')
  const [tooltip, setTooltip] = useState<{
    x: number
    y: number
    entry: HistoryEntry
  } | null>(null)
  const svgRef = useRef<SVGSVGElement>(null)

  const rangeConfig = RANGES.find((r) => r.key === range)!
  const data = history.slice(-rangeConfig.days)

  // Chart dimensions
  const CHART_WIDTH = 800
  const CHART_HEIGHT = 300
  const PADDING_LEFT = 40
  const PADDING_RIGHT = 16
  const PADDING_TOP = 16
  const PADDING_BOTTOM = 32
  const plotWidth = CHART_WIDTH - PADDING_LEFT - PADDING_RIGHT
  const plotHeight = CHART_HEIGHT - PADDING_TOP - PADDING_BOTTOM

  // Map data to coordinates
  const points = data.map((entry, i) => ({
    x: PADDING_LEFT + (i / Math.max(data.length - 1, 1)) * plotWidth,
    y: PADDING_TOP + plotHeight - (entry.value / 100) * plotHeight,
    entry,
  }))

  // Build the line path
  const linePath =
    points.length > 0
      ? points.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x},${p.y}`).join(' ')
      : ''

  // Build the fill path (area under line with gradient zones)
  const fillPath =
    points.length > 0
      ? `${linePath} L${points[points.length - 1].x},${PADDING_TOP + plotHeight} L${points[0].x},${PADDING_TOP + plotHeight} Z`
      : ''

  // Y-axis labels
  const yLabels = [0, 25, 50, 75, 100]

  // X-axis labels — pick ~6 evenly spaced
  const xLabelCount = 6
  const xLabels: { x: number; label: string }[] = []
  if (data.length > 0) {
    for (let i = 0; i < xLabelCount; i++) {
      const idx = Math.round((i / (xLabelCount - 1)) * (data.length - 1))
      xLabels.push({
        x: PADDING_LEFT + (idx / Math.max(data.length - 1, 1)) * plotWidth,
        label: formatDate(data[idx].date),
      })
    }
  }

  // Handle mouse/touch interaction
  const handleInteraction = useCallback(
    (clientX: number) => {
      const svg = svgRef.current
      if (!svg || points.length === 0) return

      const rect = svg.getBoundingClientRect()
      const scaleX = CHART_WIDTH / rect.width
      const mouseX = (clientX - rect.left) * scaleX

      // Find the closest data point
      let closest = points[0]
      let minDist = Math.abs(mouseX - closest.x)
      for (let i = 1; i < points.length; i++) {
        const dist = Math.abs(mouseX - points[i].x)
        if (dist < minDist) {
          minDist = dist
          closest = points[i]
        }
      }

      if (mouseX >= PADDING_LEFT - 10 && mouseX <= CHART_WIDTH - PADDING_RIGHT + 10) {
        setTooltip({ x: closest.x, y: closest.y, entry: closest.entry })
      } else {
        setTooltip(null)
      }
    },
    [points]
  )

  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => handleInteraction(e.clientX),
    [handleInteraction]
  )

  const handleTouchMove = useCallback(
    (e: React.TouchEvent) => {
      if (e.touches.length > 0) handleInteraction(e.touches[0].clientX)
    },
    [handleInteraction]
  )

  const handleLeave = useCallback(() => setTooltip(null), [])

  // Close tooltip on scroll (mobile)
  useEffect(() => {
    const onScroll = () => setTooltip(null)
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  return (
    <div>
      {/* Range toggles */}
      <div className="flex items-center gap-2 mb-4">
        {RANGES.map((r) => (
          <button
            key={r.key}
            onClick={() => { setRange(r.key); setTooltip(null) }}
            className={`px-4 py-1.5 text-[13px] font-semibold rounded-lg transition-colors ${
              range === r.key
                ? 'bg-black text-white'
                : 'bg-surface text-text-secondary hover:text-black hover:bg-gray-200'
            }`}
          >
            {r.label}
          </button>
        ))}
      </div>

      {/* Chart */}
      <div className="bg-white rounded-xl border border-border-light p-4 overflow-hidden">
        <svg
          ref={svgRef}
          viewBox={`0 0 ${CHART_WIDTH} ${CHART_HEIGHT}`}
          className="w-full h-auto select-none"
          onMouseMove={handleMouseMove}
          onMouseLeave={handleLeave}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleLeave}
          style={{ touchAction: 'pan-y' }}
        >
          <defs>
            {/* Gradient fill for the area */}
            <linearGradient id="fng-area-gradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#15803D" stopOpacity="0.15" />
              <stop offset="25%" stopColor="#16A34A" stopOpacity="0.12" />
              <stop offset="50%" stopColor="#6B7280" stopOpacity="0.08" />
              <stop offset="75%" stopColor="#EA580C" stopOpacity="0.10" />
              <stop offset="100%" stopColor="#DC2626" stopOpacity="0.15" />
            </linearGradient>
          </defs>

          {/* Zone backgrounds — subtle horizontal bands */}
          {[
            { y1: 0, y2: 25, color: '#15803D', opacity: 0.04 },
            { y1: 25, y2: 40, color: '#16A34A', opacity: 0.03 },
            { y1: 40, y2: 60, color: '#6B7280', opacity: 0.03 },
            { y1: 60, y2: 75, color: '#EA580C', opacity: 0.03 },
            { y1: 75, y2: 100, color: '#DC2626', opacity: 0.04 },
          ].map((zone) => (
            <rect
              key={zone.y1}
              x={PADDING_LEFT}
              y={PADDING_TOP + plotHeight - (zone.y2 / 100) * plotHeight}
              width={plotWidth}
              height={((zone.y2 - zone.y1) / 100) * plotHeight}
              fill={zone.color}
              opacity={zone.opacity}
            />
          ))}

          {/* Grid lines */}
          {yLabels.map((v) => {
            const y = PADDING_TOP + plotHeight - (v / 100) * plotHeight
            return (
              <g key={v}>
                <line
                  x1={PADDING_LEFT}
                  y1={y}
                  x2={CHART_WIDTH - PADDING_RIGHT}
                  y2={y}
                  stroke="#E5E7EB"
                  strokeWidth="1"
                />
                <text
                  x={PADDING_LEFT - 8}
                  y={y + 4}
                  textAnchor="end"
                  className="text-[11px]"
                  fill="#999"
                >
                  {v}
                </text>
              </g>
            )
          })}

          {/* Area fill */}
          {fillPath && (
            <path d={fillPath} fill="url(#fng-area-gradient)" />
          )}

          {/* Line — segmented by color */}
          {points.length > 1 &&
            points.slice(1).map((p, i) => (
              <line
                key={i}
                x1={points[i].x}
                y1={points[i].y}
                x2={p.x}
                y2={p.y}
                stroke={getColor(p.entry.value)}
                strokeWidth="2"
                strokeLinecap="round"
              />
            ))}

          {/* X-axis labels */}
          {xLabels.map((lbl, i) => (
            <text
              key={i}
              x={lbl.x}
              y={CHART_HEIGHT - 4}
              textAnchor="middle"
              className="text-[10px]"
              fill="#999"
            >
              {lbl.label}
            </text>
          ))}

          {/* Tooltip crosshair + dot */}
          {tooltip && (
            <>
              <line
                x1={tooltip.x}
                y1={PADDING_TOP}
                x2={tooltip.x}
                y2={PADDING_TOP + plotHeight}
                stroke="#D4D4D8"
                strokeWidth="1"
                strokeDasharray="3,3"
              />
              <circle
                cx={tooltip.x}
                cy={tooltip.y}
                r="5"
                fill={getColor(tooltip.entry.value)}
                stroke="white"
                strokeWidth="2"
              />
            </>
          )}
        </svg>

        {/* Tooltip card */}
        {tooltip && (
          <div className="flex items-center justify-center gap-4 mt-3 py-2 px-4 bg-surface rounded-lg">
            <span className="text-[13px] text-text-secondary">
              {formatDateFull(tooltip.entry.date)}
            </span>
            <span
              className="text-[15px] font-bold"
              style={{ color: getColor(tooltip.entry.value) }}
            >
              {tooltip.entry.value}
            </span>
            <span
              className="text-[12px] font-semibold"
              style={{ color: getColor(tooltip.entry.value) }}
            >
              {tooltip.entry.classification || getClassification(tooltip.entry.value)}
            </span>
          </div>
        )}
      </div>
    </div>
  )
}
