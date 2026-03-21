'use client'

import { useRef, useEffect, useCallback } from 'react'
import { useTranslations } from 'next-intl'

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

const PAD = { top: 24, right: 64, bottom: 36, left: 64 }
const GRID_N = 5
const LINE_W = 2
const DOT_R = 4
const DRAW_MS = 1400
const LERP_K = 0.22

// Colors
const LINE_COLOR = '#18181b'
const LINE_GLOW = 'rgba(24, 24, 27, 0.12)'
const GRID_COLOR = '#f4f4f5'
const LABEL_COLOR = '#a1a1aa'
const HOVER_LINE_COLOR = 'rgba(24, 24, 27, 0.20)'
const HOVER_PILL_BG = '#18181b'
const HOVER_PILL_TEXT = '#ffffff'
const HOVER_DOT_OUTER = 'rgba(24, 24, 27, 0.08)'
const AREA_TOP = 'rgba(24, 24, 27, 0.06)'
const AREA_BOTTOM = 'rgba(24, 24, 27, 0.0)'

function lerp(a: number, b: number, t: number) { return a + (b - a) * t }
function clamp(v: number, lo: number, hi: number) { return Math.max(lo, Math.min(hi, v)) }
function easeOutCubic(t: number) { return 1 - Math.pow(1 - t, 3) }

export function NavCanvas({ data, isLoading, height = 300, onHoverChange }: Props) {
  const t = useTranslations('markets.itp_page.performance')
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
    const yP = (hi - lo) * 0.12 || 0.01
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
    const font = '10px ui-monospace, SFMono-Regular, "SF Mono", Menlo, monospace'
    ctx.font = font

    // ── Grid lines ──
    for (let i = 0; i <= GRID_N; i++) {
      const f = i / GRID_N
      const y = Math.round(m.pT + f * m.pH) + 0.5
      ctx.strokeStyle = GRID_COLOR
      ctx.lineWidth = 1
      ctx.setLineDash([])
      ctx.beginPath()
      ctx.moveTo(m.pL, y)
      ctx.lineTo(m.pL + m.pW, y)
      ctx.stroke()

      // Y labels — right side
      const v = m.yMax - f * yR
      ctx.fillStyle = LABEL_COLOR
      ctx.textAlign = 'left'
      ctx.textBaseline = 'middle'
      ctx.fillText(fmtY(v), m.pL + m.pW + 10, y)
    }

    // ── X labels ──
    const nX = Math.min(5, m.pts.length)
    ctx.fillStyle = LABEL_COLOR
    ctx.textAlign = 'center'
    ctx.textBaseline = 'top'
    for (let i = 0; i < nX; i++) {
      const idx = Math.round((i / (nX - 1)) * (m.pts.length - 1))
      const p = m.pts[idx]
      const d = new Date(p.t * 1000)
      const label = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
      ctx.fillText(label, p.px, m.pT + m.pH + 12)
    }

    // ── Clip for draw-in animation ──
    ctx.save()
    ctx.beginPath()
    ctx.rect(m.pL - 2, 0, m.prog * m.pW + 4, m.h)
    ctx.clip()

    // ── Area gradient fill ──
    const grad = ctx.createLinearGradient(0, m.pT, 0, m.pT + m.pH)
    grad.addColorStop(0, AREA_TOP)
    grad.addColorStop(1, AREA_BOTTOM)
    ctx.fillStyle = grad
    ctx.beginPath()
    ctx.moveTo(m.pts[0].px, m.pts[0].py)
    for (let i = 1; i < m.pts.length; i++) ctx.lineTo(m.pts[i].px, m.pts[i].py)
    ctx.lineTo(m.pts[m.pts.length - 1].px, m.pT + m.pH)
    ctx.lineTo(m.pts[0].px, m.pT + m.pH)
    ctx.closePath()
    ctx.fill()

    // ── Line shadow (subtle glow) ──
    ctx.strokeStyle = LINE_GLOW
    ctx.lineWidth = LINE_W + 4
    ctx.lineJoin = 'round'
    ctx.lineCap = 'round'
    ctx.setLineDash([])
    ctx.beginPath()
    ctx.moveTo(m.pts[0].px, m.pts[0].py)
    for (let i = 1; i < m.pts.length; i++) ctx.lineTo(m.pts[i].px, m.pts[i].py)
    ctx.stroke()

    // ── Main line ──
    ctx.strokeStyle = LINE_COLOR
    ctx.lineWidth = LINE_W
    ctx.beginPath()
    ctx.moveTo(m.pts[0].px, m.pts[0].py)
    for (let i = 1; i < m.pts.length; i++) ctx.lineTo(m.pts[i].px, m.pts[i].py)
    ctx.stroke()

    ctx.restore() // clip

    // ── Latest price marker (small dot at end of line) ──
    if (m.prog >= 0.99 && !m.hover) {
      const last = m.pts[m.pts.length - 1]
      ctx.fillStyle = LINE_COLOR
      ctx.beginPath()
      ctx.arc(last.px, last.py, 3, 0, Math.PI * 2)
      ctx.fill()
    }

    // ── Crosshair + hover interaction ──
    if (m.hover && m.cx >= m.pL && m.cx <= m.pL + m.pW) {
      const p = nearest(m.cx)
      if (p) {
        // Vertical line
        ctx.setLineDash([])
        ctx.strokeStyle = HOVER_LINE_COLOR
        ctx.lineWidth = 1
        ctx.beginPath()
        ctx.moveTo(p.px, m.pT)
        ctx.lineTo(p.px, m.pT + m.pH)
        ctx.stroke()

        // Horizontal line (subtle, to dot only)
        ctx.strokeStyle = HOVER_LINE_COLOR
        ctx.beginPath()
        ctx.moveTo(m.pL, p.py)
        ctx.lineTo(m.pL + m.pW, p.py)
        ctx.stroke()

        // Outer glow ring
        ctx.fillStyle = HOVER_DOT_OUTER
        ctx.beginPath()
        ctx.arc(p.px, p.py, DOT_R + 6, 0, Math.PI * 2)
        ctx.fill()

        // White ring
        ctx.fillStyle = '#ffffff'
        ctx.beginPath()
        ctx.arc(p.px, p.py, DOT_R + 2, 0, Math.PI * 2)
        ctx.fill()

        // Inner dot
        ctx.fillStyle = LINE_COLOR
        ctx.beginPath()
        ctx.arc(p.px, p.py, DOT_R, 0, Math.PI * 2)
        ctx.fill()

        // ── Price pill (right edge) ──
        const priceText = fmtY(p.v)
        ctx.font = 'bold 10px ui-monospace, SFMono-Regular, "SF Mono", Menlo, monospace'
        const pillW = ctx.measureText(priceText).width + 12
        const pillH = 20
        const pillX = m.pL + m.pW + 4
        const pillY = p.py - pillH / 2

        // Pill background
        roundRect(ctx, pillX, pillY, pillW, pillH, 4)
        ctx.fillStyle = HOVER_PILL_BG
        ctx.fill()

        // Pill text
        ctx.fillStyle = HOVER_PILL_TEXT
        ctx.textAlign = 'left'
        ctx.textBaseline = 'middle'
        ctx.fillText(priceText, pillX + 6, p.py + 0.5)

        // ── Date pill (bottom edge) ──
        const d = new Date(p.t * 1000)
        const dateText = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
        ctx.font = '10px ui-monospace, SFMono-Regular, "SF Mono", Menlo, monospace'
        const datePillW = ctx.measureText(dateText).width + 12
        const datePillH = 18
        const datePillX = p.px - datePillW / 2
        const datePillY = m.pT + m.pH + 2

        roundRect(ctx, datePillX, datePillY, datePillW, datePillH, 4)
        ctx.fillStyle = HOVER_PILL_BG
        ctx.fill()

        ctx.fillStyle = HOVER_PILL_TEXT
        ctx.textAlign = 'center'
        ctx.textBaseline = 'middle'
        ctx.fillText(dateText, p.px, datePillY + datePillH / 2 + 0.5)
      }
    }

    ctx.restore()
  }, [nearest])

  // ── Loop ──
  const tick = useCallback(() => {
    let go = false
    if (m.prog < 1) {
      if (reducedRef.current) { m.prog = 1 }
      else { m.prog = easeOutCubic(clamp((performance.now() - m.t0) / DRAW_MS, 0, 1)) }
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
        <p className="text-sm text-text-muted">{t('no_data')}</p>
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

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.lineTo(x + w - r, y)
  ctx.quadraticCurveTo(x + w, y, x + w, y + r)
  ctx.lineTo(x + w, y + h - r)
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h)
  ctx.lineTo(x + r, y + h)
  ctx.quadraticCurveTo(x, y + h, x, y + h - r)
  ctx.lineTo(x, y + r)
  ctx.quadraticCurveTo(x, y, x + r, y)
  ctx.closePath()
}
