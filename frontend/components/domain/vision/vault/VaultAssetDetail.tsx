'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import {
  ResponsiveContainer,
  LineChart,
  Line,
  ScatterChart,
  Scatter,
  XAxis,
  YAxis,
  Tooltip,
  ComposedChart,
} from 'recharts'
import type { AssetAgg } from './VaultAssetRow'

interface PricePoint {
  fetchedAt: string
  value: number
}

interface FillEntry {
  orderId: number
  side: 'BUY' | 'SELL'
  amount: number
  fillPrice: number | null
  shares: number | null
  timestamp: string
}

interface FillsResponse {
  fills: FillEntry[]
  total: number
  page: number
  limit: number
}

interface Props {
  asset: AssetAgg
  vaultAddress: string
  sourceId: string
  onClose: () => void
}

function formatValue(v: number): string {
  if (v === 0) return '0'
  if (Math.abs(v) < 0.0001) return v.toExponential(2)
  if (Math.abs(v) < 1) return v.toFixed(6)
  if (Math.abs(v) >= 1_000_000) return `${(v / 1_000_000).toFixed(2)}M`
  if (Math.abs(v) >= 1_000) return `${(v / 1_000).toFixed(2)}K`
  return v.toFixed(4)
}

function formatUsd(v: number): string {
  if (v >= 1_000) return `$${(v / 1_000).toFixed(2)}K`
  return `$${v.toFixed(2)}`
}

function formatTs(iso: string): string {
  const d = new Date(iso)
  return d.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  })
}

// Scale fill dot size to fill size, clamped 4–20px radius
function dotRadius(amount: number, maxAmount: number): number {
  if (maxAmount === 0) return 6
  return Math.max(4, Math.min(20, (amount / maxAmount) * 20))
}

const CELL_STYLE: React.CSSProperties = {
  fontFamily: 'var(--apple-font-text,"SF Pro Text",Helvetica,Arial,sans-serif)',
  fontSize: 13,
  letterSpacing: 'var(--apple-track-tight,-0.022em)',
  padding: '10px 16px',
  borderBottom: '1px solid var(--apple-divider,#e8e8ed)',
  color: 'var(--apple-text,#1d1d1f)',
}

const HEADER_CELL_STYLE: React.CSSProperties = {
  ...CELL_STYLE,
  fontSize: 11,
  fontWeight: 600,
  color: 'var(--apple-text-secondary,#6e6e73)',
  textTransform: 'uppercase' as const,
  letterSpacing: '0.06em',
  background: 'var(--apple-surface,#f5f5f7)',
}

export function VaultAssetDetail({ asset, vaultAddress, sourceId, onClose }: Props) {
  const [prices, setPrices] = useState<PricePoint[]>([])
  const [fills, setFills] = useState<FillEntry[]>([])
  const [fillTotal, setFillTotal] = useState(0)
  const [fillPage, setFillPage] = useState(0)
  const [priceLoading, setPriceLoading] = useState(true)
  const [fillsLoading, setFillsLoading] = useState(true)
  const panelRef = useRef<HTMLDivElement>(null)

  // Load price history
  useEffect(() => {
    setPriceLoading(true)
    const now = new Date()
    const from = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
    fetch(
      `/api/market/history?source=${encodeURIComponent(sourceId)}&asset=${encodeURIComponent(asset.assetId)}&from=${from.toISOString()}&to=${now.toISOString()}`,
      { signal: AbortSignal.timeout(15_000) },
    )
      .then((r) => r.json())
      .then((data) => {
        const pts: PricePoint[] = (data.prices ?? []).map((p: Record<string, unknown>) => ({
          fetchedAt: p.fetchedAt as string,
          value: typeof p.value === 'string' ? parseFloat(p.value as string) : (p.value as number),
        }))
        setPrices(pts)
      })
      .catch(() => setPrices([]))
      .finally(() => setPriceLoading(false))
  }, [sourceId, asset.assetId])

  // Load fills page
  const loadFills = useCallback(
    (page: number) => {
      setFillsLoading(true)
      fetch(
        `/api/vision/vault/${vaultAddress}/assets/${encodeURIComponent(asset.assetId)}/fills?page=${page}&limit=100`,
        { signal: AbortSignal.timeout(10_000) },
      )
        .then((r) => r.json())
        .then((data: FillsResponse) => {
          setFills((prev) => (page === 0 ? data.fills : [...prev, ...data.fills]))
          setFillTotal(data.total)
          setFillPage(page)
        })
        .catch(() => {})
        .finally(() => setFillsLoading(false))
    },
    [vaultAddress, asset.assetId],
  )

  useEffect(() => {
    setFills([])
    setFillPage(0)
    loadFills(0)
  }, [loadFills])

  // Build chart data: price line + scatter fills
  const maxAmount = fills.reduce((m, f) => Math.max(m, f.amount), 0)

  // Downsample price line if huge
  const displayPrices =
    prices.length > 300
      ? prices.filter((_, i) => i % Math.ceil(prices.length / 300) === 0 || i === prices.length - 1)
      : prices

  const priceLineColor =
    prices.length >= 2
      ? prices[prices.length - 1].value >= prices[0].value
        ? '#16a34a'
        : '#dc2626'
      : '#94a3b8'

  // Map fills onto the price timeline for scatter overlay
  const priceMin = prices.length ? Math.min(...prices.map((p) => p.value)) : 0
  const priceMax = prices.length ? Math.max(...prices.map((p) => p.value)) : 1

  // Scatter points: { x: timestamp_ms, y: fillPrice or midpoint of priceRange }
  const buyScatter = fills
    .filter((f) => f.side === 'BUY' && f.fillPrice !== null)
    .map((f) => ({
      x: new Date(f.timestamp).getTime(),
      y: f.fillPrice!,
      r: dotRadius(f.amount, maxAmount),
      orderId: f.orderId,
      amount: f.amount,
      ts: f.timestamp,
    }))

  const sellScatter = fills
    .filter((f) => f.side === 'SELL' && f.fillPrice !== null)
    .map((f) => ({
      x: new Date(f.timestamp).getTime(),
      y: f.fillPrice!,
      r: dotRadius(f.amount, maxAmount),
      orderId: f.orderId,
      amount: f.amount,
      ts: f.timestamp,
    }))

  const hasMoreFills = fills.length < fillTotal

  return (
    <div
      ref={panelRef}
      style={{
        background: 'var(--apple-panel,#ffffff)',
        borderTop: '1px solid var(--apple-divider,#e8e8ed)',
        fontFamily: 'var(--apple-font-text,"SF Pro Text",Helvetica,Arial,sans-serif)',
      }}
    >
      {/* Panel header */}
      <div
        className="flex items-center justify-between px-5 py-4"
        style={{ borderBottom: '1px solid var(--apple-divider,#e8e8ed)' }}
      >
        <div>
          <h3
            className="font-semibold text-[var(--apple-text,#1d1d1f)]"
            style={{ fontSize: 17, letterSpacing: 'var(--apple-track-tight,-0.022em)' }}
          >
            {asset.assetId}
          </h3>
          <p
            className="text-[var(--apple-text-secondary,#6e6e73)] mt-0.5"
            style={{ fontSize: 13 }}
          >
            {fillTotal} {fillTotal === 1 ? 'fill' : 'fills'} · {asset.fillsCount} loaded
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close detail"
          className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-[var(--apple-surface,#f5f5f7)] transition-colors text-[var(--apple-text-secondary,#6e6e73)]"
          style={{ fontSize: 18 }}
        >
          ×
        </button>
      </div>

      {/* Chart */}
      <div className="px-5 pt-6 pb-2">
        {priceLoading ? (
          <div
            className="flex items-center justify-center"
            style={{
              height: 200,
              color: 'var(--apple-text-secondary,#6e6e73)',
              fontSize: 14,
            }}
          >
            loading chart…
          </div>
        ) : prices.length < 2 ? (
          <div
            className="flex items-center justify-center"
            style={{
              height: 200,
              color: 'var(--apple-text-secondary,#6e6e73)',
              fontSize: 14,
            }}
          >
            no price history
          </div>
        ) : (
          <div>
            <p
              className="text-[var(--apple-text-secondary,#6e6e73)] mb-3"
              style={{ fontSize: 12, letterSpacing: '0.06em', textTransform: 'uppercase', fontWeight: 600 }}
            >
              7-day price · fills overlay (▲ buy &nbsp;▼ sell)
            </p>
            <ResponsiveContainer width="100%" height={220}>
              <ComposedChart margin={{ top: 8, right: 8, left: 0, bottom: 8 }}>
                {/* Price line */}
                <Line
                  data={displayPrices}
                  type="monotone"
                  dataKey="value"
                  stroke={priceLineColor}
                  strokeWidth={1.5}
                  dot={false}
                  isAnimationActive={false}
                  xAxisId="time"
                  yAxisId="price"
                />

                {/* Buy scatter */}
                {buyScatter.length > 0 && (
                  <Scatter
                    data={buyScatter}
                    fill="#16a34a"
                    xAxisId="time"
                    yAxisId="price"
                    shape={(props: any) => {
                      const { cx, cy, payload } = props
                      return (
                        <text
                          x={cx}
                          y={cy}
                          textAnchor="middle"
                          dominantBaseline="middle"
                          fill="#16a34a"
                          fontSize={payload.r ?? 8}
                        >
                          ▲
                        </text>
                      )
                    }}
                  />
                )}

                {/* Sell scatter */}
                {sellScatter.length > 0 && (
                  <Scatter
                    data={sellScatter}
                    fill="#dc2626"
                    xAxisId="time"
                    yAxisId="price"
                    shape={(props: any) => {
                      const { cx, cy, payload } = props
                      return (
                        <text
                          x={cx}
                          y={cy}
                          textAnchor="middle"
                          dominantBaseline="middle"
                          fill="#dc2626"
                          fontSize={payload.r ?? 8}
                        >
                          ▼
                        </text>
                      )
                    }}
                  />
                )}

                <XAxis
                  xAxisId="time"
                  dataKey="fetchedAt"
                  type="category"
                  tick={false}
                  axisLine={{ stroke: 'var(--apple-divider,#e8e8ed)' }}
                  tickLine={false}
                />
                <YAxis
                  yAxisId="price"
                  domain={[priceMin * 0.98, priceMax * 1.02]}
                  tick={{ fontSize: 10, fill: '#86868b' }}
                  axisLine={false}
                  tickLine={false}
                  width={52}
                  tickFormatter={(v: number) => formatValue(v)}
                />
                <Tooltip
                  contentStyle={{
                    background: '#18181b',
                    border: 'none',
                    borderRadius: 4,
                    fontSize: 11,
                    fontFamily: 'var(--apple-font-text,Helvetica,Arial,sans-serif)',
                    color: '#fff',
                    padding: '4px 8px',
                  }}
                  formatter={(val: number) => [formatValue(val), 'value']}
                />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      {/* Fills table */}
      <div className="px-5 pb-6 mt-4">
        <p
          className="mb-3 text-[var(--apple-text-secondary,#6e6e73)]"
          style={{ fontSize: 12, fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase' }}
        >
          fills
        </p>

        {fillsLoading && fills.length === 0 ? (
          <p style={{ fontSize: 14, color: 'var(--apple-text-secondary,#6e6e73)' }}>loading…</p>
        ) : fills.length === 0 ? (
          <p style={{ fontSize: 14, color: 'var(--apple-text-secondary,#6e6e73)' }}>no filled orders</p>
        ) : (
          <div
            style={{
              border: '1px solid var(--apple-divider,#e8e8ed)',
              borderRadius: 'var(--apple-r-md,12px)',
              overflow: 'hidden',
            }}
          >
            <table className="w-full" style={{ borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  <th style={{ ...HEADER_CELL_STYLE, textAlign: 'left' }}>Time</th>
                  <th style={{ ...HEADER_CELL_STYLE, textAlign: 'center' }}>Side</th>
                  <th style={{ ...HEADER_CELL_STYLE, textAlign: 'right' }}>Amount</th>
                  <th style={{ ...HEADER_CELL_STYLE, textAlign: 'right' }}>Price</th>
                  <th style={{ ...HEADER_CELL_STYLE, textAlign: 'right' }}>Shares</th>
                </tr>
              </thead>
              <tbody>
                {fills.map((f) => (
                  <tr key={f.orderId} className="hover:bg-[var(--apple-surface,#f5f5f7)] transition-colors">
                    <td style={{ ...CELL_STYLE, color: 'var(--apple-text-secondary,#6e6e73)', whiteSpace: 'nowrap' }}>
                      {formatTs(f.timestamp)}
                    </td>
                    <td style={{ ...CELL_STYLE, textAlign: 'center' }}>
                      <span
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 2,
                          fontSize: 12,
                          fontWeight: 600,
                          color: f.side === 'BUY' ? '#16a34a' : '#dc2626',
                        }}
                      >
                        {f.side === 'BUY' ? '▲' : '▼'} {f.side}
                      </span>
                    </td>
                    <td style={{ ...CELL_STYLE, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                      {formatUsd(f.amount)}
                    </td>
                    <td style={{ ...CELL_STYLE, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                      {f.fillPrice !== null ? formatValue(f.fillPrice) : '—'}
                    </td>
                    <td style={{ ...CELL_STYLE, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                      {f.shares !== null ? f.shares.toFixed(4) : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {hasMoreFills && (
              <div
                className="flex justify-center py-3"
                style={{ borderTop: '1px solid var(--apple-divider,#e8e8ed)' }}
              >
                <button
                  type="button"
                  onClick={() => loadFills(fillPage + 1)}
                  disabled={fillsLoading}
                  className="text-[var(--apple-accent,#0071e3)] hover:underline disabled:opacity-50"
                  style={{ fontSize: 14 }}
                >
                  {fillsLoading ? 'loading…' : `load more · ${fillTotal - fills.length} remaining`}
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
