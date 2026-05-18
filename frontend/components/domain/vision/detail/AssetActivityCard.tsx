'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { useAssetSettlements, type AssetSettlement } from '@/hooks/vision/useAssetSettlements'
import fundData from '@/data/fund-branding.json'

interface Props {
  sourceId: string
  dataNodeSourceId: string
  assetId: string
  isPrice: boolean
  valueUnit: string
  thresholdBps?: number | null
  resolutionType?: string | null
}

function formatRulePct(bps: number): string {
  const pct = bps / 100
  if (pct >= 10) return `${pct.toFixed(0)}%`
  if (pct >= 1) return `${pct.toFixed(1).replace(/\.0$/, '')}%`
  return `${pct.toFixed(2).replace(/0+$/, '').replace(/\.$/, '')}%`
}

interface PricePoint {
  ts: number
  value: number
}

interface FundEntry {
  name?: string
  symbol?: string
  vault?: string
  color?: string
}

const VAULT_BY_ADDR: Map<string, FundEntry> = (() => {
  const m = new Map<string, FundEntry>()
  for (const f of (fundData as { funds: FundEntry[] }).funds) {
    if (f.vault) m.set(f.vault.toLowerCase(), f)
  }
  return m
})()

const CHART_HEIGHT = 280
const CELL_W = 32
const COL_GAP = 4
const ROW_H = 28
const HEADER_H = 32
const LEFT_RAIL = 168
const TOP_N = 12
const X_PADDING = 16

type WindowHours = 12 | 24 | 168 | 1176
// Each row carries the full per-batch `player_results` JSONB (avg ~91KB).
// Smaller limits keep the proxy under its 45s budget and the network payload
// under a megabyte. The matrix only renders TOP_N rows, so deeper history
// rarely changes the visible result.
const WINDOW_OPTIONS: { hours: WindowHours; label: string; settleLimit: number }[] = [
  { hours: 12, label: '12h', settleLimit: 40 },
  { hours: 24, label: '24h', settleLimit: 60 },
  { hours: 168, label: '7d', settleLimit: 120 },
  { hours: 1176, label: '7w', settleLimit: 200 },
]
type ChartMode = 'settlement' | 'time'

function shortAddr(a: string): string {
  if (!a) return '?'
  const l = a.toLowerCase()
  return `${l.slice(0, 6)}…${l.slice(-4)}`
}

function formatValue(v: number, isPrice: boolean): string {
  if (!isFinite(v)) return '--'
  if (Math.abs(v) >= 1_000_000_000) return `${(v / 1_000_000_000).toFixed(2)}B`
  if (Math.abs(v) >= 1_000_000) return `${(v / 1_000_000).toFixed(2)}M`
  if (Math.abs(v) >= 1_000) return `${(v / 1_000).toFixed(2)}K`
  if (Math.abs(v) >= 1) return v.toFixed(2)
  if (Math.abs(v) >= 0.01) return v.toFixed(4)
  if (Math.abs(v) < 0.0001 && v !== 0) return v.toExponential(2)
  return isPrice ? v.toFixed(4) : v.toFixed(6)
}

function formatTime(t: number): string {
  return new Date(t).toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  })
}

function winnerOdds(s: AssetSettlement): {
  mult: number | null
  side: 'Up' | 'Down' | null
} {
  let up = 0n
  let down = 0n
  try {
    up = BigInt(s.upStake)
    down = BigInt(s.downStake)
  } catch {
    return { mult: null, side: null }
  }
  const total = up + down
  if (total === 0n) return { mult: null, side: null }
  if (s.outcome === 'Up' && up > 0n) {
    return { mult: Number((total * 1000n) / up) / 1000, side: 'Up' }
  }
  if (s.outcome === 'Down' && down > 0n) {
    return { mult: Number((total * 1000n) / down) / 1000, side: 'Down' }
  }
  return { mult: null, side: null }
}

interface Cell {
  side: 'Up' | 'Down' | null
  won: boolean
}

interface Row {
  player: string
  label: string
  isFund: boolean
  color?: string
  cells: Cell[]
  wins: number
  total: number
}

interface BatchCol {
  batch: AssetSettlement
  mult: number | null
  winSide: 'Up' | 'Down' | null
}

function buildMatrix(settlements: AssetSettlement[]): {
  columns: BatchCol[]
  rows: Row[]
} {
  const ordered = [...settlements].sort(
    (a, b) => new Date(a.settledAt).getTime() - new Date(b.settledAt).getTime(),
  )
  const columns: BatchCol[] = ordered.map(b => {
    const w = winnerOdds(b)
    return { batch: b, mult: w.mult, winSide: w.side }
  })
  const acc = new Map<string, Row>()
  ordered.forEach((s, colIdx) => {
    s.players.forEach(p => {
      const key = p.player.toLowerCase()
      const fund = VAULT_BY_ADDR.get(key)
      let row = acc.get(key)
      if (!row) {
        row = {
          player: p.player,
          label: fund?.name || shortAddr(p.player),
          isFund: !!fund,
          color: fund?.color,
          cells: ordered.map(() => ({ side: null, won: false })),
          wins: 0,
          total: 0,
        }
        acc.set(key, row)
      }
      row.cells[colIdx] = { side: p.side, won: p.won }
      row.total += 1
      if (p.won) row.wins += 1
    })
  })
  const rows = [...acc.values()]
    .sort((a, b) => {
      if (a.isFund !== b.isFund) return a.isFund ? -1 : 1
      if (b.total !== a.total) return b.total - a.total
      if (b.wins !== a.wins) return b.wins - a.wins
      return a.label.localeCompare(b.label)
    })
    .slice(0, TOP_N)
  return { columns, rows }
}

function CellGlyph({ side, won }: Cell) {
  if (!side) {
    return <span style={{ color: 'var(--apple-text-tertiary)', opacity: 0.35 }}>·</span>
  }
  const color = won ? 'rgb(52,199,89)' : 'rgb(255,59,48)'
  return (
    <span
      style={{
        color,
        fontSize: 13,
        opacity: won ? 1 : 0.5,
        lineHeight: 1,
      }}
    >
      {side === 'Up' ? '▲' : '▼'}
    </span>
  )
}

function nearestValue(points: PricePoint[], ts: number): number | null {
  if (points.length === 0) return null
  let bestIdx = 0
  let bestDiff = Math.abs(points[0].ts - ts)
  for (let i = 1; i < points.length; i++) {
    const d = Math.abs(points[i].ts - ts)
    if (d < bestDiff) {
      bestDiff = d
      bestIdx = i
    }
  }
  return points[bestIdx].value
}

export function AssetActivityCard({
  sourceId: _sourceId,
  dataNodeSourceId,
  assetId,
  isPrice,
  valueUnit,
  thresholdBps,
  resolutionType,
}: Props) {
  const thresholdRatio =
    thresholdBps != null && thresholdBps > 0 ? thresholdBps / 10000 : null
  const thresholdLabel =
    thresholdBps != null && thresholdBps > 0 ? formatRulePct(thresholdBps) : null
  const isBinary =
    thresholdBps === 0 || (resolutionType ?? '').endsWith('_0')
  const [windowHours, setWindowHours] = useState<WindowHours>(12)
  const [chartMode, setChartMode] = useState<ChartMode>('settlement')
  const [leftIdx, setLeftIdx] = useState(0)
  const [points, setPoints] = useState<PricePoint[]>([])
  const [loading, setLoading] = useState(true)
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    const now = Date.now()
    const from = new Date(now - windowHours * 60 * 60 * 1000).toISOString()
    const to = new Date(now).toISOString()
    fetch(
      `/api/market/history?source=${encodeURIComponent(dataNodeSourceId)}&asset=${encodeURIComponent(
        assetId,
      )}&from=${from}&to=${to}`,
      { signal: AbortSignal.timeout(15_000) },
    )
      .then(r => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`))))
      .then(d => {
        if (cancelled) return
        const ps: PricePoint[] = (d.prices || []).map((p: Record<string, unknown>) => ({
          ts: new Date(p.fetchedAt as string).getTime(),
          value: typeof p.value === 'string' ? parseFloat(p.value as string) : (p.value as number),
        }))
        ps.sort((a, b) => a.ts - b.ts)
        setPoints(ps)
      })
      .catch(() => setPoints([]))
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [dataNodeSourceId, assetId, windowHours])

  const settlementLimit = useMemo(
    () => WINDOW_OPTIONS.find(o => o.hours === windowHours)?.settleLimit ?? 200,
    [windowHours],
  )
  const {
    data: settlements,
    isLoading: settlementsLoading,
    isError: settlementsFailed,
  } = useAssetSettlements(dataNodeSourceId, assetId, settlementLimit)

  const { columns: allColumns, rows: allRows } = useMemo(
    () => buildMatrix(settlements ?? []),
    [settlements],
  )

  const windowStart = useMemo(
    () => Date.now() - windowHours * 60 * 60 * 1000,
    [windowHours],
  )
  const columns = useMemo(
    () =>
      allColumns.filter(c => new Date(c.batch.settledAt).getTime() >= windowStart),
    [allColumns, windowStart],
  )
  const colStartIdx = allColumns.length - columns.length
  const rows = useMemo(
    () =>
      allRows
        .map(r => ({ ...r, cells: r.cells.slice(colStartIdx) }))
        .filter(r => r.cells.some(c => c.side !== null)),
    [allRows, colStartIdx],
  )

  // Per-settlement chart data: price at the moment of each settlement.
  const seriesValues = useMemo<(number | null)[]>(() => {
    return columns.map(c =>
      nearestValue(points, new Date(c.batch.settledAt).getTime()),
    )
  }, [columns, points])

  // Pick a baseline index — leftmost *visible* column when in settlement mode,
  // first valid value when in time mode (whole window).
  const baseIdx = useMemo(() => {
    if (chartMode === 'time') {
      return seriesValues.findIndex(v => v != null) >= 0
        ? seriesValues.findIndex(v => v != null)
        : 0
    }
    // settlement: find first valid value at or after leftIdx
    for (let i = leftIdx; i < seriesValues.length; i++) {
      if (seriesValues[i] != null) return i
    }
    const fallback = seriesValues.findIndex(v => v != null)
    return fallback >= 0 ? fallback : 0
  }, [seriesValues, leftIdx, chartMode])

  const baseAsset = seriesValues[baseIdx]

  // Asset rebased to 1.0 at baseIdx.
  const assetRatios = useMemo<(number | null)[]>(() => {
    if (baseAsset == null || baseAsset === 0) return seriesValues.map(() => null)
    return seriesValues.map(v => (v == null ? null : v / baseAsset))
  }, [seriesValues, baseAsset])

  // The widest threshold in the visible window — used only to decide whether
  // the band would crush the price line if we expanded Y to fit it.
  const maxBatchRatio = useMemo(() => {
    let m = 0
    for (const c of columns) {
      const bps = c.batch.thresholdBps
      if (bps > 0) m = Math.max(m, bps / 10000)
    }
    if (thresholdRatio != null) m = Math.max(m, thresholdRatio)
    return m
  }, [columns, thresholdRatio])

  // Y bounds follow the *price* range, with a minimum width so the line
  // isn't a flat hair. We don't let the threshold pull the axis — when the
  // band is wider than the data window, ticks clip to the edge with arrows.
  const yMin = useMemo(() => {
    const all: number[] = []
    for (const r of assetRatios) if (r != null) all.push(r)
    if (all.length === 0 && points.length > 0) {
      const v0 = points[0].value
      if (v0 !== 0) for (const p of points) all.push(p.value / v0)
    }
    const dataMin = all.length === 0 ? 0.99 : Math.min(...all, 1.0)
    const span = (all.length === 0 ? 0.02 : Math.max(...all, 1.0) - dataMin)
    const padded = dataMin - Math.max(0.005, span * 0.15)
    if (maxBatchRatio <= 0) return padded
    return Math.min(padded, 1.0 - Math.min(maxBatchRatio, span * 1.5))
  }, [assetRatios, points, maxBatchRatio])
  const yMax = useMemo(() => {
    const all: number[] = []
    for (const r of assetRatios) if (r != null) all.push(r)
    if (all.length === 0 && points.length > 0) {
      const v0 = points[0].value
      if (v0 !== 0) for (const p of points) all.push(p.value / v0)
    }
    const dataMax = all.length === 0 ? 1.01 : Math.max(...all, 1.0)
    const span = (all.length === 0 ? 0.02 : dataMax - Math.min(...all, 1.0))
    const padded = dataMax + Math.max(0.005, span * 0.15)
    if (maxBatchRatio <= 0) return padded
    return Math.max(padded, 1.0 + Math.min(maxBatchRatio, span * 1.5))
  }, [assetRatios, points, maxBatchRatio])
  const ySpan = Math.max(1e-12, yMax - yMin)

  const lineColor = useMemo(() => {
    const first = seriesValues.find(v => v != null)
    const last = [...seriesValues].reverse().find(v => v != null)
    if (first == null || last == null) return '#94a3b8'
    return last >= first ? '#16a34a' : '#dc2626'
  }, [seriesValues])

  const changePct = useMemo(() => {
    const first = seriesValues.find(v => v != null)
    const last = [...seriesValues].reverse().find(v => v != null)
    if (first == null || last == null || first === 0) return null
    return ((last - first) / first) * 100
  }, [seriesValues])

  const hasMatrix = rows.length > 0
  const colCount = columns.length

  // Did the band routinely outscale the move? Resolver calibration is
  // suspect when the threshold dwarfs what the price actually does each
  // batch — almost every outcome will be Flat.
  const bandTooWide = useMemo(() => {
    let moves = 0
    let bands = 0
    let counted = 0
    for (const c of columns) {
      const move = Math.abs(c.batch.pctChangeBps)
      const band = c.batch.thresholdBps
      if (band > 0 && move >= 0) {
        moves += move
        bands += band
        counted += 1
      }
    }
    if (counted < 4) return false
    const avgMove = moves / counted
    const avgBand = bands / counted
    // band 5× the typical move and over 100 bps absolute → likely a
    // calibration ceiling, not a fair line.
    return avgBand > 100 && avgBand > avgMove * 5
  }, [columns])

  // Chart inner width — scrolls with the matrix.
  const innerWidth = useMemo(() => {
    const fromCells = colCount * (CELL_W + COL_GAP) + X_PADDING * 2
    return Math.max(720, fromCells)
  }, [colCount])

  // Pixel x for column index i (center of cell).
  const xForIdx = (i: number) => X_PADDING + i * (CELL_W + COL_GAP) + CELL_W / 2

  // Pixel y for a ratio (1.0 = neutral baseline).
  const yForRatio = (r: number) => {
    const padTop = 16
    const padBot = 16
    const usable = CHART_HEIGHT - padTop - padBot
    return padTop + (1 - (r - yMin) / ySpan) * usable
  }

  // Asset price line (rebased to 1.0).
  const assetPath = useMemo(() => {
    const segs: string[] = []
    let started = false
    assetRatios.forEach((r, i) => {
      if (r == null) {
        started = false
        return
      }
      const x = xForIdx(i)
      const y = yForRatio(r)
      segs.push(`${started ? 'L' : 'M'} ${x.toFixed(1)} ${y.toFixed(1)}`)
      started = true
    })
    return segs.join(' ')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [assetRatios, yMin, yMax, ySpan, colCount])


  // Time-linear fallback when there are no settlements yet.
  const fallbackPath = useMemo(() => {
    if (points.length < 2 || colCount > 0) return ''
    const v0 = points[0].value
    if (v0 === 0) return ''
    const tMin = points[0].ts
    const tMax = points[points.length - 1].ts
    const tSpan = Math.max(1, tMax - tMin)
    const segs: string[] = []
    points.forEach((p, i) => {
      const x = X_PADDING + ((p.ts - tMin) / tSpan) * (innerWidth - X_PADDING * 2)
      const y = yForRatio(p.value / v0)
      segs.push(`${i === 0 ? 'M' : 'L'} ${x.toFixed(1)} ${y.toFixed(1)}`)
    })
    return segs.join(' ')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [points, innerWidth, yMin, yMax, ySpan, colCount])

  // Pixel y for the 1.0 baseline — rendered as a faint dashed line.
  const baselineY = isFinite(yMin) && isFinite(yMax) ? yForRatio(1.0) : null

  // Scroll to the right edge on first load — most recent activity in view.
  useEffect(() => {
    if (scrollRef.current && colCount > 0) {
      scrollRef.current.scrollLeft = scrollRef.current.scrollWidth
    }
  }, [colCount, windowHours, chartMode])

  // Track leftmost visible column for dynamic rebase. RAF-throttled.
  useEffect(() => {
    if (chartMode !== 'settlement') {
      setLeftIdx(0)
      return
    }
    const el = scrollRef.current
    if (!el) return
    let raf = 0
    const compute = () => {
      raf = 0
      const sl = el.scrollLeft
      const idx = Math.max(
        0,
        Math.min(
          colCount - 1,
          Math.floor((sl - X_PADDING + CELL_W / 2) / (CELL_W + COL_GAP)),
        ),
      )
      setLeftIdx(idx)
    }
    const onScroll = () => {
      if (raf) return
      raf = requestAnimationFrame(compute)
    }
    el.addEventListener('scroll', onScroll, { passive: true })
    // Compute once after settle
    requestAnimationFrame(compute)
    return () => {
      el.removeEventListener('scroll', onScroll)
      if (raf) cancelAnimationFrame(raf)
    }
  }, [colCount, chartMode])

  const firstValue = seriesValues.find(v => v != null) ?? points[0]?.value
  const lastValue =
    [...seriesValues].reverse().find(v => v != null) ??
    points[points.length - 1]?.value

  const HEADER_NODE = (
    <Header
      isPrice={isPrice}
      valueUnit={valueUnit}
      firstValue={firstValue}
      lastValue={lastValue}
      changePct={changePct}
      windowHours={windowHours}
      onWindowChange={setWindowHours}
      chartMode={chartMode}
      onChartModeChange={setChartMode}
      showLegend={hasMatrix && chartMode === 'settlement'}
      thresholdLabel={thresholdLabel}
      isBinary={isBinary}
      bandTooWide={bandTooWide}
    />
  )

  if (loading && points.length === 0) {
    return (
      <section className={cardClass} style={cardStyle}>
        {HEADER_NODE}
        <div style={emptyState}>Loading…</div>
      </section>
    )
  }

  if (points.length < 2 && colCount === 0) {
    return (
      <section className={cardClass} style={cardStyle}>
        {HEADER_NODE}
        <div style={emptyState}>Not enough history yet.</div>
      </section>
    )
  }

  if (chartMode === 'time') {
    return (
      <section className={cardClass} style={cardStyle}>
        {HEADER_NODE}
        <div
          style={{
            display: 'flex',
            alignItems: 'stretch',
            borderTop: '1px solid var(--apple-line)',
          }}
        >
          <div
            style={{
              flexShrink: 0,
              width: LEFT_RAIL,
              background: 'var(--apple-panel)',
              borderRight: '1px solid var(--apple-line)',
              position: 'relative',
            }}
          >
            <div style={{ height: CHART_HEIGHT, position: 'relative' }}>
              <YAxisTicks yMin={yMin} yMax={yMax} />
            </div>
          </div>
          <div style={{ flex: 1 }}>
            <TimeChart
              points={points}
              baseAsset={baseAsset}
              yMin={yMin}
              yMax={yMax}
              ySpan={ySpan}
              lineColor={lineColor}
            />
          </div>
        </div>
      </section>
    )
  }

  return (
    <section className={cardClass} style={cardStyle}>
      {HEADER_NODE}

      <div
        style={{
          display: 'flex',
          alignItems: 'stretch',
          borderTop: '1px solid var(--apple-line)',
        }}
      >
        {/* Left rail — Y-axis labels + vault names. Sticky via flex layout. */}
        <div
          style={{
            flexShrink: 0,
            width: LEFT_RAIL,
            background: 'var(--apple-panel)',
            borderRight: '1px solid var(--apple-line)',
            position: 'relative',
          }}
        >
          {/* Y-axis on the chart half */}
          <div style={{ height: CHART_HEIGHT, position: 'relative' }}>
            <YAxisTicks yMin={yMin} yMax={yMax} />
          </div>
          {/* Header row */}
          <div
            style={{
              height: HEADER_H,
              borderTop: '1px solid var(--apple-line)',
              borderBottom: '1px solid var(--apple-line)',
            }}
          />
          {/* Vault rows */}
          {rows.map(r => (
            <div
              key={r.player}
              title={r.player}
              style={{
                height: ROW_H,
                display: 'flex',
                alignItems: 'center',
                padding: '0 14px',
                gap: 8,
                fontSize: 12,
                color: 'var(--apple-text)',
                borderBottom: '1px solid rgba(0,0,0,0.04)',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
              }}
            >
              <span
                style={{
                  flexShrink: 0,
                  width: 6,
                  height: 6,
                  borderRadius: 999,
                  background: r.color || 'var(--apple-text-tertiary)',
                }}
              />
              <span
                style={{
                  flex: 1,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  fontFamily: r.isFund ? undefined : 'var(--apple-font-mono, monospace)',
                  fontSize: r.isFund ? 12 : 11,
                }}
              >
                {r.label}
              </span>
              <span
                style={{
                  flexShrink: 0,
                  fontSize: 9,
                  fontWeight: 600,
                  letterSpacing: 'var(--apple-track-loose)',
                  textTransform: 'uppercase',
                  padding: '1px 5px',
                  borderRadius: 3,
                  background: r.isFund ? 'rgba(52,199,89,0.12)' : 'rgba(0,0,0,0.05)',
                  color: r.isFund ? 'rgb(52,199,89)' : 'var(--apple-text-tertiary)',
                }}
              >
                {r.isFund ? 'FUND' : 'BOT'}
              </span>
            </div>
          ))}
          {!hasMatrix && (
            <div
              style={{
                padding: '14px',
                fontSize: 12,
                color: 'var(--apple-text-tertiary)',
                lineHeight: 1.4,
              }}
            >
              {settlementsLoading
                ? 'Loading participants…'
                : settlementsFailed
                ? 'Participant history unavailable. The settlement index is catching up.'
                : (settlements?.length ?? 0) === 0
                ? 'Awaiting first settlement. Joins land before the matrix does.'
                : 'No participants in this window.'}
            </div>
          )}
        </div>

        {/* Right scroll surface — chart (top) + odds row + cells, all in lockstep. */}
        <div
          ref={scrollRef}
          style={{ flex: 1, overflowX: 'auto', overflowY: 'hidden' }}
        >
          <div style={{ width: innerWidth, position: 'relative' }}>
            {/* Chart */}
            <svg
              width={innerWidth}
              height={CHART_HEIGHT}
              style={{ display: 'block' }}
            >
              {/* Faint vertical guides at each settlement */}
              {columns.map((c, i) => {
                const x = xForIdx(i)
                const guideColor =
                  c.batch.outcome === 'Up'
                    ? 'rgba(52,199,89,0.10)'
                    : c.batch.outcome === 'Down'
                    ? 'rgba(255,59,48,0.10)'
                    : 'rgba(148,163,184,0.10)'
                return (
                  <line
                    key={`g-${c.batch.batchId}`}
                    x1={x}
                    x2={x}
                    y1={12}
                    y2={CHART_HEIGHT - 12}
                    stroke={guideColor}
                    strokeWidth={CELL_W}
                  />
                )
              })}
              {/* Per-batch threshold ticks. Each batch carries its own band
                  in the settlement payload — we draw both sides of the band
                  as short ticks centered on the column. When the band would
                  fall outside the chart range, the tick clamps to the edge
                  and gets an arrow marker so the off-scale fact is visible. */}
              {columns.map((c, i) => {
                const bps = c.batch.thresholdBps
                if (!bps || bps <= 0) return null
                const ratio = bps / 10000
                const x = xForIdx(i)
                const padTop = 12
                const padBot = CHART_HEIGHT - 12
                const rawYUp = yForRatio(1 + ratio)
                const rawYDn = yForRatio(1 - ratio)
                const clampedYUp = Math.max(padTop, rawYUp)
                const clampedYDn = Math.min(padBot, rawYDn)
                const upOff = rawYUp < padTop
                const dnOff = rawYDn > padBot
                return (
                  <g key={`tk-${c.batch.batchId}`}>
                    <line
                      x1={x - CELL_W / 2}
                      x2={x + CELL_W / 2}
                      y1={clampedYUp}
                      y2={clampedYUp}
                      stroke="rgb(52,199,89)"
                      strokeOpacity={upOff ? 0.55 : 0.85}
                      strokeWidth={upOff ? 1 : 1.25}
                      strokeDasharray={upOff ? '2 2' : undefined}
                    />
                    <line
                      x1={x - CELL_W / 2}
                      x2={x + CELL_W / 2}
                      y1={clampedYDn}
                      y2={clampedYDn}
                      stroke="rgb(255,59,48)"
                      strokeOpacity={dnOff ? 0.55 : 0.85}
                      strokeWidth={dnOff ? 1 : 1.25}
                      strokeDasharray={dnOff ? '2 2' : undefined}
                    />
                  </g>
                )
              })}
              {/* Baseline at ratio = 1.0 */}
              {baselineY != null ? (
                <line
                  x1={0}
                  x2={innerWidth}
                  y1={baselineY}
                  y2={baselineY}
                  stroke="rgba(0,0,0,0.08)"
                  strokeDasharray="3 3"
                />
              ) : null}
              {/* Asset price line (rebased) */}
              {assetPath ? (
                <path d={assetPath} stroke={lineColor} strokeWidth={1.5} fill="none" />
              ) : null}
              {fallbackPath ? (
                <path
                  d={fallbackPath}
                  stroke={lineColor}
                  strokeWidth={1.5}
                  fill="none"
                />
              ) : null}
              {/* Settlement dots */}
              {assetRatios.map((r, i) => {
                if (r == null) return null
                const c = columns[i]
                const v = seriesValues[i]
                const dotColor =
                  c.batch.outcome === 'Up'
                    ? '#16a34a'
                    : c.batch.outcome === 'Down'
                    ? '#dc2626'
                    : '#94a3b8'
                const bandLabel =
                  c.batch.thresholdBps > 0
                    ? `band ±${formatRulePct(c.batch.thresholdBps)}`
                    : 'any move wins'
                const moveLabel = `${
                  c.batch.pctChangeBps >= 0 ? '+' : ''
                }${(c.batch.pctChangeBps / 100).toFixed(2)}%`
                return (
                  <circle
                    key={`dot-${c.batch.batchId}`}
                    cx={xForIdx(i)}
                    cy={yForRatio(r)}
                    r={2.5}
                    fill={dotColor}
                  >
                    <title>
                      {`${formatTime(new Date(c.batch.settledAt).getTime())} · ${
                        isPrice ? '$' : ''
                      }${formatValue(v ?? 0, isPrice)}${
                        !isPrice && valueUnit ? ` ${valueUnit}` : ''
                      } · moved ${moveLabel} · ${bandLabel} → ${c.batch.outcome}`}
                    </title>
                  </circle>
                )
              })}
            </svg>

            {/* Odds row — winner multiplier under each chart point. */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: `repeat(${Math.max(1, colCount)}, ${CELL_W}px)`,
                columnGap: COL_GAP,
                padding: `0 ${X_PADDING}px`,
                borderTop: '1px solid var(--apple-line)',
                borderBottom: '1px solid var(--apple-line)',
                height: HEADER_H,
              }}
            >
              {columns.map((c, i) => {
                const color =
                  c.winSide === 'Up'
                    ? 'rgb(52,199,89)'
                    : c.winSide === 'Down'
                    ? 'rgb(255,59,48)'
                    : 'var(--apple-text-tertiary)'
                return (
                  <div
                    key={`o-${i}`}
                    title={`${formatTime(new Date(c.batch.settledAt).getTime())}${
                      c.mult != null ? ` · winner pays ${c.mult.toFixed(2)}x` : ''
                    }`}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      height: HEADER_H,
                      fontSize: 10,
                      fontWeight: 600,
                      color,
                      fontVariantNumeric: 'tabular-nums',
                    }}
                  >
                    {c.mult != null ? `${c.mult.toFixed(2)}×` : '—'}
                  </div>
                )
              })}
            </div>

            {/* Body cells — same grid template as the odds row. */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: `repeat(${Math.max(1, colCount)}, ${CELL_W}px)`,
                columnGap: COL_GAP,
                padding: `0 ${X_PADDING}px`,
              }}
            >
              {rows.flatMap(r =>
                r.cells.map((cell, colIdx) => (
                  <div
                    key={`${r.player}-${colIdx}`}
                    style={{
                      height: ROW_H,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      borderBottom: '1px solid rgba(0,0,0,0.04)',
                    }}
                  >
                    <CellGlyph side={cell.side} won={cell.won} />
                  </div>
                )),
              )}
            </div>
          </div>
        </div>
      </div>

    </section>
  )
}

function TimeChart({
  points,
  baseAsset,
  yMin,
  yMax,
  ySpan,
  lineColor,
}: {
  points: PricePoint[]
  baseAsset: number | null | undefined
  yMin: number
  yMax: number
  ySpan: number
  lineColor: string
}) {
  // Use a viewBox so the SVG stretches to container width.
  const W = 1000
  const H = CHART_HEIGHT
  const padX = 20
  const padTop = 16
  const padBot = 16
  const usable = H - padTop - padBot

  if (points.length < 2) {
    return (
      <div
        style={{
          height: H,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'var(--apple-text-tertiary)',
          fontSize: 13,
        }}
      >
        Not enough history yet.
      </div>
    )
  }

  const tMin = points[0].ts
  const tMax = points[points.length - 1].ts
  const tSpan = Math.max(1, tMax - tMin)
  const xForTime = (t: number) =>
    padX + ((t - tMin) / tSpan) * (W - padX * 2)
  const yForRatio = (r: number) =>
    padTop + (1 - (r - yMin) / ySpan) * usable

  const v0 = baseAsset != null && baseAsset !== 0 ? baseAsset : points[0].value

  const assetPath = points
    .map((p, i) => {
      const r = p.value / v0
      return `${i === 0 ? 'M' : 'L'} ${xForTime(p.ts).toFixed(1)} ${yForRatio(r).toFixed(1)}`
    })
    .join(' ')

  const baselineY = yForRatio(1.0)

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      preserveAspectRatio="none"
      width="100%"
      height={H}
      style={{ display: 'block' }}
    >
      {isFinite(baselineY) ? (
        <line
          x1={0}
          x2={W}
          y1={baselineY}
          y2={baselineY}
          stroke="rgba(0,0,0,0.08)"
          strokeDasharray="3 3"
          vectorEffect="non-scaling-stroke"
        />
      ) : null}
      <path d={assetPath} stroke={lineColor} strokeWidth={1.5} fill="none" vectorEffect="non-scaling-stroke" />
    </svg>
  )
}

function YAxisTicks({
  yMin,
  yMax,
}: {
  yMin: number
  yMax: number
}) {
  if (!isFinite(yMin) || !isFinite(yMax) || yMax === yMin) return null
  const ticks = 4
  const out: { v: number; pct: number }[] = []
  for (let i = 0; i <= ticks; i++) {
    const v = yMin + ((yMax - yMin) * i) / ticks
    out.push({ v, pct: (1 - i / ticks) * 100 })
  }
  return (
    <div style={{ position: 'absolute', inset: 0 }}>
      {out.map((t, i) => {
        const deltaPct = (t.v - 1) * 100
        const isBaseline = Math.abs(t.v - 1) < 1e-9
        return (
          <div
            key={i}
            style={{
              position: 'absolute',
              top: `${t.pct}%`,
              right: 12,
              transform: 'translateY(-50%)',
              fontSize: 10,
              color: isBaseline
                ? 'var(--apple-text)'
                : 'var(--apple-text-tertiary)',
              fontVariantNumeric: 'tabular-nums',
              fontWeight: isBaseline ? 600 : 400,
            }}
          >
            {deltaPct >= 0 ? '+' : ''}
            {deltaPct.toFixed(2)}%
          </div>
        )
      })}
    </div>
  )
}

const cardClass = 'border overflow-hidden'
const cardStyle: React.CSSProperties = {
  background: 'var(--apple-panel)',
  borderColor: 'var(--apple-line)',
  borderRadius: 'var(--apple-r-card)',
}

const emptyState: React.CSSProperties = {
  height: 160,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  color: 'var(--apple-text-tertiary)',
  fontSize: 13,
  borderTop: '1px solid var(--apple-line)',
}

function ModeToggle({
  value,
  onChange,
}: {
  value: ChartMode
  onChange: (m: ChartMode) => void
}) {
  const options: { mode: ChartMode; label: string }[] = [
    { mode: 'settlement', label: 'Settlements' },
    { mode: 'time', label: 'Time' },
  ]
  return (
    <div
      role="tablist"
      style={{
        display: 'inline-flex',
        background: 'rgba(0,0,0,0.04)',
        borderRadius: 999,
        padding: 2,
      }}
    >
      {options.map(opt => {
        const active = opt.mode === value
        return (
          <button
            key={opt.mode}
            role="tab"
            aria-selected={active}
            onClick={() => onChange(opt.mode)}
            style={{
              padding: '4px 10px',
              border: 'none',
              borderRadius: 999,
              fontSize: 11,
              fontWeight: 600,
              cursor: 'pointer',
              background: active ? 'var(--apple-panel)' : 'transparent',
              color: active ? 'var(--apple-text)' : 'var(--apple-text-tertiary)',
              boxShadow: active ? '0 1px 2px rgba(0,0,0,0.06)' : 'none',
              transition: 'background 120ms ease, color 120ms ease',
            }}
          >
            {opt.label}
          </button>
        )
      })}
    </div>
  )
}

function WindowToggle({
  value,
  onChange,
}: {
  value: WindowHours
  onChange: (h: WindowHours) => void
}) {
  return (
    <div
      role="tablist"
      style={{
        display: 'inline-flex',
        background: 'rgba(0,0,0,0.04)',
        borderRadius: 999,
        padding: 2,
      }}
    >
      {WINDOW_OPTIONS.map(opt => {
        const active = opt.hours === value
        return (
          <button
            key={opt.hours}
            role="tab"
            aria-selected={active}
            onClick={() => onChange(opt.hours)}
            style={{
              padding: '4px 10px',
              border: 'none',
              borderRadius: 999,
              fontSize: 11,
              fontWeight: 600,
              cursor: 'pointer',
              fontVariantNumeric: 'tabular-nums',
              background: active ? 'var(--apple-panel)' : 'transparent',
              color: active ? 'var(--apple-text)' : 'var(--apple-text-tertiary)',
              boxShadow: active ? '0 1px 2px rgba(0,0,0,0.06)' : 'none',
              transition: 'background 120ms ease, color 120ms ease',
            }}
          >
            {opt.label}
          </button>
        )
      })}
    </div>
  )
}

function Header({
  isPrice,
  valueUnit,
  firstValue,
  lastValue,
  changePct,
  showLegend = false,
  windowHours,
  onWindowChange,
  chartMode,
  onChartModeChange,
  thresholdLabel,
  isBinary,
  bandTooWide,
}: {
  isPrice: boolean
  valueUnit: string
  firstValue?: number
  lastValue?: number
  changePct?: number | null
  showLegend?: boolean
  windowHours: WindowHours
  onWindowChange: (h: WindowHours) => void
  chartMode: ChartMode
  onChartModeChange: (m: ChartMode) => void
  thresholdLabel: string | null
  isBinary: boolean
  bandTooWide: boolean
}) {
  return (
    <header
      className="flex items-center justify-between px-5 sm:px-6 pt-5 pb-3"
      style={{ gap: 16, flexWrap: 'wrap' }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 16,
          flexWrap: 'wrap',
        }}
      >
        <h2
          style={{
            fontFamily: 'var(--apple-font-display)',
            fontSize: 17,
            fontWeight: 600,
            color: 'var(--apple-text)',
            margin: 0,
          }}
        >
          History
        </h2>
        <WindowToggle value={windowHours} onChange={onWindowChange} />
        <ModeToggle value={chartMode} onChange={onChartModeChange} />
        {firstValue !== undefined && lastValue !== undefined && (
          <span
            style={{
              fontSize: 12,
              color: 'var(--apple-text-tertiary)',
              fontFamily: 'var(--apple-font-mono, monospace)',
              fontVariantNumeric: 'tabular-nums',
            }}
          >
            {isPrice ? '$' : ''}
            {formatValue(firstValue, isPrice)} →{' '}
            {isPrice ? '$' : ''}
            {formatValue(lastValue, isPrice)}
            {!isPrice && valueUnit ? ` ${valueUnit}` : ''}
          </span>
        )}
        {changePct != null && (
          <span
            style={{
              fontSize: 12,
              fontWeight: 700,
              color: changePct >= 0 ? 'rgb(52,199,89)' : 'rgb(255,59,48)',
              fontVariantNumeric: 'tabular-nums',
            }}
          >
            {changePct >= 0 ? '+' : ''}
            {changePct.toFixed(2)}%
          </span>
        )}
      </div>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 14,
          fontSize: 11,
          color: 'var(--apple-text-secondary)',
          letterSpacing: 'var(--apple-track-loose)',
          textTransform: 'uppercase',
          fontVariantNumeric: 'tabular-nums',
        }}
      >
        <LegendDot color="rgb(52,199,89)" label="price" />
        {thresholdLabel && !isBinary ? (
          <span style={{ textTransform: 'none', letterSpacing: 0, color: 'var(--apple-text)' }}>
            <span style={{ color: 'rgb(52,199,89)', fontWeight: 600 }}>━</span>
            <span style={{ color: 'rgb(255,59,48)', fontWeight: 600 }}>━</span>{' '}
            per-batch band
            <span style={{ margin: '0 6px', color: 'var(--apple-text-tertiary)' }}>·</span>
            <span style={{ color: 'var(--apple-text-secondary)' }}>now ±{thresholdLabel}</span>
          </span>
        ) : null}
        {bandTooWide ? (
          <span
            style={{
              textTransform: 'none',
              letterSpacing: 0,
              padding: '2px 8px',
              borderRadius: 'var(--apple-r-sm)',
              background: 'rgba(255,149,0,0.10)',
              color: 'rgb(180,98,4)',
              border: '1px solid rgba(255,149,0,0.30)',
              fontWeight: 500,
            }}
          >
            Band wider than the actual move — most batches settle Flat.
          </span>
        ) : null}
        {showLegend ? (
          <span style={{ color: 'var(--apple-text-secondary)' }}>
            faded = lost · winner pays
          </span>
        ) : null}
      </div>
    </header>
  )
}

function LegendDot({ color, label }: { color: string; label: string }) {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
      <span
        style={{
          width: 8,
          height: 2,
          background: color,
          display: 'inline-block',
        }}
      />
      <span>{label}</span>
    </span>
  )
}
