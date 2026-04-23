'use client'

import { useState, useRef, useEffect, useCallback, useMemo } from 'react'
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion'
import { springs, SpringNumber } from '@/components/ui/spring'
import { useMarketSearch, type SearchMarket } from '@/hooks/vision/useMarketSearch'
import { useMarketSnapshotMeta, useSourceSnapshot, type SnapshotPrice } from '@/hooks/vision/useMarketSnapshot'
import { useSourceRegistry } from '@/hooks/vision/useSourceRegistry'
import { allInternalIds, toInternalId } from '@/lib/vision/source-ids'
import { AnimatedNumber } from '@/components/ui/AnimatedNumber'
import { getAssetImageUrl } from '@/lib/vision/asset-images'
import { useVisionLeaderboard } from '@/hooks/vision/useVisionLeaderboard'
import { usePlayerProfile } from '@/hooks/usePlayerProfile'
import Image from 'next/image'
import { Link, useRouter } from '@/i18n/routing'

// ── Featured Sources ────────────────────────────────────────
// The four sources that make visitors pause. Ordered for maximum
// cognitive dissonance: streaming, trains, gaming, earthquakes.
const FEATURED_SOURCE_IDS = ['twitch', 'db_trains', 'steam', 'earthquake'] as const

// ~200 English-speaking Twitch streamers (Mar 2026, TwitchTracker data).
// Broad enough that 4+ are live at any hour. Card sorts by biggest viewer loss.
const PREFERRED_US_STREAMERS = new Set([
  // Tier 1 — 10K+ avg viewers
  'kaicenat', 'caseoh_', 'jynxzi', 'caedrel', 'theburntpeanut',
  'gofns', 'zackrawrr', 'hasanabi', 'ohnepixel', 'stableronaldo',
  'xqc', 'plaqueboymax', '2xrakai', 'emiru', 'jasontheween',
  'lacy', 'brucedropemoff', 'quackity', 'fanum', 'yourragegaming',
  'northernlion', 'lirik', 'maximum', 'thebausffs', 'moonmoon',
  'tarik', 'schlatt', 'ishowspeed', 'jerma985', 'duke',
  'paymoneywubby', 'tfue', 'sodapoppin', 'angryginge13', 'shroud',
  'tenz', 'summit1g', 'joe_bartolozzi', 'marlon',
  // Tier 2 — 5K–10K avg viewers
  'mitchjones', 'vedal987', 'rdcgaming', 'abstreamin', 'wendolynortizz',
  's0mcs', 'agent00', 'forsen', 'quin69', 'ludwig',
  'cohhcarnage', 'vanillamace', 'jaycinco', 'extraemily', 'adapt',
  'elajjaz', 'topson', 'scump', 'k3soju', 'ironmouse',
  'realzbluewater', 'cinna', 'nickmercs', 'loltyler1', 'distortion2',
  'vinesauce', 'hutchmf', 'lydiaviolet', 'clix', 'austinmcbroom',
  'emongg', 'supertf', 'realkatieb', 'oliviamonroe', 'thetylilshow',
  'peterbot', 'wayneradiotv', 'aztecross', 'zoomaa', 'dougdoug',
  'maximilian_dood', 'quickybaby', 'rockykramer', 'happyhappygal',
  'ddg', 'cdawg', 'aspen', 'gorgc', 'maya',
  'timthetatman', 'rayasianboy', 'sliggytv', 'arky', 'asianbunnyx',
  'lava_flame2', 'wirtual', 'arteezy', 'cloakzy', 'rezreel',
  'silky', 'faxuty', 'erobb221',
  // Tier 3 — 2K–5K avg viewers
  'tangotek', 'squeex', 'tommyinnit', 'geminitay', 'valkyrae',
  'michaelreeves', 'imperialhal__', 'xaryu', 'mrsavage', 'grian',
  'shylily', 'penta', 'doublelift', 'mooda', 'auziomf',
  'dannyaarons', 't90official', 'bendadonnn', 'fchwpo', 'nykchazza',
  'vargskelethor', 'iwdominate', 'foolish', 'denims', 'insym',
  'willneff', 'thestockguy', 'aussieantics', 'mcconnellret', 'bonnie',
  'zentreya', 'boxbox', 'pokimane', 'missmikkaa', 'ml7support',
  'broxah', 'shotzzy', 'admiralbahroo', 'silvervale', 'morgpie',
  'qtcinderella', 'gingy', 'deshaefrost', 'shanks_ttv', 'moistcr1tikal',
  'tubbo', 'symfuhny', 'feinberg', 'im_dontai', 'gothamchess',
  'henyathegenius', 'carterefe', 'atrioc', 'tinakitten', 'squishymuffinz',
  'barbarousking', 'robcdee', 'fuslie', 'nicewigg', 'ninja',
  'ashswag', 'lilsimsie', 'grubby', 'fl0m', 'dafran',
  'smii7y', 'lvndmark', 'cyr', 'impulsesv', 'goodtimeswithscar',
  '39daph', 'rekkles', 'kitboga', 'richwcampbell', 'rtgame',
  'otzdarva', 'cottontailva', 'nihmune', 'bigpuffer', 'clintstevens',
  'zizaran', 'philza', 'quarterjade', 'austinshow', 'disguisedtoast',
  'benjyfishy', 'subroza', 'diazbiffle', 'aceu', 'chilledchaos',
  'mathil1', 'surefour', 'karq', 'piratesoftware', 'lilypichu',
  'nadeshot', 'mongraal', 'dashy', 'faide', 'avoidingthepuddle',
  'jankos', 'fanfan', 'demon1', 'dansgaming', 'shipbroman',
])

// Accent colors for sources with light/white brandBg
const ACCENT_OVERRIDES: Record<string, string> = {
  earthquake: '#e65100',
  coingecko: '#8dc647',
}

function formatValue(v: string | null): string {
  if (!v) return '—'
  const n = parseFloat(v)
  if (isNaN(n)) return v
  if (n >= 1_000_000_000) return `$${(n / 1e9).toFixed(2)}B`
  if (n >= 1_000_000) return `$${(n / 1e6).toFixed(2)}M`
  if (n >= 1_000) return `$${(n / 1e3).toFixed(1)}K`
  if (n >= 1) return `$${n.toFixed(2)}`
  if (n >= 0.01) return `$${n.toFixed(4)}`
  return `$${n.toFixed(6)}`
}

function formatChange(pct: string | null): { text: string; color: string } {
  const n = parseFloat(pct ?? '0')
  if (isNaN(n)) return { text: '0.00%', color: 'text-zinc-400' }
  const sign = n >= 0 ? '+' : ''
  return {
    text: `${sign}${n.toFixed(2)}%`,
    color: n > 0 ? 'text-emerald-500' : n < 0 ? 'text-red-500' : 'text-zinc-400',
  }
}

function MarketIcon({ market }: { market: SearchMarket }) {
  const [imgErr, setImgErr] = useState(false)
  const letter = (market.symbol || market.name || '?')[0].toUpperCase()

  if (market.imageUrl && !imgErr) {
    return (
      <img
        src={market.imageUrl}
        alt=""
        width={28}
        height={28}
        className="w-7 h-7 rounded-full shrink-0 object-cover bg-zinc-100"
        loading="lazy"
        onError={() => setImgErr(true)}
      />
    )
  }

  return (
    <div className="w-7 h-7 rounded-full bg-zinc-200 shrink-0 flex items-center justify-center text-[10px] font-bold text-zinc-500">
      {letter}
    </div>
  )
}

function ResultRow({ market, onClick }: { market: SearchMarket; onClick: () => void }) {
  const change = formatChange(market.changePct)
  return (
    <button
      role="option"
      onClick={onClick}
      className="flex items-center gap-3 w-full px-4 py-2.5 hover:bg-zinc-50 transition-colors text-left"
    >
      <MarketIcon market={market} />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-[13px] font-semibold text-black truncate">{market.symbol}</span>
          <span className="text-[11px] text-zinc-400 truncate">{market.name}</span>
        </div>
        <span className="text-[11px] text-zinc-400">{market.source}</span>
      </div>
      <div className="text-right shrink-0">
        <div className="text-[13px] font-mono font-medium text-black tabular-nums">
          {formatValue(market.value)}
        </div>
        <div className={`text-[11px] font-mono tabular-nums ${change.color}`}>
          {change.text}
        </div>
      </div>
    </button>
  )
}

// Short hero names
const HERO_SHORT_NAMES: Record<string, string> = {
  twitch: 'Twitch',
  db_trains: 'Deutsche Bahn',
  steam: 'Steam',
  earthquake: 'Earthquakes',
}

// Format values based on source type — not everything is dollars
function formatSourceValue(v: string | null, isPrice: boolean, unit: string): string {
  if (!v) return '—'
  const n = parseFloat(v)
  if (isNaN(n)) return v
  if (isPrice) return formatValue(v)
  // Non-price sources: no dollar sign
  if (n >= 1_000_000) return `${(n / 1e6).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1e3).toFixed(1)}K`
  if (n >= 100) return Math.round(n).toString()
  if (n >= 1) return n.toFixed(1)
  return n.toFixed(2)
}

// Chart line colors — Polymarket-grade palette.
// High-saturation, high-contrast, distinguishable at any size.
// Blue (primary), emerald, amber, violet — no pastels, no neons.
const CHART_COLORS = ['#2563EB', '#059669', '#D97706', '#7C3AED']

// ── Sub-market row ─────────────────────────────────────────
function SubMarketRow({ market, displaySourceId, prefixes, isPrice, valueUnit, colorIndex }: {
  market: SnapshotPrice
  displaySourceId: string
  prefixes: string[]
  isPrice: boolean
  valueUnit: string
  colorIndex: number
}) {
  const [imgErr, setImgErr] = useState(false)
  const change = formatChange(market.changePct)
  const lineColor = CHART_COLORS[colorIndex % CHART_COLORS.length]

  // Prefer human-readable name, fall back to stripping prefix
  const label = market.name || (() => {
    const id = market.assetId || market.symbol || ''
    for (const pfx of prefixes) {
      if (id.startsWith(pfx)) return id.slice(pfx.length).replace(/_/g, ' ')
    }
    return market.symbol || '—'
  })()

  // Train lines: extract line number for badge-style display (e.g. "ICE 123", "S1")
  const trainLine = displaySourceId === 'db_trains'
    ? (market.assetId || market.symbol || '').match(/^(ICE|RE|RB|S)\s*(\d+)/)?.[0] ?? null
    : null

  // Resolve image via the asset-images system (icon proxy)
  const imgUrl = useMemo(
    () => getAssetImageUrl(displaySourceId, market.assetId || market.symbol || '', prefixes),
    [displaySourceId, market.assetId, market.symbol, prefixes],
  )

  return (
    <div className="flex items-center gap-2 px-3 py-1.5 hover:bg-zinc-50/80 transition-colors">
      {/* Chart color dot — always shown, matches the chart line */}
      <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: lineColor }} />
      {imgUrl && !imgErr ? (
        <img
          src={imgUrl}
          alt=""
          width={20}
          height={20}
          className="w-5 h-5 rounded shrink-0 object-cover bg-zinc-100"
          loading="lazy"
          onError={() => setImgErr(true)}
        />
      ) : displaySourceId === 'db_trains' ? (() => {
        const stationName = trainLine ? label.replace(trainLine, '').trim() || label : label
        const abbr = stationName.split(/[\s(]/)[0].slice(0, 3)
        const bgColor = trainLine?.startsWith('ICE') ? '#ec0016' : trainLine?.startsWith('S') ? '#408335' : '#0066b3'
        return (
          <span
            className="h-5 rounded shrink-0 flex items-center justify-center px-1 text-[8px] font-black text-white leading-none tracking-tight uppercase"
            style={{ backgroundColor: bgColor, minWidth: '20px' }}
          >
            {abbr}
          </span>
        )
      })() : displaySourceId === 'earthquake' ? (
        <span className="w-5 h-5 rounded shrink-0 flex items-center justify-center bg-orange-600">
          <svg viewBox="0 0 16 16" className="w-3 h-3" fill="none">
            <path d="M2 8h2l1.5-4 2 8 2-6 1.5 4H14" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </span>
      ) : (
        <span className="w-5 h-5 rounded-full shrink-0 flex items-center justify-center bg-zinc-200 text-[9px] font-bold text-zinc-500 uppercase">
          {(label || '?')[0]}
        </span>
      )}
      <span className="text-[11px] font-medium text-black truncate flex-1 capitalize">
        {trainLine ? label.replace(trainLine, '').trim() || label : label}
      </span>
      <span className="text-[11px] font-mono font-medium text-black tabular-nums shrink-0">
        {formatSourceValue(market.value, isPrice, valueUnit)}
      </span>
      <span className={`text-[10px] font-mono tabular-nums shrink-0 w-[44px] text-right ${change.color}`}>
        {change.text}
      </span>
    </div>
  )
}

// ── Multi-line Chart — Overdrive ─────────────────────────────
// Line-draw entrance animation via stroke-dashoffset, gradient
// area fills that fade in simultaneously, spring-physics hover
// crosshair, animated endpoint values, proper reduced-motion.
// 48 data points, monotone cubic spline.

// Monotone cubic spline — Fritsch-Carlson (d3.curveMonotoneX)
function monotonePath(pts: { x: number; y: number }[]): string {
  if (pts.length < 2) return ''
  if (pts.length === 2) return `M${pts[0].x},${pts[0].y}L${pts[1].x},${pts[1].y}`
  const n = pts.length
  const dx: number[] = [], dy: number[] = [], m: number[] = []
  for (let i = 0; i < n - 1; i++) {
    dx.push(pts[i + 1].x - pts[i].x)
    dy.push(pts[i + 1].y - pts[i].y)
    m.push(dy[i] / dx[i])
  }
  const tg: number[] = [m[0]]
  for (let i = 1; i < n - 1; i++) tg.push(m[i - 1] * m[i] <= 0 ? 0 : (m[i - 1] + m[i]) / 2)
  tg.push(m[n - 2])
  for (let i = 0; i < n - 1; i++) {
    if (Math.abs(m[i]) < 1e-6) { tg[i] = 0; tg[i + 1] = 0; continue }
    const a = tg[i] / m[i], b = tg[i + 1] / m[i], s = a * a + b * b
    if (s > 9) { const t = 3 / Math.sqrt(s); tg[i] = t * a * m[i]; tg[i + 1] = t * b * m[i] }
  }
  const parts = [`M${pts[0].x.toFixed(2)},${pts[0].y.toFixed(2)}`]
  for (let i = 0; i < n - 1; i++) {
    const d = dx[i] / 3
    parts.push(`C${(pts[i].x + d).toFixed(2)},${(pts[i].y + tg[i] * d).toFixed(2)} ${(pts[i + 1].x - d).toFixed(2)},${(pts[i + 1].y - tg[i + 1] * d).toFixed(2)} ${pts[i + 1].x.toFixed(2)},${pts[i + 1].y.toFixed(2)}`)
  }
  return parts.join(' ')
}

function areaPath(linePath: string, startX: number, endX: number, bottomY: number): string {
  return `${linePath}L${endX.toFixed(2)},${bottomY.toFixed(2)}L${startX.toFixed(2)},${bottomY.toFixed(2)}Z`
}

// Estimate path length from point data — sum of Euclidean segment distances.
// Avoids creating detached DOM elements (was 16 per page load: 4 charts × 4 series).
function estimatePathLength(pts: { x: number; y: number }[]): number {
  let len = 0
  for (let i = 1; i < pts.length; i++) {
    const dx = pts[i].x - pts[i - 1].x
    const dy = pts[i].y - pts[i - 1].y
    len += Math.sqrt(dx * dx + dy * dy)
  }
  // Monotone cubic spline segments run ~12% longer than straight-line chords.
  return len * 1.12
}

// Unique ID prefix per chart instance to avoid gradient ID collisions
let chartIdCounter = 0
function useChartId() {
  const ref = useRef<string>('')
  if (!ref.current) ref.current = `mlc-${++chartIdCounter}`
  return ref.current
}

function MultiLineChart({ marketIds, markets, valueLabel, historyData }: {
  marketIds: string[]
  markets: { name: string; assetId: string }[]
  valueLabel: string
  historyData?: Record<string, { value: number; ts: number }[]>
}) {
  const [entered, setEntered] = useState(false)
  const [hoverData, setHoverData] = useState<{ x: number; values: { color: string; y: number; val: number }[] } | null>(null)
  const svgRef = useRef<SVGSVGElement>(null)
  const hoverGroupRef = useRef<SVGGElement>(null)
  const endpointsRef = useRef<SVGGElement>(null)
  const chartId = useChartId()
  const reduced = useReducedMotion()

  // Trigger entrance animation after mount
  useEffect(() => {
    if (reduced) { setEntered(true); return }
    const t = setTimeout(() => setEntered(true), 80)
    return () => clearTimeout(t)
  }, [reduced])

  const chart = useMemo(() => {
    const W = 460, H = 200
    const padT = 8, padB = 28, padL = 0, padR = 42
    const plotW = W - padL - padR
    const plotH = H - padT - padB
    const POINTS = 48

    // Find global time range across all series for time-based downsampling
    let globalMinTs = Infinity, globalMaxTs = -Infinity
    for (const id of marketIds.slice(0, 4)) {
      const pts = historyData?.[id]
      if (!pts || pts.length < 2) continue
      globalMinTs = Math.min(globalMinTs, pts[0].ts)
      globalMaxTs = Math.max(globalMaxTs, pts[pts.length - 1].ts)
    }

    // Only keep series with real history. Anything without data is dropped,
    // never replaced with procedural noise.
    const rawSeries: { id: string; values: number[]; color: string; timestamps: number[] }[] = []
    marketIds.slice(0, 4).forEach((id, i) => {
      const pts = historyData?.[id]
      if (!pts || pts.length < 2) return
      // Time-based downsampling: evenly spaced across the full time range.
      // If no data point exists within GAP_THRESHOLD of a bucket, value = 0
      // (e.g. Twitch streamer offline). This prevents interpolation across gaps.
      const GAP_THRESHOLD = 30 * 60 * 1000 // 30 minutes
      const tMin = isFinite(globalMinTs) ? globalMinTs : pts[0].ts
      const tMax = isFinite(globalMaxTs) ? globalMaxTs : pts[pts.length - 1].ts
      const tRange = tMax - tMin || 1
      const values: number[] = []
      const timestamps: number[] = []
      let cursor = 0
      for (let j = 0; j < POINTS; j++) {
        const targetTs = tMin + (j / (POINTS - 1)) * tRange
        while (cursor < pts.length - 1 && pts[cursor + 1].ts <= targetTs) cursor++
        const nearest = pts[cursor]
        const dist = Math.abs(nearest.ts - targetTs)
        if (cursor < pts.length - 1 && Math.abs(pts[cursor + 1].ts - targetTs) < dist) {
          values.push(pts[cursor + 1].value)
          timestamps.push(targetTs)
        } else if (dist <= GAP_THRESHOLD) {
          values.push(nearest.value)
          timestamps.push(targetTs)
        } else {
          values.push(0)
          timestamps.push(targetTs)
        }
      }
      rawSeries.push({ id, values, color: CHART_COLORS[i], timestamps })
    })

    // Normalize all series — if data contains zeros (gap-filled offline periods),
    // map to 0%-85% so zeros sit at chart bottom; otherwise 15%-85%
    const allVals = rawSeries.flatMap(s => s.values)
    const gMin = allVals.length ? Math.min(...allVals) : 0
    const gMax = allVals.length ? Math.max(...allVals) : 1
    const gRange = gMax - gMin || 1
    const hasZeros = gMin === 0
    const normFloor = hasZeros ? 0 : 0.15
    const normSpan = 0.85 - normFloor
    for (const s of rawSeries) {
      s.values = s.values.map(v => normFloor + normSpan * (v - gMin) / gRange)
    }

    // Fixed y-axis: 0-100% with 25% ticks — consistent across all cards
    const toY = (v: number) => padT + plotH * (1 - v)
    const ticks = [0.25, 0.5, 0.75, 1]
    const gridYs = ticks.map(t => toY(t))

    // Map series to plot coordinates using dynamic range
    const series = rawSeries.map(raw => {
      const pts = raw.values.map((v, j) => ({
        x: padL + (plotW / (POINTS - 1)) * j,
        y: toY(v),
      }))
      const linePath = monotonePath(pts)
      const fillPath = areaPath(linePath, pts[0].x, pts[pts.length - 1].x, padT + plotH)
      const endPt = pts[pts.length - 1]
      const endVal = Math.round(raw.values[raw.values.length - 1] * 100)
      const pathLength = estimatePathLength(pts)
      return { ...raw, linePath, fillPath, pts, endPt, endVal, pathLength }
    })

    // X-axis labels from real timestamps if available, else relative dates
    const firstTs = rawSeries.find(s => s.timestamps.length > 0)?.timestamps
    const xLabels = [0, 1, 2, 3].map(i => {
      let d: Date
      if (firstTs && firstTs.length > 0) {
        const idx = Math.round((i / 3) * (firstTs.length - 1))
        d = new Date(firstTs[idx])
      } else {
        d = new Date(Date.now() - (3 - i) * 2 * 24 * 60 * 60 * 1000)
      }
      return {
        label: d.toLocaleDateString('en', { weekday: 'short', month: 'short', day: 'numeric' }),
        x: padL + (plotW / 3) * i,
      }
    })

    return { W, H, padT, padB, padL, padR, plotW, plotH, gridYs, ticks, series, xLabels, POINTS }
  }, [marketIds, historyData])

  // Direct DOM manipulation for hover — avoids re-rendering the entire SVG on mouse move.
  // The hover <g> and endpoints <g> are toggled via refs. Zero React state changes.
  const updateHover = useCallback((svgX: number | null) => {
    const hoverG = hoverGroupRef.current
    const endpointsG = endpointsRef.current
    if (!hoverG) return

    if (svgX === null || chart.series.length === 0) {
      hoverG.style.display = 'none'
      if (endpointsG) endpointsG.style.display = ''
      setHoverData(null)
      return
    }

    const frac = (svgX - chart.padL) / chart.plotW
    const idx = Math.round(frac * (chart.POINTS - 1))
    const clampedIdx = Math.max(0, Math.min(chart.POINTS - 1, idx))
    const x = chart.padL + (chart.plotW / (chart.POINTS - 1)) * clampedIdx

    // Update crosshair line
    const line = hoverG.children[0] as SVGLineElement
    if (line) {
      line.setAttribute('x1', String(x))
      line.setAttribute('x2', String(x))
    }

    // Update per-series dots + labels
    for (let i = 0; i < chart.series.length; i++) {
      const s = chart.series[i]
      const y = s.pts[clampedIdx].y
      const val = Math.round(s.values[clampedIdx] * 100)
      const g = hoverG.children[1 + i] as SVGGElement
      if (!g) continue
      const glow = g.children[0] as SVGCircleElement
      const dot = g.children[1] as SVGCircleElement
      const label = g.children[2] as SVGTextElement
      if (glow) { glow.setAttribute('cx', String(x)); glow.setAttribute('cy', String(y)) }
      if (dot) { dot.setAttribute('cx', String(x)); dot.setAttribute('cy', String(y)) }
      if (label) { label.setAttribute('x', String(x + 8)); label.setAttribute('y', String(y + 3.5)); label.textContent = `${val}%` }
    }

    hoverG.style.display = ''
    if (endpointsG) endpointsG.style.display = 'none'
    setHoverData({
      x,
      values: chart.series.map((s, i) => ({
        color: s.color,
        y: s.pts[clampedIdx].y,
        val: Math.round(s.values[clampedIdx] * 100),
      })),
    })
  }, [chart])

  const handleMouseMove = useCallback((e: React.MouseEvent<SVGSVGElement>) => {
    const svg = svgRef.current
    if (!svg) return
    const rect = svg.getBoundingClientRect()
    const svgX = ((e.clientX - rect.left) / rect.width) * chart.W
    if (svgX < chart.padL || svgX > chart.W - chart.padR) {
      updateHover(null)
      return
    }
    updateHover(svgX)
  }, [chart, updateHover])

  const handleMouseLeave = useCallback(() => updateHover(null), [updateHover])

  if (chart.series.length === 0) return null

  // Stagger delays: each series draws 120ms after the previous
  const DRAW_DURATION = 900
  const STAGGER = 120

  return (
    <>
      <svg
        ref={svgRef}
        viewBox={`0 0 ${chart.W} ${chart.H}`}
        className="w-full h-full overflow-visible"
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
      >
        <defs>
          {chart.series.map((s, i) => (
            <linearGradient key={`grad-${i}`} id={`${chartId}-area-${i}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={s.color} stopOpacity={0.2} />
              <stop offset="70%" stopColor={s.color} stopOpacity={0.05} />
              <stop offset="100%" stopColor={s.color} stopOpacity={0} />
            </linearGradient>
          ))}
          {/* Clip mask for revealing area fill in sync with line draw */}
          {chart.series.map((s, i) => (
            <clipPath key={`clip-${i}`} id={`${chartId}-clip-${i}`}>
              <rect
                x={chart.padL}
                y={chart.padT}
                width={entered ? chart.plotW : 0}
                height={chart.plotH}
                className="chart-clip-rect"
                style={{
                  transition: reduced ? 'none' : `width ${DRAW_DURATION}ms cubic-bezier(0.16, 1, 0.3, 1) ${i * STAGGER}ms`,
                }}
              />
            </clipPath>
          ))}
        </defs>

        {/* Grid lines — fade in with chart */}
        {chart.gridYs.map((y, i) => (
          <line key={i} x1={chart.padL} y1={y} x2={chart.W - chart.padR} y2={y}
            stroke="#E5E7EB" strokeWidth={0.5} strokeDasharray="1,3" shapeRendering="crispEdges"
            style={{
              opacity: entered ? 1 : 0,
              transition: reduced ? 'none' : `opacity 400ms ease ${200}ms`,
            }}
          />
        ))}

        {/* Area fills — clipped to reveal left-to-right with line draw */}
        {chart.series.map((s, i) => (
          <path
            key={`fill-${s.id}`}
            d={s.fillPath}
            fill={`url(#${chartId}-area-${i})`}
            clipPath={`url(#${chartId}-clip-${i})`}
            style={{
              opacity: entered ? 1 : 0,
              transition: reduced ? 'none' : `opacity 600ms ease ${i * STAGGER + 300}ms`,
            }}
          />
        ))}

        {/* Line strokes — stroke-dashoffset animation for line-draw effect */}
        {chart.series.map((s, i) => {
          const len = s.pathLength
          return (
            <path
              key={`line-${s.id}`}
              d={s.linePath}
              fill="none"
              stroke={s.color}
              strokeWidth={1.75}
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeDasharray={len}
              strokeDashoffset={entered ? 0 : len}
              style={{
                transition: reduced
                  ? 'none'
                  : `stroke-dashoffset ${DRAW_DURATION}ms cubic-bezier(0.16, 1, 0.3, 1) ${i * STAGGER}ms`,
              }}
            />
          )
        })}

        {/* Endpoint dots — appear after line finishes drawing */}
        {!hoverData && chart.series.map((s, i) => (
          <circle
            key={`dot-${s.id}`}
            cx={s.endPt.x}
            cy={s.endPt.y}
            r={entered ? 3 : 0}
            fill={s.color}
            style={{
              transition: reduced ? 'none' : `r 300ms cubic-bezier(0.34, 1.56, 0.64, 1) ${DRAW_DURATION + i * STAGGER}ms`,
            }}
          />
        ))}

        {/* Endpoint % labels — fade in after dots */}
        {!hoverData && chart.series.map((s, i) => (
          <text
            key={`lbl-${s.id}`}
            x={s.endPt.x + 6}
            y={s.endPt.y + 3.5}
            fill={s.color}
            fontSize={10}
            fontWeight={700}
            fontFamily="system-ui, -apple-system, sans-serif"
            style={{
              opacity: entered ? 1 : 0,
              transform: entered ? 'translateX(0)' : 'translateX(-4px)',
              transition: reduced
                ? 'none'
                : `opacity 300ms ease ${DRAW_DURATION + i * STAGGER + 100}ms, transform 300ms ease ${DRAW_DURATION + i * STAGGER + 100}ms`,
            }}
          >
            {s.endVal}%
          </text>
        ))}

        {/* Hover crosshair — smooth vertical line + ring dots */}
        {hoverData && (
          <g>
            <line
              x1={hoverData.x} y1={chart.padT}
              x2={hoverData.x} y2={chart.padT + chart.plotH}
              stroke="#D1D5DB" strokeWidth={1}
            />
            {hoverData.values.map((v, i) => (
              <g key={`hover-${i}`}>
                {/* Glow ring */}
                <circle cx={hoverData.x} cy={v.y} r={6} fill={v.color} fillOpacity={0.1} />
                {/* Dot — white center, colored ring */}
                <circle cx={hoverData.x} cy={v.y} r={3.5} fill="white" stroke={v.color} strokeWidth={2} />
                {/* Value label */}
                <text
                  x={hoverData.x + 8} y={v.y + 3.5}
                  fill={v.color} fontSize={10} fontWeight={700}
                  fontFamily="system-ui, -apple-system, sans-serif"
                >
                  {v.val}%
                </text>
              </g>
            ))}
          </g>
        )}

        {/* Y-axis labels — dynamic range */}
        {chart.ticks.map((tick, i) => (
          <text key={tick} x={chart.W - chart.padR + 5} y={chart.gridYs[i] + 4}
            textAnchor="start" fill="#9CA3AF" fontSize={11} fontWeight={500}
            fontFamily="system-ui, -apple-system, sans-serif"
            style={{
              opacity: entered ? 1 : 0,
              transition: reduced ? 'none' : `opacity 400ms ease ${300 + i * 60}ms`,
            }}
          >
            {Math.round(tick * 100)}%
          </text>
        ))}

        {/* X-axis date labels */}
        {chart.xLabels.map((xl, i) => (
          <text key={i} x={xl.x} y={chart.H - 3}
            textAnchor={i === 0 ? 'start' : i === chart.xLabels.length - 1 ? 'end' : 'middle'}
            fill="#9CA3AF" fontSize={11} fontWeight={500}
            fontFamily="system-ui, -apple-system, sans-serif"
            style={{
              opacity: entered ? 1 : 0,
              transition: reduced ? 'none' : `opacity 400ms ease ${400 + i * 80}ms`,
            }}
          >
            {xl.label}
          </text>
        ))}
      </svg>
    </>
  )
}

// ── Featured Source Card — SourceCard style with sub-markets ─
function FeaturedSourceCard({
  source,
  marketCount,
  status,
  index,
  reduced,
}: {
  source: { sourceId: string; name: string; logo: string; brandBg: string; valueLabel: string; valueUnit: string; category: string; isPrice: boolean; prefixes: string[] }
  marketCount: number
  status: string
  index: number
  reduced: boolean | null
}) {
  const accentColor = ACCENT_OVERRIDES[source.sourceId] ?? (
    source.brandBg.startsWith('#') && source.brandBg !== '#f5f5f5' && source.brandBg !== '#f0f2f5'
      ? source.brandBg
      : '#00A36C'
  )
  const isHealthy = status === 'healthy'
  const shortName = HERO_SHORT_NAMES[source.sourceId] ?? source.name

  // Fetch live sub-market data
  const dataNodeId = toInternalId(source.sourceId)
  const { data: snapshot } = useSourceSnapshot(dataNodeId)

  // Fetch 7-day price history for top markets once we know which they are
  const [historyData, setHistoryData] = useState<Record<string, { value: number; ts: number }[]>>({})
  const [historyIds, setHistoryIds] = useState<string[]>([])
  const [historyLoaded, setHistoryLoaded] = useState(false)

  // Pick top 4 markets — source-specific filtering
  const topMarkets = useMemo(() => {
    if (!snapshot?.prices?.length) return []
    let filtered = snapshot.prices.filter(p => p.value && parseFloat(p.value) > 0)

    if (source.sourceId === 'twitch') {
      // Only show whitelisted English-speaking streamers, sorted by biggest viewer loss.
      const STREAM_PREFIX = 'twitch_stream_'
      const streamers = filtered.filter(p => {
        const id = p.assetId || p.symbol || ''
        if (!id.startsWith(STREAM_PREFIX)) return false
        const login = id.slice(STREAM_PREFIX.length)
        return PREFERRED_US_STREAMERS.has(login)
      })
      if (streamers.length > 0) {
        // Sort by most negative changePct (biggest losers first)
        filtered = streamers.sort((a, b) => {
          const aPct = parseFloat(a.changePct ?? '0')
          const bPct = parseFloat(b.changePct ?? '0')
          return aPct - bPct
        })
      } else {
        // No preferred streamers online — fall back to game categories
        filtered = filtered.filter(p => {
          const id = p.assetId || p.symbol || ''
          return !id.startsWith(STREAM_PREFIX)
        })
      }
    }

    if (source.sourceId === 'db_trains') {
      // Prefer entries with line numbers (ICE, RE, S-Bahn lines) — more recognizable
      const lines = filtered.filter(p => {
        const id = p.assetId || p.symbol || p.name || ''
        return /^(ICE|RE|RB|S)\d|line_/.test(id)
      })
      if (lines.length >= 4) filtered = lines
    }

    // Twitch already sorted by biggest loser — skip re-sorting by value
    if (source.sourceId === 'twitch') {
      return filtered.slice(0, 4)
    }

    return [...filtered]
      .sort((a, b) => parseFloat(b.value) - parseFloat(a.value))
      .slice(0, 4)
  }, [snapshot?.prices, source.sourceId])

  // Fetch real history for the selected top markets
  const topIds = useMemo(() => topMarkets.map(m => m.assetId || m.symbol).filter(Boolean), [topMarkets])
  const topIdsKey = topIds.join(',')

  useEffect(() => {
    if (topIds.length === 0 || topIdsKey === historyIds.join(',')) return
    setHistoryIds(topIds)
    setHistoryLoaded(false)

    let cancelled = false
    fetch(`/api/market/batch-history?assets=${encodeURIComponent(topIds.join(','))}`, {
      signal: AbortSignal.timeout(15_000),
    })
      .then(r => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json() })
      .then(json => {
        if (cancelled) return
        // data-node returns { data: { [assetId]: [{ value, fetchedAt, ... }, ...] } }
        // (camelCase — MarketPriceRecord uses #[serde(rename_all = "camelCase")])
        const parsed: Record<string, { value: number; ts: number }[]> = {}
        const rawData = json.data || {}
        for (const [assetId, records] of Object.entries(rawData)) {
          parsed[assetId] = (records as any[]).map(r => ({
            value: typeof r.value === 'string' ? parseFloat(r.value) : r.value,
            ts: new Date(r.fetchedAt).getTime(),
          })).sort((a, b) => a.ts - b.ts)
        }
        setHistoryData(parsed)
        setHistoryLoaded(true)
      })
      .catch(() => { if (!cancelled) setHistoryLoaded(true) })

    return () => { cancelled = true }
  }, [topIdsKey]) // eslint-disable-line react-hooks/exhaustive-deps

  // True once fetch has resolved AND at least one shown market has real history.
  // Without this, the chart would paint procedurally-generated noise.
  const hasRealHistory = historyLoaded && topIds.some(id => (historyData[id]?.length ?? 0) >= 2)

  // Brand background style
  const brandStyle: React.CSSProperties = source.brandBg.startsWith('linear-gradient')
    ? { background: source.brandBg }
    : { backgroundColor: source.brandBg }

  const isLightBg = (() => {
    const hex = source.brandBg.replace('#', '')
    if (hex.length !== 6) return false
    const r = parseInt(hex.slice(0, 2), 16)
    const g = parseInt(hex.slice(2, 4), 16)
    const b = parseInt(hex.slice(4, 6), 16)
    return (r * 0.299 + g * 0.587 + b * 0.114) > 200
  })()

  const entranceDelay = `${(0.1 + index * 0.08).toFixed(2)}s`

  return (
    <div
      className={`group border border-zinc-200 overflow-hidden cursor-pointer hover:border-zinc-300 rounded-xl lg:rounded-none shadow-sm lg:shadow-none h-full flex flex-col ${reduced ? '' : 'css-entrance css-hover-lift'}`}
      style={{
        background: `linear-gradient(180deg, ${accentColor}08 0%, white 35%, white 100%)`,
        animationDelay: reduced ? undefined : entranceDelay,
        '--hover-shadow': `0 12px 32px ${accentColor}15, 0 4px 12px rgba(0,0,0,0.06)`,
      } as React.CSSProperties}
    >
      <Link href={`/source/${source.sourceId}`} className="block flex-1 flex flex-col relative">
        {/* Accent bar */}
        <div className="h-[3px]" style={{ background: `linear-gradient(90deg, ${accentColor}, ${accentColor}44)` }} />
        {/* Source header — brand icon + name */}
        <div className="flex items-center gap-3 px-3 pt-3 pb-2">
          <img
            src={`/source-imgs/icons/${source.sourceId}.png`}
            alt={shortName}
            width={32}
            height={32}
            loading="eager"
            className="w-8 h-8 shrink-0 object-contain"
          />
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between">
              <h3 className="text-[15px] font-extrabold text-black tracking-[-0.02em]">{shortName}</h3>
              <div className="flex items-center gap-1.5 shrink-0 rounded-full px-1.5 py-0.5" style={isHealthy ? { backgroundColor: `${accentColor}12` } : undefined}>
                {isHealthy && (
                  <span className="relative flex h-[5px] w-[5px]">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-60" style={{ backgroundColor: accentColor }} />
                    <span className="relative inline-flex rounded-full h-[5px] w-[5px]" style={{ backgroundColor: accentColor }} />
                  </span>
                )}
                <span className={`text-[10px] font-semibold ${isHealthy ? '' : 'text-zinc-400'}`} style={isHealthy ? { color: accentColor } : undefined}>
                  {isHealthy ? 'Live' : status}
                </span>
              </div>
            </div>
            <p className="text-[11px] text-zinc-400 -mt-0.5">
              <span className="font-mono font-semibold tabular-nums">{marketCount > 0 ? marketCount.toLocaleString() : '—'}</span>
              {' '}markets · {source.valueLabel}
            </p>
          </div>
        </div>

        {/* Sub-market rows */}
        <div className="border-t border-zinc-100">
          {topMarkets.length > 0 ? (
            topMarkets.map((m, idx) => (
              <SubMarketRow key={m.assetId} market={m} displaySourceId={source.sourceId} prefixes={source.prefixes ?? []} isPrice={source.isPrice} valueUnit={source.valueUnit} colorIndex={idx} />
            ))
          ) : (
            <div className="px-3 py-3">
              {[0, 1, 2, 3].map(i => (
                <div key={i} className="h-3 bg-zinc-50 rounded mb-1.5 last:mb-0" style={{ width: `${75 - i * 10}%` }} />
              ))}
            </div>
          )}
        </div>

        {/* Chart area — Polymarket-style with grid, fills, smooth curves.
            Only renders once real history arrives; otherwise a loading shell. */}
        {topMarkets.length > 0 && hasRealHistory ? (
          <div className="border-t border-zinc-100 px-2 pt-2 pb-1 flex-1" style={{ background: `linear-gradient(180deg, transparent 0%, ${accentColor}06 100%)` }}>
            <div className="relative h-[140px] w-full">
              <MultiLineChart
                marketIds={topMarkets.map(m => m.assetId || m.symbol).filter(Boolean)}
                markets={topMarkets.map(m => ({ name: m.name || m.symbol || '', assetId: m.assetId || '' }))}
                valueLabel={source.valueLabel}
                historyData={historyData}
              />
            </div>
          </div>
        ) : (
          <div className="border-t border-zinc-100 flex-1 min-h-[140px] relative" style={{ background: `linear-gradient(180deg, transparent 0%, ${accentColor}06 100%)` }}>
            <div className="absolute inset-0 animate-pulse bg-gradient-to-b from-transparent to-zinc-50/50" />
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="text-[11px] font-medium text-zinc-400 tracking-wide">Loading chart…</span>
            </div>
          </div>
        )}
      </Link>
    </div>
  )
}

// ── Featured Sources Container ──────────────────────────────
function FeaturedSources({ reduced }: { reduced: boolean | null }) {
  const { sources } = useSourceRegistry()
  const { data: meta } = useMarketSnapshotMeta()

  const featured = useMemo(() => {
    if (sources.length === 0) return []
    return FEATURED_SOURCE_IDS
      .map(id => sources.find(s => s.sourceId === id))
      .filter(Boolean) as typeof sources
  }, [sources])

  if (featured.length === 0) {
    return (
      <div className="flex lg:grid lg:grid-cols-4 overflow-x-auto lg:overflow-visible snap-x snap-mandatory gap-3 lg:gap-0 lg:border lg:border-zinc-200 mt-10 w-full max-w-site pb-1 lg:pb-0 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {[0, 1, 2, 3].map(i => (
          <div key={i} className="snap-start shrink-0 w-[75vw] min-w-[260px] max-w-[300px] lg:w-auto lg:min-w-0 lg:max-w-none lg:border-r lg:border-zinc-200 lg:last:border-r-0">
            <div className="border border-zinc-200 lg:border-0 overflow-hidden rounded-xl lg:rounded-none h-full flex flex-col animate-pulse">
              <div className="h-[3px] bg-zinc-200" />
              <div className="flex items-center gap-3 px-3 pt-3 pb-2">
                <div className="w-8 h-8 rounded bg-zinc-100 shrink-0" />
                <div className="flex-1">
                  <div className="h-4 w-24 bg-zinc-100 rounded" />
                  <div className="h-3 w-16 bg-zinc-50 rounded mt-1" />
                </div>
              </div>
              <div className="border-t border-zinc-100 px-3 py-2 space-y-2">
                {[0, 1, 2, 3].map(j => (
                  <div key={j} className="h-3 bg-zinc-50 rounded" style={{ width: `${85 - j * 10}%` }} />
                ))}
              </div>
              <div className="border-t border-zinc-100 flex-1 min-h-[140px] bg-zinc-50/50" />
            </div>
          </div>
        ))}
      </div>
    )
  }

  return (
    <div className="mt-10 w-full max-w-site">
      <div className="flex lg:grid lg:grid-cols-4 overflow-x-auto lg:overflow-visible snap-x snap-mandatory gap-3 lg:gap-0 lg:border lg:border-zinc-200 pb-1 lg:pb-0 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {featured.map((source, i) => {
          const count = meta?.assetCounts
            ? allInternalIds(source.sourceId).reduce(
                (sum, iid) => sum + (meta.assetCounts[iid] ?? 0),
                0,
              )
            : 0
          const status = meta?.sources?.find(
            s => s.sourceId === source.sourceId || allInternalIds(source.sourceId).includes(s.sourceId),
          )?.status ?? 'unknown'

          return (
            <div key={source.sourceId} className="snap-start shrink-0 w-[75vw] min-w-[260px] max-w-[300px] lg:w-auto lg:min-w-0 lg:max-w-none lg:border-r lg:border-zinc-200 lg:last:border-r-0">
              <FeaturedSourceCard
                source={source}
                marketCount={count}
                status={status}
                index={i}
                reduced={reduced}
              />
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ── Scrolling Market Ticker — Two lines, opposite directions ─
type TickerItem = { label: string; sourceId: string }
const TICKER_ROW_1: TickerItem[] = [
  { label: 'Twitch viewership', sourceId: 'twitch' },
  { label: 'Train delays Germany', sourceId: 'db_trains' },
  { label: 'Steam player counts', sourceId: 'steam' },
  { label: 'Earthquake magnitude', sourceId: 'earthquake' },
  { label: 'Bitcoin price', sourceId: 'coingecko' },
  { label: 'Reddit subscribers', sourceId: 'reddit' },
  { label: 'Weather forecasts', sourceId: 'weather' },
  { label: 'Anime popularity', sourceId: 'anilist' },
  { label: 'GitHub stars', sourceId: 'github' },
  { label: 'Movie box office', sourceId: 'tmdb' },
  { label: 'Theme park wait times', sourceId: 'queue_times' },
  { label: 'NYC subway disruptions', sourceId: 'mta_subway' },
]
const TICKER_ROW_2: TickerItem[] = [
  { label: 'Oil futures', sourceId: 'eia_petroleum' },
  { label: 'Congressional trades', sourceId: 'congress' },
  { label: 'DeFi TVL', sourceId: 'defillama' },
  { label: 'Music charts', sourceId: 'lastfm' },
  { label: 'Esports results', sourceId: 'sports' },
  { label: 'Flight tracking', sourceId: 'flightradar' },
  { label: 'Volcano activity', sourceId: 'volcano' },
  { label: 'Air quality index', sourceId: 'airnow' },
  { label: 'Board game rankings', sourceId: 'bgg' },
  { label: 'Short selling volume', sourceId: 'finra_short' },
  { label: 'Space weather', sourceId: 'spaceweather' },
  { label: 'Bird sightings', sourceId: 'ebird' },
]

function TickerRow({ items, reverse }: { items: TickerItem[]; reverse?: boolean }) {
  const doubled = [...items, ...items]
  return (
    <div className="flex gap-2.5 whitespace-nowrap" style={{
      animation: `${reverse ? 'scroll-x-rev' : 'scroll-x'} ${reverse ? '45s' : '38s'} linear infinite`,
    }}>
      {doubled.map((item, i) => (
        <Link
          key={i}
          href={`/source/${item.sourceId}`}
          className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full border border-zinc-200 bg-white text-[12px] font-medium text-zinc-600 hover:border-zinc-400 hover:text-black transition-colors cursor-pointer shrink-0"
        >
          <img
            src={`/source-imgs/icons/${item.sourceId}.png`}
            alt=""
            width={20}
            height={20}
            className="w-5 h-5 shrink-0 object-contain"
            loading="lazy"
          />
          {item.label}
        </Link>
      ))}
    </div>
  )
}

function ScrollingTicker() {
  return (
    <div className="w-full overflow-hidden mt-6 mb-2 mask-fade-x flex flex-col gap-2">
      <TickerRow items={TICKER_ROW_1} />
      <TickerRow items={TICKER_ROW_2} reverse />
      <style jsx global>{`
        @keyframes scroll-x {
          0% { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }
        @keyframes scroll-x-rev {
          0% { transform: translateX(-50%); }
          100% { transform: translateX(0); }
        }
        .mask-fade-x {
          mask-image: linear-gradient(90deg, transparent 0%, black 5%, black 95%, transparent 100%);
          -webkit-mask-image: linear-gradient(90deg, transparent 0%, black 5%, black 95%, transparent 100%);
        }
      `}</style>
    </div>
  )
}

// ── Rank Badge ───────────────────────────────────────────────
// Minimal: thin border circle, monospace number, faint accent tint.
// Matches the zinc/white/border language of the rest of the site.
function RankBadge({ rank, accent }: { rank: number; accent: { glow: string; badge: string } }) {
  return (
    <span
      className="w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-black font-mono tabular-nums shrink-0 border"
      style={{
        borderColor: accent.glow,
        color: accent.glow,
        backgroundColor: `${accent.glow}10`,
      }}
    >
      {rank}
    </span>
  )
}

// ── Hero Leaderboard ─────────────────────────────────────────
// Top-3 podium cards, compact rows for 4-8. All click → /profile/[address].
const RANK_ACCENT = [
  {
    // Gold — #1
    color: [251, 191, 36] as const,
    glow: '#fbbf24',
    shadow: '0 8px 24px rgba(251,191,36,0.18)',
    badge: 'bg-amber-400 text-amber-950',
  },
  {
    // Silver — #2
    color: [168, 178, 193] as const,
    glow: '#a8b2c1',
    shadow: '0 8px 24px rgba(148,163,184,0.18)',
    badge: 'bg-slate-300 text-slate-800',
  },
  {
    // Bronze — #3
    color: [205, 127, 50] as const,
    glow: '#cd7f32',
    shadow: '0 8px 24px rgba(205,127,50,0.15)',
    badge: 'bg-amber-600 text-amber-50',
  },
] as const
function fmtVol(v: number): string {
  if (v >= 1e6) return `$${(v / 1e6).toFixed(1)}M`
  if (v >= 1e3) return `$${(v / 1e3).toFixed(1)}K`
  return `$${v.toFixed(0)}`
}
function fmtPnl(pnl: number): { text: string; color: string } {
  const abs = Math.abs(pnl)
  const s = abs >= 1000 ? `$${(abs / 1000).toFixed(1)}K` : `$${abs.toFixed(2)}`
  if (pnl > 0) return { text: `+${s}`, color: 'text-emerald-500' }
  if (pnl < 0) return { text: `-${s}`, color: 'text-red-500' }
  return { text: '$0.00', color: 'text-zinc-400' }
}
function truncAddr(a: string): string {
  return a.length > 12 ? `${a.slice(0, 6)}...${a.slice(-4)}` : a
}

/** Per-source stats for a player */
interface SourceStat {
  sourceId: string
  pnl: number
  deposited: number
  active: boolean
}

/** Row of source logos — clickable, with tooltip showing PnL and position status.
 *  Deferred: only fetches profile data when the row is visible (IntersectionObserver). */
function PlayerTopSources({ address, max = 10 }: { address: string; max?: number }) {
  const [visible, setVisible] = useState(false)
  const sentinelRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const el = sentinelRef.current
    if (!el) return
    const io = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) { setVisible(true); io.disconnect() } },
      { rootMargin: '200px' },
    )
    io.observe(el)
    return () => io.disconnect()
  }, [])

  if (!visible) return <div ref={sentinelRef} className="w-20 h-[18px]" />

  return <PlayerTopSourcesInner address={address} max={max} />
}

function PlayerTopSourcesInner({ address, max = 10 }: { address: string; max?: number }) {
  const { profile } = usePlayerProfile(address)
  const { sources } = useSourceRegistry()

  const topSources = useMemo<SourceStat[]>(() => {
    if (!profile?.batches?.length || !sources.length) return []
    const validIds = new Set(sources.map(s => s.sourceId))
    const agg: Record<string, { pnl: number; deposited: number; active: boolean }> = {}
    for (const b of profile.batches) {
      let src = b.sourceId
      if (!src) continue
      if (!validIds.has(src)) src = src.replace(/_v\d+$/, '')
      if (!validIds.has(src)) continue
      if (!agg[src]) agg[src] = { pnl: 0, deposited: 0, active: false }
      agg[src].pnl += b.balance - b.deposited
      agg[src].deposited += b.deposited
      if (b.status === 'active') agg[src].active = true
    }
    return Object.entries(agg)
      .sort((a, b) => b[1].pnl - a[1].pnl)
      .slice(0, max)
      .map(([sourceId, s]) => ({ sourceId, ...s }))
  }, [profile?.batches, sources, max])

  if (topSources.length === 0) return null

  return (
    <div className="flex items-center gap-1 flex-wrap">
      {topSources.map(s => (
        <SourceIconLink key={s.sourceId} stat={s} />
      ))}
    </div>
  )
}

function SourceIconLink({ stat }: { stat: SourceStat }) {
  const [err, setErr] = useState(false)
  const [hover, setHover] = useState(false)

  if (err) return null

  const pctStr = stat.deposited > 0
    ? `${stat.pnl >= 0 ? '+' : ''}${((stat.pnl / stat.deposited) * 100).toFixed(1)}%`
    : '—'
  const pnlAbs = Math.abs(stat.pnl)
  const dollarStr = pnlAbs >= 1000
    ? `${stat.pnl >= 0 ? '+' : '-'}$${(pnlAbs / 1000).toFixed(1)}K`
    : `${stat.pnl >= 0 ? '+' : '-'}$${pnlAbs.toFixed(2)}`

  return (
    <Link
      href={`/source/${stat.sourceId}`}
      className="relative shrink-0"
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      onClick={(e) => e.stopPropagation()}
    >
      <img
        src={`/source-imgs/icons/${stat.sourceId}.png`}
        alt={stat.sourceId}
        width={18}
        height={18}
        className={`w-[18px] h-[18px] rounded-sm object-contain bg-zinc-50 transition-transform hover:scale-125 ${stat.active ? 'ring-1 ring-emerald-400' : ''}`}
        loading="lazy"
        onError={() => setErr(true)}
      />
      {hover && (
        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 px-2 py-1.5 bg-white text-zinc-700 text-[10px] rounded shadow-lg ring-1 ring-zinc-200 whitespace-nowrap z-[100] pointer-events-none">
          <span className={stat.pnl >= 0 ? 'text-emerald-600' : 'text-red-500'}>{dollarStr}</span>
          <span className="text-zinc-300 mx-1">·</span>
          <span className={stat.pnl >= 0 ? 'text-emerald-600' : 'text-red-500'}>{pctStr}</span>
          {stat.active && <span className="text-zinc-300 mx-1">·</span>}
          {stat.active && <span className="text-emerald-600">in position</span>}
        </div>
      )}
    </Link>
  )
}
function AnimatedWinRateBar({ rate, delay = 0 }: { rate: number; delay?: number }) {
  const pct = Math.max(0, Math.min(100, rate))
  const reduced = useReducedMotion()
  return (
    <div className="flex items-center gap-2">
      <div className="w-20 h-1.5 bg-zinc-100 rounded-full overflow-hidden">
        <motion.div
          className="h-full rounded-full bg-emerald-400"
          initial={reduced ? false : { width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ ...springs.number, delay: 0.4 + delay }}
        />
      </div>
      <span className="text-[10px] font-mono tabular-nums text-zinc-400">{pct.toFixed(0)}%</span>
    </div>
  )
}

// ── Podium Card ──
function PodiumCard({ player, accentIdx, height, displayIdx, goTo, reduced }: {
  player: any; accentIdx: number; height: string; displayIdx: number
  goTo: (addr: string) => void; reduced: boolean | null
}) {
  const accent = RANK_ACCENT[accentIdx]
  const pnl = fmtPnl(player.pnl)
  const rank = player.rank || accentIdx + 1
  const vol = player.totalVolume || player.volume || 0
  return (
    <motion.button
      key={player.walletAddress}
      onClick={() => goTo(player.walletAddress)}
      initial={reduced ? false : { opacity: 0, y: 20, scale: 0.96 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ ...springs.entrance, delay: displayIdx * 0.1 }}
      whileHover={reduced ? undefined : { y: -4, boxShadow: accent.shadow }}
      className={`relative flex flex-col bg-white border border-zinc-200/80 pt-4 px-4 pb-4 sm:pt-5 sm:px-5 sm:pb-5 text-left cursor-pointer group transition-colors w-full ${height}`}
    >
      {/* Accent bar */}
      <div className="absolute top-0 left-0 right-0 h-[3px]" style={{ background: accent.glow }} />

      <div className="relative flex items-center gap-2.5">
        <RankBadge rank={rank} accent={accent} />
        <p className="font-mono text-[13px] font-bold text-zinc-800 group-hover:text-zinc-500 transition-colors truncate flex-1">
          {truncAddr(player.walletAddress)}
        </p>
        <PlayerTopSources address={player.walletAddress} max={3} />
      </div>

      <SpringNumber
        value={player.pnl}
        format={(n) => {
          const abs = Math.abs(n)
          const s = abs >= 1000 ? `$${(abs / 1000).toFixed(1)}K` : `$${abs.toFixed(2)}`
          return n >= 0 ? `+${s}` : `-${s}`
        }}
        className={`relative block text-[26px] font-black tabular-nums tracking-tight mt-2 ${pnl.color}`}
      />

      <div className="relative grid grid-cols-3 gap-x-2 mt-auto pt-3 border-t border-zinc-100">
        <div>
          <span className="block text-[10px] text-zinc-400 uppercase tracking-wider">ROI</span>
          <span className={`block font-mono tabular-nums text-[12px] font-semibold ${player.roi >= 0 ? 'text-emerald-500' : 'text-red-500'}`}>
            {player.roi >= 0 ? '+' : ''}{player.roi.toFixed(1)}%
          </span>
        </div>
        <div>
          <span className="block text-[10px] text-zinc-400 uppercase tracking-wider">Volume</span>
          <span className="block font-mono tabular-nums text-[12px] font-semibold text-zinc-700">{fmtVol(vol)}</span>
        </div>
        <div>
          <span className="block text-[10px] text-zinc-400 uppercase tracking-wider">Rounds</span>
          <span className="block font-mono tabular-nums text-[12px] font-semibold text-zinc-700">{player.roundsPlayed}</span>
        </div>
      </div>

      <div className="relative mt-2.5">
        <AnimatedWinRateBar rate={player.winRate} delay={displayIdx * 0.1} />
      </div>
    </motion.button>
  )
}

export function HeroLeaderboard() {
  const { leaderboard, isLoading } = useVisionLeaderboard()
  const router = useRouter()
  const reduced = useReducedMotion()
  const top8 = leaderboard.slice(0, 8)

  if (isLoading) {
    return (
      <div className="max-w-site mx-auto px-6 lg:px-12 py-8">
        <div className="flex items-end gap-3 mb-3">
          <div className="flex-1 h-[148px] bg-zinc-50 animate-pulse" />
          <div className="flex-[1.15] h-[176px] bg-zinc-50 animate-pulse" />
          <div className="flex-1 h-[136px] bg-zinc-50 animate-pulse" />
        </div>
        <div className="h-[200px] bg-zinc-50 animate-pulse" />
      </div>
    )
  }

  const podium = top8.slice(0, 3)
  const rest = top8.slice(3)
  const goTo = (addr: string) => router.push(`/profile/${addr}`)

  // Desktop: 2-1-3 visual podium. Mobile: natural 1-2-3 order (scroll starts at #1).
  const podiumDesktop = podium.length >= 3 ? [
    { player: podium[1], accentIdx: 1, height: 'min-h-[152px]' },
    { player: podium[0], accentIdx: 0, height: 'min-h-[196px]' },
    { player: podium[2], accentIdx: 2, height: 'min-h-[136px]' },
  ] : []
  const podiumMobile = podium.length >= 3 ? [
    { player: podium[0], accentIdx: 0, height: 'min-h-[152px]' },
    { player: podium[1], accentIdx: 1, height: 'min-h-[152px]' },
    { player: podium[2], accentIdx: 2, height: 'min-h-[152px]' },
  ] : []

  return (
    <div className="max-w-site mx-auto px-6 lg:px-12 py-8 overflow-hidden">
      <div>
          <div className="flex items-end justify-between mb-5">
            <div>
              <h2 className="text-[18px] font-semibold text-black tracking-[-0.02em]">Leaderboard</h2>
              <p className="text-[12px] text-zinc-400 mt-0.5">Ranked by P&L across all prediction markets</p>
            </div>
            <Link href="/explorer" className="text-[12px] font-semibold text-zinc-500 hover:text-black transition-colors">
              View all &rarr;
            </Link>
          </div>

          {/* Mobile: 1-2-3 order, equal height, full-width stack */}
          {podiumMobile.length > 0 && (
            <div className="flex flex-col gap-2 mb-3 sm:hidden">
              {podiumMobile.map(({ player, accentIdx, height }, displayIdx) => (
                <PodiumCard
                  key={player.walletAddress}
                  player={player}
                  accentIdx={accentIdx}
                  height={height}
                  displayIdx={displayIdx}
                  goTo={goTo}
                  reduced={reduced}
                />
              ))}
            </div>
          )}

          {/* Desktop: 2-1-3 podium layout */}
          {podiumDesktop.length > 0 && (
            <div className="hidden sm:grid sm:grid-cols-[1fr_1.15fr_1fr] gap-3 items-end mb-3">
              {podiumDesktop.map(({ player, accentIdx, height }, displayIdx) => (
                <PodiumCard
                  key={player.walletAddress}
                  player={player}
                  accentIdx={accentIdx}
                  height={height}
                  displayIdx={displayIdx}
                  goTo={goTo}
                  reduced={reduced}
                />
              ))}
            </div>
          )}

          {rest.length > 0 && (
            <div className="border border-zinc-200 bg-white">
              {rest.map((player, i) => {
                const pnl = fmtPnl(player.pnl)
                const vol = player.totalVolume || player.volume || 0
                const rank = player.rank || i + 4
                return (
                  <motion.button
                    key={player.walletAddress}
                    onClick={() => goTo(player.walletAddress)}
                    initial={reduced ? false : { opacity: 0, x: -8 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ ...springs.entrance, delay: 0.3 + i * 0.05 }}
                    className={`w-full text-left hover:bg-zinc-50 transition-colors cursor-pointer ${i < rest.length - 1 ? 'border-b border-zinc-100' : ''}`}
                  >
                    {/* Desktop: grid with fixed column widths so numbers align */}
                    <div className="hidden sm:grid grid-cols-[24px_110px_1fr_56px_56px_56px_80px] items-center gap-x-2 px-4 py-2.5">
                      <span className="text-[12px] font-bold text-zinc-300 font-mono tabular-nums">{rank}</span>
                      <span className="font-mono text-[12px] text-black font-medium truncate">{truncAddr(player.walletAddress)}</span>
                      <span className="overflow-hidden"><PlayerTopSources address={player.walletAddress} max={10} /></span>
                      <span className="text-right font-mono tabular-nums text-[11px] text-zinc-400">{player.roundsPlayed}</span>
                      <span className="text-right font-mono tabular-nums text-[11px] text-zinc-400">{fmtVol(vol)}</span>
                      <span className={`text-right font-mono tabular-nums text-[11px] font-semibold ${player.roi >= 0 ? 'text-emerald-500' : 'text-red-500'}`}>
                        {player.roi >= 0 ? '+' : ''}{player.roi.toFixed(1)}%
                      </span>
                      <span className={`text-right font-mono tabular-nums text-[12px] font-bold ${pnl.color}`}>{pnl.text}</span>
                    </div>
                    {/* Mobile */}
                    <div className="grid sm:hidden grid-cols-[20px_1fr_48px_64px] items-center gap-x-1 px-3 py-2.5">
                      <span className="text-[11px] font-bold text-zinc-300 font-mono tabular-nums">{rank}</span>
                      <span className="font-mono text-[11px] text-black font-medium truncate">{truncAddr(player.walletAddress)}</span>
                      <span className={`text-right font-mono tabular-nums text-[11px] font-semibold ${player.roi >= 0 ? 'text-emerald-500' : 'text-red-500'}`}>
                        {player.roi >= 0 ? '+' : ''}{player.roi.toFixed(1)}%
                      </span>
                      <span className={`text-right font-mono tabular-nums text-[12px] font-bold ${pnl.color}`}>{pnl.text}</span>
                    </div>
                  </motion.button>
                )
              })}
            </div>
          )}
      </div>
    </div>
  )
}

export function WelcomeHero() {
  const [query, setQuery] = useState('')
  const [showResults, setShowResults] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const heroRef = useRef<HTMLDivElement>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)
  const [isSticky, setIsSticky] = useState(false)

  const router = useRouter()
  const { results, loading, total } = useMarketSearch(query)
  const { data: meta } = useMarketSnapshotMeta()
  const reduced = useReducedMotion()

  const assetCount = meta?.totalAssets ?? 0
  const placeholder = assetCount > 0
    ? `Search through ${assetCount.toLocaleString()} liquid prediction markets...`
    : 'Search through 300,000+ liquid prediction markets...'

  // Track when hero scrolls out of view
  useEffect(() => {
    const hero = heroRef.current
    if (!hero) return
    const observer = new IntersectionObserver(
      ([entry]) => setIsSticky(!entry.isIntersecting),
      { threshold: 0, rootMargin: '-80px 0px 0px 0px' }
    )
    observer.observe(hero)
    return () => observer.disconnect()
  }, [])

  // Close dropdown on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setShowResults(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  // Focus search on / key
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === '/' && !e.ctrlKey && !e.metaKey && !e.altKey) {
        const tag = (e.target as HTMLElement)?.tagName
        if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return
        e.preventDefault()
        inputRef.current?.focus()
      }
    }
    document.addEventListener('keydown', handleKey)
    return () => document.removeEventListener('keydown', handleKey)
  }, [])

  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setQuery(e.target.value)
    setShowResults(true)
  }, [])


  const handleSelectMarket = useCallback((market: SearchMarket) => {
    router.push(`/source/${market.source}`)
    setShowResults(false)
  }, [router])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (results.length > 0) {
      handleSelectMarket(results[0])
    }
  }

  const hasResults = query.trim().length > 0 && (results.length > 0 || loading)

  return (
    <>
      {/* Hero section */}
      <div ref={heroRef} className="flex flex-col items-center justify-center px-6 lg:px-12 pt-12 pb-6 sm:pt-16 sm:pb-8">
        <motion.h1
          initial={reduced ? false : { opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={springs.page}
          className="text-[clamp(2.5rem,6vw,4rem)] font-black tracking-[-0.04em] text-black leading-[1.05] text-center"
        >
          Welcome back
        </motion.h1>

        <motion.p
          initial={reduced ? false : { opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ ...springs.page, delay: 0.06 }}
          className="mt-3 text-[17px] text-zinc-500 text-center"
        >
          What would you like to trade?
        </motion.p>

        {/* Featured source cards — live data, brand-colored, staggered spring entrance */}
        <FeaturedSources reduced={reduced} />

        {/* Search bar with autocomplete — prominent */}
        <motion.div
          initial={reduced ? false : { opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ ...springs.entrance, delay: 0.36 }}
          className="mt-8 w-full max-w-[720px] relative"
          ref={dropdownRef}
        >
          <form onSubmit={handleSubmit}>
            <div className="relative">
              <svg className="absolute left-5 top-1/2 -translate-y-1/2 text-zinc-500" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="11" cy="11" r="8" />
                <line x1="21" y1="21" x2="16.65" y2="16.65" />
              </svg>
              <input
                ref={inputRef}
                type="text"
                value={query}
                onChange={handleInputChange}
                onFocus={() => query.trim() && setShowResults(true)}
                placeholder={placeholder}
                aria-label="Search prediction markets"
                className="w-full h-[56px] pl-[52px] pr-14 rounded-2xl border-2 border-zinc-300 bg-white text-[16px] text-black placeholder:text-zinc-400 focus:outline-none focus:border-black focus:shadow-[0_0_0_4px_rgba(0,0,0,0.06)] transition-all duration-200"
              />
              {loading && (
                <div className="absolute right-4 top-1/2 -translate-y-1/2">
                  <div className="w-4 h-4 border-2 border-zinc-300 border-t-zinc-600 rounded-full animate-spin" />
                </div>
              )}
            </div>
          </form>

          {/* Autocomplete dropdown */}
          <AnimatePresence>
            {showResults && hasResults && (
              <motion.div
                initial={{ opacity: 0, y: -8, scale: 0.97 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -8, scale: 0.97 }}
                transition={springs.entrance}
                className="absolute top-full mt-1.5 left-0 right-0 bg-white rounded-xl border border-zinc-200 shadow-lg overflow-hidden z-50"
              >
                <div role="listbox" className="max-h-[360px] overflow-y-auto py-1">
                  {results.map((market) => (
                    <ResultRow
                      key={market.assetId}
                      market={market}
                      onClick={() => handleSelectMarket(market)}
                    />
                  ))}
                </div>
                {!loading && total > results.length && (
                  <div className="px-4 py-2 border-t border-zinc-100 text-[11px] text-zinc-400">
                    {total.toLocaleString()} markets found
                  </div>
                )}
                {loading && results.length === 0 && (
                  <div className="px-4 py-6 text-center">
                    <div className="w-5 h-5 border-2 border-zinc-300 border-t-zinc-600 rounded-full animate-spin mx-auto" />
                    <p className="text-[12px] text-zinc-400 mt-2">Searching markets...</p>
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>

          {/* No results state */}
          <AnimatePresence>
            {showResults && query.trim().length > 0 && !loading && results.length === 0 && (
              <motion.div
                initial={{ opacity: 0, y: -8, scale: 0.97 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -8, scale: 0.97 }}
                transition={springs.entrance}
                className="absolute top-full mt-1.5 left-0 right-0 bg-white rounded-xl border border-zinc-200 shadow-lg px-4 py-5 text-center z-50"
              >
                <p className="text-[13px] text-zinc-500">No markets found for &ldquo;{query}&rdquo;</p>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>

        {/* Scrolling market ticker */}
        <ScrollingTicker />

        {/* How it works link */}
        <motion.div
          initial={reduced ? false : { opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ ...springs.page, delay: 0.5 }}
          className="mt-3"
        >
          <a
            href="https://docs.generalmarket.io"
            target="_blank"
            rel="noopener noreferrer"
            className="text-[11px] text-zinc-400 underline underline-offset-2 hover:text-zinc-600 transition-colors"
          >
            How it works
          </a>
        </motion.div>
      </div>

      {/* Sticky search bar — appears when hero scrolls away */}
      <div
        className={`fixed top-[60px] sm:top-[64px] left-0 right-0 z-40 transition-all duration-300 ${
          isSticky
            ? 'opacity-100 translate-y-0 pointer-events-auto'
            : 'opacity-0 -translate-y-2 pointer-events-none'
        }`}
      >
        <div className="bg-white/80 backdrop-blur-xl border-b border-zinc-200/60">
          <div className="max-w-[720px] mx-auto px-4 py-2.5 relative">
            <form onSubmit={handleSubmit}>
              <div className="relative">
                <svg className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="11" cy="11" r="8" />
                  <line x1="21" y1="21" x2="16.65" y2="16.65" />
                </svg>
                <input
                  type="text"
                  value={query}
                  onChange={handleInputChange}
                  onFocus={() => query.trim() && setShowResults(true)}
                  placeholder="Search markets, sources, predictions..."
                  aria-label="Search prediction markets"
                  className="w-full h-[40px] pl-9 pr-10 rounded-lg border border-zinc-200 bg-white/90 text-[14px] text-black placeholder:text-zinc-400 focus:outline-none focus:border-zinc-400 transition-all duration-200"
                />
                {loading && (
                  <div className="absolute right-3 top-1/2 -translate-y-1/2">
                    <div className="w-3.5 h-3.5 border-2 border-zinc-300 border-t-zinc-600 rounded-full animate-spin" />
                  </div>
                )}
              </div>
            </form>

            {/* Sticky autocomplete dropdown */}
            <AnimatePresence>
              {isSticky && showResults && hasResults && (
                <motion.div
                  initial={{ opacity: 0, y: -8, scale: 0.97 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -8, scale: 0.97 }}
                  transition={springs.entrance}
                  className="absolute top-full left-4 right-4 mt-1 bg-white rounded-xl border border-zinc-200 shadow-lg overflow-hidden z-50"
                >
                  <div role="listbox" className="max-h-[320px] overflow-y-auto py-1">
                    {results.map((market) => (
                      <ResultRow
                        key={market.assetId}
                        market={market}
                        onClick={() => handleSelectMarket(market)}
                      />
                    ))}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>
    </>
  )
}
