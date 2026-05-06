'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import {
  Line,
  LineChart,
  ReferenceLine,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { useAssetSettlements, type AssetSettlement } from '@/hooks/vision/useAssetSettlements'
import fundData from '@/data/fund-branding.json'

interface Props {
  sourceId: string
  dataNodeSourceId: string
  assetId: string
  isPrice: boolean
  valueUnit: string
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

const OUTCOME_COLOR = {
  Up: '#16a34a',
  Down: '#dc2626',
  Flat: '#94a3b8',
  Cancelled: '#94a3b8',
  AllSameSide: '#f59e0b',
  AllLosers: '#f59e0b',
} as const

const CHART_HEIGHT = 320
const CELL_W = 28
const COL_GAP = 2
const ROW_H = 26
const LEFT_RAIL = 168
const TOP_N = 12

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

function computeOdds(s: AssetSettlement): { upPct: number | null; downPct: number | null } {
  let up = 0
  let down = 0
  try {
    up = Number(BigInt(s.upStake))
    down = Number(BigInt(s.downStake))
  } catch {
    return { upPct: null, downPct: null }
  }
  const total = up + down
  if (!total) return { upPct: null, downPct: null }
  return { upPct: (up / total) * 100, downPct: (down / total) * 100 }
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
  upPct: number | null
  downPct: number | null
}

function buildMatrix(settlements: AssetSettlement[]): {
  columns: BatchCol[]
  rows: Row[]
} {
  const ordered = [...settlements].sort(
    (a, b) => new Date(a.settledAt).getTime() - new Date(b.settledAt).getTime(),
  )
  const columns: BatchCol[] = ordered.map(b => ({ batch: b, ...computeOdds(b) }))
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
  // Funds first; then by participation; then alphabetical.
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
    return (
      <span style={{ color: 'var(--apple-text-tertiary)', opacity: 0.4 }}>·</span>
    )
  }
  const color = won ? 'rgb(52,199,89)' : 'rgb(255,59,48)'
  return (
    <span
      style={{
        color,
        fontSize: 12,
        opacity: won ? 1 : 0.55,
        lineHeight: 1,
      }}
    >
      {side === 'Up' ? '▲' : '▼'}
    </span>
  )
}

export function AssetActivityCard({
  sourceId: _sourceId,
  dataNodeSourceId,
  assetId,
  isPrice,
  valueUnit,
}: Props) {
  const [points, setPoints] = useState<PricePoint[]>([])
  const [loading, setLoading] = useState(true)
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    const now = Date.now()
    const from = new Date(now - 7 * 24 * 60 * 60 * 1000).toISOString()
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
  }, [dataNodeSourceId, assetId])

  const { data: settlements } = useAssetSettlements(dataNodeSourceId, assetId, 60)

  const { columns, rows } = useMemo(
    () => buildMatrix(settlements ?? []),
    [settlements],
  )

  // Scroll to far right on first load — most recent activity is what matters.
  useEffect(() => {
    if (scrollRef.current && columns.length > 0) {
      scrollRef.current.scrollLeft = scrollRef.current.scrollWidth
    }
  }, [columns.length])

  // Downsample chart points for perf (cap ~600).
  const displayPoints = useMemo(() => {
    if (points.length <= 600) return points
    const stride = Math.ceil(points.length / 600)
    return points.filter((_, i) => i % stride === 0 || i === points.length - 1)
  }, [points])

  const lineColor = useMemo(() => {
    if (displayPoints.length < 2) return '#94a3b8'
    return displayPoints[displayPoints.length - 1].value >= displayPoints[0].value
      ? '#16a34a'
      : '#dc2626'
  }, [displayPoints])

  const changePct = useMemo(() => {
    if (displayPoints.length < 2) return null
    const f = displayPoints[0].value
    const l = displayPoints[displayPoints.length - 1].value
    if (f === 0) return null
    return ((l - f) / f) * 100
  }, [displayPoints])

  const tDomain = useMemo<[number, number]>(() => {
    if (displayPoints.length === 0) {
      const now = Date.now()
      return [now - 7 * 24 * 60 * 60 * 1000, now]
    }
    return [
      displayPoints[0].ts,
      displayPoints[displayPoints.length - 1].ts,
    ]
  }, [displayPoints])

  // Inner pixel width — wide enough that one cell per settled batch fits.
  const innerWidth = useMemo(() => {
    const fromCells = columns.length * (CELL_W + COL_GAP) + 32
    return Math.max(720, fromCells)
  }, [columns.length])

  if (loading && displayPoints.length === 0) {
    return (
      <section className={cardClass} style={cardStyle}>
        <Header isPrice={isPrice} valueUnit={valueUnit} />
        <div
          style={{
            height: CHART_HEIGHT,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'var(--apple-text-tertiary)',
            fontSize: 13,
          }}
        >
          Loading…
        </div>
      </section>
    )
  }

  if (displayPoints.length < 2) {
    return (
      <section className={cardClass} style={cardStyle}>
        <Header isPrice={isPrice} valueUnit={valueUnit} />
        <div
          style={{
            height: 120,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'var(--apple-text-tertiary)',
            fontSize: 13,
          }}
        >
          Not enough history yet.
        </div>
      </section>
    )
  }

  return (
    <section className={cardClass} style={cardStyle}>
      <Header
        isPrice={isPrice}
        valueUnit={valueUnit}
        firstValue={displayPoints[0].value}
        lastValue={displayPoints[displayPoints.length - 1].value}
        changePct={changePct}
      />

      <div
        style={{
          display: 'flex',
          alignItems: 'stretch',
          borderTop: '1px solid var(--apple-line)',
        }}
      >
        {/* Left rail — vault labels stay still while right side scrolls. */}
        <div
          style={{
            flexShrink: 0,
            width: LEFT_RAIL,
            background: 'var(--apple-panel)',
            borderRight: '1px solid var(--apple-line)',
          }}
        >
          {/* Spacer matches chart height */}
          <div style={{ height: CHART_HEIGHT }} />
          {/* Header strip in matrix */}
          <div
            style={{
              height: 38,
              display: 'flex',
              alignItems: 'center',
              padding: '0 14px',
              fontSize: 10,
              fontWeight: 600,
              color: 'var(--apple-text-tertiary)',
              letterSpacing: 'var(--apple-track-loose)',
              textTransform: 'uppercase',
              borderBottom: '1px solid var(--apple-line)',
            }}
          >
            Participant
          </div>
          {rows.map(r => (
            <div
              key={r.player}
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
                textOverflow: 'ellipsis',
              }}
              title={r.player}
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
          {rows.length === 0 && (
            <div
              style={{
                height: ROW_H * 3,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 12,
                color: 'var(--apple-text-tertiary)',
                padding: '0 14px',
                textAlign: 'center',
              }}
            >
              No bets yet.
            </div>
          )}
        </div>

        {/* Right scroll surface — chart on top, matrix grid below. Same scroll. */}
        <div ref={scrollRef} style={{ flex: 1, overflowX: 'auto', overflowY: 'hidden' }}>
          <div style={{ width: innerWidth, position: 'relative' }}>
            {/* Chart */}
            <div style={{ height: CHART_HEIGHT, padding: '12px 8px 0' }}>
              <LineChart
                width={innerWidth - 16}
                height={CHART_HEIGHT - 12}
                data={displayPoints}
                margin={{ top: 8, right: 16, left: 8, bottom: 8 }}
              >
                <XAxis
                  type="number"
                  dataKey="ts"
                  domain={tDomain}
                  scale="time"
                  tick={{ fontSize: 10, fill: 'var(--apple-text-tertiary)' }}
                  axisLine={{ stroke: 'rgba(0,0,0,0.08)' }}
                  tickLine={false}
                  tickFormatter={(v: number) =>
                    new Date(v).toLocaleDateString(undefined, {
                      month: 'short',
                      day: 'numeric',
                    })
                  }
                  minTickGap={60}
                />
                <YAxis
                  domain={['auto', 'auto']}
                  tick={{ fontSize: 10, fill: 'var(--apple-text-tertiary)' }}
                  axisLine={false}
                  tickLine={false}
                  width={48}
                  tickFormatter={(v: number) => formatValue(v, isPrice)}
                />
                <Tooltip
                  contentStyle={{
                    background: '#18181b',
                    border: 'none',
                    borderRadius: 4,
                    fontSize: 11,
                    color: '#fff',
                    padding: '6px 10px',
                  }}
                  labelFormatter={(v: number) => formatTime(v)}
                  formatter={(v: number) => [
                    `${isPrice ? '$' : ''}${formatValue(v, isPrice)}${
                      !isPrice && valueUnit ? ` ${valueUnit}` : ''
                    }`,
                    'Value',
                  ]}
                />
                <Line
                  type="monotone"
                  dataKey="value"
                  stroke={lineColor}
                  strokeWidth={1.5}
                  dot={false}
                  isAnimationActive={false}
                />
                {columns.map(c => {
                  const ts = new Date(c.batch.settledAt).getTime()
                  if (ts < tDomain[0] || ts > tDomain[1]) return null
                  return (
                    <ReferenceLine
                      key={`mk-${c.batch.batchId}`}
                      x={ts}
                      stroke={
                        OUTCOME_COLOR[c.batch.outcome as keyof typeof OUTCOME_COLOR] ||
                        '#94a3b8'
                      }
                      strokeWidth={1}
                      strokeDasharray="2 3"
                      ifOverflow="hidden"
                    />
                  )
                })}
              </LineChart>
            </div>

            {/* Matrix grid */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: `repeat(${Math.max(1, columns.length)}, ${CELL_W}px)`,
                columnGap: COL_GAP,
                padding: '0 16px',
              }}
            >
              {/* Column headers */}
              {columns.map(c => {
                const headColor =
                  c.batch.outcome === 'Up'
                    ? 'rgb(52,199,89)'
                    : c.batch.outcome === 'Down'
                    ? 'rgb(255,59,48)'
                    : 'var(--apple-text-tertiary)'
                return (
                  <div
                    key={`h-${c.batch.batchId}`}
                    title={`${formatTime(new Date(c.batch.settledAt).getTime())}${
                      c.upPct !== null && c.downPct !== null
                        ? ` · ↑${c.upPct.toFixed(0)}% / ↓${c.downPct.toFixed(0)}%`
                        : ''
                    }`}
                    style={{
                      height: 38,
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      justifyContent: 'center',
                      borderBottom: '1px solid var(--apple-line)',
                      lineHeight: 1.1,
                    }}
                  >
                    <span style={{ fontSize: 9, fontWeight: 600, color: headColor }}>
                      #{c.batch.batchId}
                    </span>
                    {c.upPct !== null && c.downPct !== null ? (
                      <span
                        style={{
                          marginTop: 2,
                          fontSize: 8,
                          color: 'var(--apple-text-tertiary)',
                          fontVariantNumeric: 'tabular-nums',
                        }}
                      >
                        {c.upPct.toFixed(0)}/{c.downPct.toFixed(0)}
                      </span>
                    ) : null}
                  </div>
                )
              })}

              {/* Body cells, row-major */}
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

const cardClass = 'border overflow-hidden'
const cardStyle: React.CSSProperties = {
  background: 'var(--apple-panel)',
  borderColor: 'var(--apple-line)',
  borderRadius: 'var(--apple-r-card)',
}

function Header({
  isPrice,
  valueUnit,
  firstValue,
  lastValue,
  changePct,
}: {
  isPrice: boolean
  valueUnit: string
  firstValue?: number
  lastValue?: number
  changePct?: number | null
}) {
  return (
    <header
      className="flex items-baseline justify-between px-5 sm:px-6 pt-5 pb-3"
      style={{ gap: 16 }}
    >
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 16 }}>
        <h2
          style={{
            fontFamily: 'var(--apple-font-display)',
            fontSize: 17,
            fontWeight: 600,
            color: 'var(--apple-text)',
            margin: 0,
          }}
        >
          History · 7d
        </h2>
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
        {changePct !== null && changePct !== undefined && (
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
      <span
        style={{
          fontSize: 10,
          color: 'var(--apple-text-tertiary)',
          letterSpacing: 'var(--apple-track-loose)',
          textTransform: 'uppercase',
        }}
      >
        ▲ up · ▼ down · faded = lost · header = up%/down% pool odds
      </span>
    </header>
  )
}
