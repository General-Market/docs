'use client'

import { useState, useMemo, useRef, useEffect, useCallback } from 'react'
import { useReducedMotion } from 'framer-motion'

// ── Deterministic PRNG ─────────────────────────────────────

function hashAddress(addr: string): number {
  let h = 0
  for (let i = 0; i < addr.length; i++) h = ((h << 5) - h + addr.charCodeAt(i)) | 0
  return Math.abs(h)
}

function seededRng(seed: number) {
  let s = seed
  return () => {
    s = (s * 16807 + 0) % 2147483647
    return (s & 0x7fffffff) / 0x7fffffff
  }
}

export function generateNavHistory(currentNav: number, vaultAddr: string, points = 30): number[] {
  const start = 1.0
  const end = currentNav
  const rand = seededRng(hashAddress(vaultAddr))
  const data: number[] = []
  for (let i = 0; i < points; i++) {
    const t = i / (points - 1)
    const base = start + (end - start) * (t * t * (3 - 2 * t))
    const noiseMag = 0.012 * Math.sin(Math.PI * t)
    const noise = noiseMag * (rand() - 0.5) * 2
    data.push(base + noise)
  }
  data[data.length - 1] = end
  return data
}

// ── Monotone cubic spline (Fritsch-Carlson) ────────────────

function monotonePath(pts: { x: number; y: number }[]): string {
  if (pts.length < 2) return ''
  if (pts.length === 2) return `M${pts[0].x},${pts[0].y}L${pts[1].x},${pts[1].y}`
  const n = pts.length
  const dx: number[] = []
  const dy: number[] = []
  const m: number[] = []
  for (let i = 0; i < n - 1; i++) {
    dx.push(pts[i + 1].x - pts[i].x)
    dy.push(pts[i + 1].y - pts[i].y)
    m.push(dy[i] / dx[i])
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
  const parts = [`M${pts[0].x.toFixed(2)},${pts[0].y.toFixed(2)}`]
  for (let i = 0; i < n - 1; i++) {
    const d = dx[i] / 3
    const cp1x = (pts[i].x + d).toFixed(2)
    const cp1y = (pts[i].y + tg[i] * d).toFixed(2)
    const cp2x = (pts[i + 1].x - d).toFixed(2)
    const cp2y = (pts[i + 1].y - tg[i + 1] * d).toFixed(2)
    const ex = pts[i + 1].x.toFixed(2)
    const ey = pts[i + 1].y.toFixed(2)
    parts.push(`C${cp1x},${cp1y} ${cp2x},${cp2y} ${ex},${ey}`)
  }
  return parts.join(' ')
}

function estimatePathLength(pts: { x: number; y: number }[]): number {
  let len = 0
  for (let i = 1; i < pts.length; i++) {
    const ddx = pts[i].x - pts[i - 1].x
    const ddy = pts[i].y - pts[i - 1].y
    len += Math.sqrt(ddx * ddx + ddy * ddy)
  }
  return len * 1.12
}

let navChartIdCounter = 0
function useChartId() {
  const ref = useRef<string>('')
  if (!ref.current) ref.current = `nav-${++navChartIdCounter}`
  return ref.current
}

// ── Chart constants ────────────────────────────────────────

const CHART_W = 500
const CHART_H = 300
const CHART_PAD_T = 16
const CHART_PAD_B = 32
const CHART_PAD_L = 40
const CHART_PAD_R = 8
const CHART_PLOT_W = CHART_W - CHART_PAD_L - CHART_PAD_R
const CHART_PLOT_H = CHART_H - CHART_PAD_T - CHART_PAD_B
const DRAW_DURATION = 900
const MONO_FONT = 'ui-monospace, SFMono-Regular, Menlo, monospace'

// ── Interactive NAV Chart ──────────────────────────────────

export function NavChart({ data, vaultAddr, timestamps }: { data: number[]; vaultAddr: string; timestamps?: number[] }) {
  const svgRef = useRef<SVGSVGElement>(null)
  const hoverGroupRef = useRef<SVGGElement>(null)
  const endpointRef = useRef<SVGGElement>(null)
  const chartId = useChartId()
  const reduced = useReducedMotion()
  const [entered, setEntered] = useState(false)

  useEffect(() => {
    if (reduced) {
      setEntered(true)
      return
    }
    const t = setTimeout(() => setEntered(true), 80)
    return () => clearTimeout(t)
  }, [reduced])

  const chart = useMemo(() => {
    const min = Math.min(...data)
    const max = Math.max(...data)
    const range = max - min || 0.001
    const isPositive = data[data.length - 1] >= data[0]
    const strokeColor = isPositive ? '#22c55e' : '#ef4444'

    const pts = data.map((v, i) => ({
      x: CHART_PAD_L + (i / (data.length - 1)) * CHART_PLOT_W,
      y: CHART_PAD_T + (1 - (v - min) / range) * CHART_PLOT_H,
    }))

    const linePath = monotonePath(pts)
    const lastPt = pts[pts.length - 1]
    const firstPt = pts[0]
    const bottomY = (CHART_PAD_T + CHART_PLOT_H).toFixed(2)
    const fillPath = `${linePath}L${lastPt.x.toFixed(2)},${bottomY}L${firstPt.x.toFixed(2)},${bottomY}Z`
    const pathLength = estimatePathLength(pts)
    const endPt = lastPt

    const gridYs = [0.25, 0.5, 0.75].map(
      (frac) => CHART_PAD_T + CHART_PLOT_H * (1 - frac),
    )

    // Pick label format based on the actual time span. Sub-day spans show
    // hour:minute, multi-day spans show weekday + day. Adjacent duplicate
    // labels (e.g. four "7 Tue" stamps within one day) get blanked so the
    // axis reads honestly.
    const tsArr: number[] | null = timestamps && timestamps.length > 0 ? timestamps : null
    const spanMs = tsArr ? tsArr[tsArr.length - 1] - tsArr[0] : 6 * 24 * 3_600_000
    const useTimeFormat = spanMs < 24 * 3_600_000
    const formatLabel = (d: Date): string =>
      useTimeFormat
        ? d.toLocaleTimeString('en', { hour: '2-digit', minute: '2-digit', hour12: false })
        : d.toLocaleDateString('en', { weekday: 'short', day: 'numeric' })

    const rawXLabels = [0, 1, 2, 3].map(i => {
      let d: Date
      if (tsArr) {
        const idx = Math.round((i / 3) * (tsArr.length - 1))
        d = new Date(tsArr[idx])
      } else {
        d = new Date(Date.now() - (3 - i) * 2 * 24 * 60 * 60 * 1000)
      }
      return {
        label: formatLabel(d),
        x: CHART_PAD_L + (CHART_PLOT_W / 3) * i,
      }
    })
    // Drop adjacent duplicates so the axis doesn't read "7 Tue 7 Tue 7 Tue".
    const xLabels = rawXLabels.map((entry, i) => ({
      ...entry,
      label: i > 0 && entry.label === rawXLabels[i - 1].label ? '' : entry.label,
    }))

    return {
      min, max, range, isPositive, strokeColor,
      pts, linePath, fillPath, pathLength, endPt,
      gridYs, xLabels, POINTS: data.length,
    }
  }, [data, timestamps])

  const updateHover = useCallback(
    (svgX: number | null) => {
      const hoverG = hoverGroupRef.current
      const endG = endpointRef.current
      if (!hoverG) return

      if (svgX === null) {
        hoverG.style.display = 'none'
        if (endG) endG.style.display = ''
        return
      }

      const frac = (svgX - CHART_PAD_L) / CHART_PLOT_W
      const idx = Math.max(0, Math.min(chart.POINTS - 1, Math.round(frac * (chart.POINTS - 1))))
      const pt = chart.pts[idx]
      const val = data[idx]

      const line = hoverG.children[0] as SVGLineElement
      if (line) {
        line.setAttribute('x1', String(pt.x))
        line.setAttribute('x2', String(pt.x))
      }

      const glow = hoverG.children[1] as SVGCircleElement
      const dot = hoverG.children[2] as SVGCircleElement
      if (glow) {
        glow.setAttribute('cx', String(pt.x))
        glow.setAttribute('cy', String(pt.y))
      }
      if (dot) {
        dot.setAttribute('cx', String(pt.x))
        dot.setAttribute('cy', String(pt.y))
      }

      const label = hoverG.children[3] as SVGTextElement
      if (label) {
        label.setAttribute('x', String(pt.x))
        label.setAttribute('y', String(CHART_PAD_T - 4))
        label.textContent = `$${val.toFixed(4)}`
      }

      hoverG.style.display = ''
      if (endG) endG.style.display = 'none'
    },
    [chart, data],
  )

  const handleMouseMove = useCallback(
    (e: React.MouseEvent<SVGSVGElement>) => {
      const svg = svgRef.current
      if (!svg) return
      const rect = svg.getBoundingClientRect()
      const svgX = ((e.clientX - rect.left) / rect.width) * CHART_W
      if (svgX < CHART_PAD_L || svgX > CHART_W - CHART_PAD_R) {
        updateHover(null)
        return
      }
      updateHover(svgX)
    },
    [updateHover],
  )

  const handleMouseLeave = useCallback(() => updateHover(null), [updateHover])

  return (
    <svg
      ref={svgRef}
      viewBox={`0 0 ${CHART_W} ${CHART_H}`}
      className="w-full h-full"
      preserveAspectRatio="xMidYMid meet"
      role="img"
      aria-label="NAV performance chart"
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
    >
      <defs>
        <linearGradient id={`${chartId}-fill`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={chart.strokeColor} stopOpacity={0.15} />
          <stop offset="70%" stopColor={chart.strokeColor} stopOpacity={0.04} />
          <stop offset="100%" stopColor={chart.strokeColor} stopOpacity={0} />
        </linearGradient>
        <clipPath id={`${chartId}-clip`}>
          <rect
            x={CHART_PAD_L}
            y={CHART_PAD_T}
            width={entered ? CHART_PLOT_W : 0}
            height={CHART_PLOT_H}
            style={{
              transition: reduced
                ? 'none'
                : `width ${DRAW_DURATION}ms cubic-bezier(0.16, 1, 0.3, 1)`,
            }}
          />
        </clipPath>
      </defs>

      {chart.gridYs.map((y, i) => (
        <line
          key={i}
          x1={CHART_PAD_L}
          y1={y}
          x2={CHART_W - CHART_PAD_R}
          y2={y}
          stroke="#E5E7EB"
          strokeWidth={0.5}
          strokeDasharray="2,4"
          shapeRendering="crispEdges"
          style={{
            opacity: entered ? 1 : 0,
            transition: reduced
              ? 'none'
              : `opacity 400ms ease ${200 + i * 60}ms`,
          }}
        />
      ))}

      <path
        d={chart.fillPath}
        fill={`url(#${chartId}-fill)`}
        clipPath={`url(#${chartId}-clip)`}
        style={{
          opacity: entered ? 1 : 0,
          transition: reduced ? 'none' : 'opacity 600ms ease 300ms',
        }}
      />

      <path
        d={chart.linePath}
        fill="none"
        stroke={chart.strokeColor}
        strokeWidth={1.75}
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeDasharray={chart.pathLength}
        strokeDashoffset={entered ? 0 : chart.pathLength}
        style={{
          transition: reduced
            ? 'none'
            : `stroke-dashoffset ${DRAW_DURATION}ms cubic-bezier(0.16, 1, 0.3, 1)`,
        }}
      />

      <g ref={endpointRef}>
        <circle
          cx={chart.endPt.x}
          cy={chart.endPt.y}
          r={entered ? 3.5 : 0}
          fill={chart.strokeColor}
          style={{
            transition: reduced
              ? 'none'
              : `r 300ms cubic-bezier(0.16, 1, 0.3, 1) ${DRAW_DURATION}ms`,
          }}
        />
      </g>

      <g ref={hoverGroupRef} style={{ display: 'none' }}>
        <line
          x1={0}
          y1={CHART_PAD_T}
          x2={0}
          y2={CHART_PAD_T + CHART_PLOT_H}
          stroke="#9CA3AF"
          strokeWidth={0.75}
          strokeDasharray="2,2"
        />
        <circle cx={0} cy={0} r={7} fill={chart.strokeColor} fillOpacity={0.12} />
        <circle cx={0} cy={0} r={3.5} fill="white" stroke={chart.strokeColor} strokeWidth={2} />
        <text
          x={0}
          y={0}
          textAnchor="middle"
          fill={chart.strokeColor}
          fontSize={10}
          fontWeight={700}
          fontFamily={MONO_FONT}
        />
      </g>

      <text
        x={CHART_PAD_L - 4}
        y={CHART_PAD_T + 3}
        textAnchor="end"
        fill="#9CA3AF"
        fontSize={9}
        fontFamily={MONO_FONT}
        style={{
          opacity: entered ? 1 : 0,
          transition: reduced ? 'none' : 'opacity 400ms ease 300ms',
        }}
      >
        {chart.max.toFixed(4)}
      </text>
      <text
        x={CHART_PAD_L - 4}
        y={CHART_PAD_T + CHART_PLOT_H + 3}
        textAnchor="end"
        fill="#9CA3AF"
        fontSize={9}
        fontFamily={MONO_FONT}
        style={{
          opacity: entered ? 1 : 0,
          transition: reduced ? 'none' : 'opacity 400ms ease 360ms',
        }}
      >
        {chart.min.toFixed(4)}
      </text>

      {chart.xLabels.map((xl, i) => (
        <text
          key={i}
          x={xl.x}
          y={CHART_H - 4}
          textAnchor={i === 0 ? 'start' : i === chart.xLabels.length - 1 ? 'end' : 'middle'}
          fill="#9CA3AF"
          fontSize={9}
          fontFamily={MONO_FONT}
          style={{
            opacity: entered ? 1 : 0,
            transition: reduced ? 'none' : `opacity 400ms ease ${400 + i * 60}ms`,
          }}
        >
          {xl.label}
        </text>
      ))}
    </svg>
  )
}
