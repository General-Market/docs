'use client'

import { useRef, useEffect, useCallback } from 'react'

interface DataPoint { time: number; close: number }

export interface ChartHoverInfo {
  value: number
  time: number
  changePercent: number
}

interface Props {
  data: DataPoint[]
  isLoading: boolean
  height?: number
  onHoverChange?: (info: ChartHoverInfo | null) => void
}

const PAD = { top: 12, right: 16, bottom: 32, left: 56 }
const GRID_N = 4
const LINE_W = 1.5
const DOT_R = 3.5
const DRAW_MS = 1200
const LERP_K = 0.18

function lerp(a: number, b: number, t: number) { return a + (b - a) * t }
function clamp(v: number, lo: number, hi: number) { return Math.max(lo, Math.min(hi, v)) }

export function NavCanvas({ data, isLoading, height = 300, onHoverChange }: Props) {
  const boxRef = useRef<HTMLDivElement>(null)
  const cvRef = useRef<HTMLCanvasElement>(null)
  const rafRef = useRef(0)
  const runRef = useRef(false)
  const aliveRef = useRef(true)
  const reducedRef = useRef(false)
  const hoverCbRef = useRef(onHoverChange)
  hoverCbRef.current = onHoverChange

  // Mutable render state — never triggers React re-renders
  const m = useRef({
    w: 0, h: 0, dpr: 1,
    prog: 0, t0: 0,
    cx: -1, tx: -1, hover: false,
    pts: [] as { px: number; py: number; t: number; v: number }[],
    xMin: 0, xMax: 0, yMin: 0, yMax: 0,
    pL: PAD.left, pT: PAD.top, pW: 0, pH: 0,
  }).current

  useEffect(() => { aliveRef.current = true; return () => { aliveRef.current = false } }, [])

  useEffect(() => {
    const mql = window.matchMedia('(prefers-reduced-motion: reduce)')
    reducedRef.current = mql.matches
    const fn = (e: MediaQueryListEvent) => { reducedRef.current = e.matches }
    mql.addEventListener('change', fn)
    return () => mql.removeEventListener('change', fn)
  }, [])

  // ── Layout ──
  const layout = useCallback(() => {
    m.pW = m.w - PAD.left - PAD.right
    m.pH = m.h - PAD.top - PAD.bottom
    if (data.length < 2) { m.pts = []; return }
    m.xMin = data[0].time; m.xMax = data[data.length - 1].time
    const xR = m.xMax - m.xMin || 1
    const vals = data.map(d => d.close)
    const lo = Math.min(...vals), hi = Math.max(...vals)
    const yP = (hi - lo) * 0.1 || 0.01
    m.yMin = lo - yP; m.yMax = hi + yP
    const yR = m.yMax - m.yMin
    m.pts = data.map(d => ({
      px: m.pL + ((d.time - m.xMin) / xR) * m.pW,
      py: m.pT + (1 - (d.close - m.yMin) / yR) * m.pH,
      t: d.time, v: d.close,
    }))
  }, [data])

  // ── Nearest point ──
  const nearest = useCallback((x: number) => {
    let best = m.pts[0] ?? null, bestD = Infinity
    for (const p of m.pts) { const d = Math.abs(p.px - x); if (d < bestD) { bestD = d; best = p } }
    return best
  }, [])

  // ── Draw ──
  const draw = useCallback(() => {
    const cv = cvRef.current; if (!cv) return
    const ctx = cv.getContext('2d'); if (!ctx) return
    ctx.clearRect(0, 0, m.w * m.dpr, m.h * m.dpr)
    ctx.save(); ctx.scale(m.dpr, m.dpr)
    if (m.pts.length < 2) { ctx.restore(); return }

    const yR = m.yMax - m.yMin
    ctx.font = '10px -apple-system, system-ui, sans-serif'

    // Grid + Y labels
    for (let i = 0; i <= GRID_N; i++) {
      const f = i / GRID_N
      const y = Math.round(m.pT + f * m.pH) + 0.5
      ctx.strokeStyle = '#f0f0f0'; ctx.lineWidth = 1; ctx.setLineDash([])
      ctx.beginPath(); ctx.moveTo(m.pL, y); ctx.lineTo(m.pL + m.pW, y); ctx.stroke()
      const v = m.yMax - f * yR
      ctx.fillStyle = '#9ca3af'; ctx.textAlign = 'right'; ctx.textBaseline = 'middle'
      ctx.fillText(fmtY(v), m.pL - 8, y)
    }

    // X labels
    const nX = Math.min(6, m.pts.length)
    ctx.fillStyle = '#9ca3af'; ctx.textAlign = 'center'; ctx.textBaseline = 'top'
    for (let i = 0; i < nX; i++) {
      const idx = Math.round((i / (nX - 1)) * (m.pts.length - 1))
      const p = m.pts[idx]
      const d = new Date(p.t * 1000)
      ctx.fillText(d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }), p.px, m.pT + m.pH + 10)
    }

    // Clip for draw animation
    ctx.save()
    ctx.beginPath()
    ctx.rect(m.pL - 1, 0, m.prog * m.pW + 2, m.h)
    ctx.clip()

    // Area gradient
    const g = ctx.createLinearGradient(0, m.pT, 0, m.pT + m.pH)
    g.addColorStop(0, 'rgba(0,0,0,0.05)'); g.addColorStop(1, 'rgba(0,0,0,0)')
    ctx.fillStyle = g; ctx.beginPath()
    ctx.moveTo(m.pts[0].px, m.pts[0].py)
    for (let i = 1; i < m.pts.length; i++) ctx.lineTo(m.pts[i].px, m.pts[i].py)
    ctx.lineTo(m.pts[m.pts.length - 1].px, m.pT + m.pH)
    ctx.lineTo(m.pts[0].px, m.pT + m.pH)
    ctx.closePath(); ctx.fill()

    // Line
    ctx.strokeStyle = '#000'; ctx.lineWidth = LINE_W
    ctx.lineJoin = 'round'; ctx.lineCap = 'round'; ctx.setLineDash([])
    ctx.beginPath()
    ctx.moveTo(m.pts[0].px, m.pts[0].py)
    for (let i = 1; i < m.pts.length; i++) ctx.lineTo(m.pts[i].px, m.pts[i].py)
    ctx.stroke()
    ctx.restore() // clip

    // Crosshair
    if (m.hover && m.cx >= m.pL && m.cx <= m.pL + m.pW) {
      const p = nearest(m.cx)
      if (p) {
        ctx.setLineDash([4, 3]); ctx.strokeStyle = 'rgba(0,0,0,0.12)'; ctx.lineWidth = 1
        ctx.beginPath(); ctx.moveTo(p.px, m.pT); ctx.lineTo(p.px, m.pT + m.pH); ctx.stroke()
        ctx.beginPath(); ctx.moveTo(m.pL, p.py); ctx.lineTo(m.pL + m.pW, p.py); ctx.stroke()
        ctx.setLineDash([])
        // Dot
        ctx.fillStyle = '#000'
        ctx.beginPath(); ctx.arc(p.px, p.py, DOT_R, 0, Math.PI * 2); ctx.fill()
        ctx.strokeStyle = '#fff'; ctx.lineWidth = 2
        ctx.beginPath(); ctx.arc(p.px, p.py, DOT_R, 0, Math.PI * 2); ctx.stroke()
      }
    }
    ctx.restore()
  }, [nearest])

  // ── Loop ──
  const tick = useCallback(() => {
    let go = false
    if (m.prog < 1) {
      if (reducedRef.current) { m.prog = 1 }
      else { m.prog = 1 - Math.pow(1 - clamp((performance.now() - m.t0) / DRAW_MS, 0, 1), 3) }
      go = true
    }
    if (m.hover) {
      if (m.cx < 0) m.cx = m.tx
      else m.cx = reducedRef.current ? m.tx : lerp(m.cx, m.tx, LERP_K)
      go = true
    }
    draw()
    if (go && aliveRef.current) { rafRef.current = requestAnimationFrame(tick) }
    else { runRef.current = false }
  }, [draw])

  const kick = useCallback(() => {
    if (runRef.current) return
    runRef.current = true
    rafRef.current = requestAnimationFrame(tick)
  }, [tick])

  // ── Resize ──
  useEffect(() => {
    const el = boxRef.current, cv = cvRef.current; if (!el || !cv) return
    const resize = () => {
      const r = el.getBoundingClientRect()
      const dpr = window.devicePixelRatio || 1
      m.w = r.width; m.h = height; m.dpr = dpr
      cv.width = r.width * dpr; cv.height = height * dpr
      cv.style.width = `${r.width}px`; cv.style.height = `${height}px`
      layout(); draw()
    }
    const ro = new ResizeObserver(resize); ro.observe(el); resize()
    return () => ro.disconnect()
  }, [height, layout, draw])

  // ── Data → animate ──
  useEffect(() => {
    m.prog = 0; m.t0 = performance.now()
    layout(); kick()
  }, [data, layout, kick])

  // Cleanup
  useEffect(() => () => cancelAnimationFrame(rafRef.current), [])

  // ── Mouse ──
  const emitHover = useCallback((x: number) => {
    const p = nearest(x)
    if (p && m.pts.length > 0) {
      const f = m.pts[0].v
      hoverCbRef.current?.({ value: p.v, time: p.t, changePercent: f > 0 ? ((p.v - f) / f) * 100 : 0 })
    }
  }, [nearest])

  const onMove = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const r = cvRef.current?.getBoundingClientRect(); if (!r) return
    const x = e.clientX - r.left
    m.tx = x; m.hover = true; kick(); emitHover(x)
  }, [kick, emitHover])

  const onLeave = useCallback(() => {
    m.hover = false; m.cx = -1; hoverCbRef.current?.(null); draw()
  }, [draw])

  const onTouch = useCallback((e: React.TouchEvent<HTMLCanvasElement>) => {
    const t = e.touches[0]; if (!t) return
    const r = cvRef.current?.getBoundingClientRect(); if (!r) return
    const x = t.clientX - r.left
    m.tx = x; m.hover = true; kick(); emitHover(x)
  }, [kick, emitHover])

  const onTouchEnd = useCallback(() => {
    m.hover = false; m.cx = -1; hoverCbRef.current?.(null); draw()
  }, [draw])

  // ── Render ──
  if (isLoading) {
    return <div className="w-full" style={{ height }}><div className="animate-pulse bg-gray-100 h-full w-full rounded" /></div>
  }
  if (data.length === 0) {
    return (
      <div className="w-full flex items-center justify-center bg-surface rounded" style={{ height }}>
        <p className="text-sm text-text-muted">Performance data not yet available</p>
      </div>
    )
  }
  return (
    <div ref={boxRef} className="relative w-full">
      <canvas
        ref={cvRef}
        className="w-full cursor-crosshair"
        style={{ height }}
        onMouseMove={onMove}
        onMouseLeave={onLeave}
        onTouchMove={onTouch}
        onTouchEnd={onTouchEnd}
      />
    </div>
  )
}

function fmtY(v: number): string {
  if (v >= 100) return `$${v.toFixed(0)}`
  if (v >= 1) return `$${v.toFixed(2)}`
  return `$${v.toFixed(4)}`
}
