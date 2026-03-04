'use client'

import { useState, useMemo, useEffect } from 'react'
import { useSourceSnapshot, useMarketSnapshotMeta } from '@/hooks/vision/useMarketSnapshot'
import type { SnapshotPrice } from '@/hooks/vision/useMarketSnapshot'
import { getSource, getAssetCountForSource, getDataNodeSourceId, getSourceValueLabel, isSourcePriceType, getSourceUnit } from '@/lib/vision/sources'
import type { BitmapEditor, CellState } from '@/hooks/vision/useBitmapEditor'
import { useBatches } from '@/hooks/vision/useBatches'
import batchConfig from '@/lib/contracts/vision-batches.json'
import { ConsensusPopup } from './ConsensusPopup'
import { DATA_NODE_URL } from '@/lib/config'
import {
  LineChart,
  Line,
  ResponsiveContainer,
  XAxis,
  YAxis,
  Tooltip,
} from 'recharts'

interface MarketsTableProps {
  sourceId: string
  bitmapEditor: BitmapEditor
}

interface PriceHistoryPoint {
  fetchedAt: string
  value: number
}

function formatPrice(value: string, asCurrency: boolean): string {
  const num = parseFloat(value)
  if (isNaN(num)) return '--'
  const prefix = asCurrency ? '$' : ''
  if (num >= 1_000_000) return `${prefix}${(num / 1_000_000).toFixed(2)}M`
  if (num >= 1_000) return `${prefix}${(num / 1_000).toFixed(2)}K`
  if (num >= 1) return `${prefix}${num.toFixed(2)}`
  if (num >= 0.01) return `${prefix}${num.toFixed(4)}`
  return `${prefix}${num.toFixed(6)}`
}

function formatValue(v: number): string {
  if (v === 0) return '0'
  if (Math.abs(v) < 0.0001) return v.toExponential(2)
  if (Math.abs(v) < 1) return v.toFixed(6)
  if (Math.abs(v) >= 1_000_000_000) return `${(v / 1_000_000_000).toFixed(2)}B`
  if (Math.abs(v) >= 1_000_000) return `${(v / 1_000_000).toFixed(2)}M`
  if (Math.abs(v) >= 1_000) return `${(v / 1_000).toFixed(2)}K`
  return v.toFixed(2)
}

function formatChangePct(pct: string | null): { text: string; color: string } {
  if (!pct) return { text: '--', color: 'text-text-muted' }
  const num = parseFloat(pct)
  if (isNaN(num)) return { text: '--', color: 'text-text-muted' }
  const sign = num >= 0 ? '+' : ''
  const color = num > 0 ? 'text-green-600' : num < 0 ? 'text-red-600' : 'text-text-muted'
  return { text: `${sign}${num.toFixed(2)}%`, color }
}

const RESOLUTION_NAMES = ['UP_0', 'UP_30', 'UP_X', 'DOWN_0', 'DOWN_30', 'DOWN_X', 'FLAT_0', 'FLAT_X'] as const

function formatVolume(vol: string | null): string {
  if (!vol) return ''
  const num = parseFloat(vol)
  if (isNaN(num) || num === 0) return ''
  if (num >= 1_000_000_000) return `${(num / 1_000_000_000).toFixed(1)}B`
  if (num >= 1_000_000) return `${(num / 1_000_000).toFixed(1)}M`
  if (num >= 1_000) return `${(num / 1_000).toFixed(1)}K`
  return num.toFixed(0)
}

// ── Asset Price History Chart ──

function AssetHistory({ dataNodeSourceId, assetId }: { dataNodeSourceId: string; assetId: string }) {
  const [points, setPoints] = useState<PriceHistoryPoint[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)

    const now = new Date()
    const from = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
    const url = `${DATA_NODE_URL}/market/prices/${dataNodeSourceId}/${encodeURIComponent(assetId)}/history?from=${from.toISOString()}&to=${now.toISOString()}`

    fetch(url, { signal: AbortSignal.timeout(10_000) })
      .then(res => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        return res.json()
      })
      .then(data => {
        if (cancelled) return
        const prices: PriceHistoryPoint[] = (data.prices || []).map((p: Record<string, unknown>) => ({
          fetchedAt: p.fetchedAt as string,
          value: typeof p.value === 'string' ? parseFloat(p.value as string) : (p.value as number),
        }))
        setPoints(prices)
      })
      .catch(e => {
        if (!cancelled) setError(e.message)
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => { cancelled = true }
  }, [dataNodeSourceId, assetId])

  const lineColor = useMemo(() => {
    if (points.length < 2) return '#94a3b8'
    return points[points.length - 1].value >= points[0].value ? '#16a34a' : '#dc2626'
  }, [points])

  const changePct = useMemo(() => {
    if (points.length < 2) return null
    const first = points[0].value
    const last = points[points.length - 1].value
    if (first === 0) return null
    return ((last - first) / first) * 100
  }, [points])

  if (loading) {
    return (
      <div className="h-[120px] flex items-center justify-center bg-surface/50">
        <div className="text-[11px] text-text-muted">Loading history...</div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="h-[60px] flex items-center justify-center bg-surface/50">
        <div className="text-[11px] text-text-muted">No history available</div>
      </div>
    )
  }

  if (points.length < 2) {
    return (
      <div className="h-[60px] flex items-center justify-center bg-surface/50">
        <div className="text-[11px] text-text-muted">Not enough data ({points.length} point{points.length !== 1 ? 's' : ''})</div>
      </div>
    )
  }

  // Downsample for performance
  const displayPoints = points.length > 200
    ? points.filter((_, i) => i % Math.ceil(points.length / 200) === 0 || i === points.length - 1)
    : points

  return (
    <div className="bg-surface/50 px-4 py-3">
      <div className="flex items-center justify-between mb-2">
        <span className="text-[10px] font-semibold uppercase tracking-[0.08em] text-text-muted">
          7-day history ({points.length.toLocaleString()} points)
        </span>
        <div className="flex items-center gap-3">
          <span className="text-[11px] font-mono text-text-muted">
            {formatValue(points[0].value)} &rarr; {formatValue(points[points.length - 1].value)}
          </span>
          {changePct !== null && (
            <span className={`text-[11px] font-mono font-bold ${changePct >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              {changePct >= 0 ? '+' : ''}{changePct.toFixed(2)}%
            </span>
          )}
        </div>
      </div>
      <ResponsiveContainer width="100%" height={100}>
        <LineChart data={displayPoints} margin={{ top: 4, right: 4, left: 4, bottom: 4 }}>
          <XAxis
            dataKey="fetchedAt"
            tick={false}
            axisLine={{ stroke: 'rgba(0,0,0,0.08)' }}
            tickLine={false}
          />
          <YAxis
            domain={['auto', 'auto']}
            tick={false}
            axisLine={false}
            tickLine={false}
            width={0}
          />
          <Tooltip
            contentStyle={{
              background: '#18181b',
              border: 'none',
              borderRadius: '4px',
              fontSize: '10px',
              fontFamily: 'var(--font-jetbrains-mono), monospace',
              color: '#fff',
              padding: '4px 8px',
            }}
            labelFormatter={(label: string) => {
              const d = new Date(label)
              return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false })
            }}
            formatter={(val: number) => [formatValue(val), 'Value']}
          />
          <Line
            type="monotone"
            dataKey="value"
            stroke={lineColor}
            strokeWidth={1.5}
            dot={false}
            isAnimationActive={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}

// ── Markets Table ──

export function MarketsTable({ sourceId, bitmapEditor }: MarketsTableProps) {
  const source = getSource(sourceId)
  const dataNodeId = source ? getDataNodeSourceId(sourceId) : undefined
  const { data, isLoading } = useSourceSnapshot(dataNodeId)
  const { data: meta } = useMarketSnapshotMeta()
  const { data: batches } = useBatches()

  // Build resolution type map: marketId -> label (e.g. "UP_0", "FLAT_X")
  const resolutionMap = useMemo(() => {
    const map = new Map<string, string>()
    if (!batches) return map
    const entry = (batchConfig.batches as Record<string, { batchId: number }>)[sourceId]
    const batch = entry ? batches.find(b => b.id === entry.batchId) : batches[0]
    if (!batch) return map
    batch.marketIds.forEach((mid, i) => {
      const rt = batch.resolutionTypes[i]
      if (rt !== undefined && rt < RESOLUTION_NAMES.length) {
        map.set(mid, RESOLUTION_NAMES[rt])
      }
    })
    return map
  }, [batches, sourceId])
  const valueLabel = getSourceValueLabel(sourceId)
  const isPriceSource = isSourcePriceType(sourceId)
  const unit = getSourceUnit(sourceId)
  const [search, setSearch] = useState('')
  const [consensusOpen, setConsensusOpen] = useState<string | null>(null)
  const [expandedAssetId, setExpandedAssetId] = useState<string | null>(null)
  const [displayLimit, setDisplayLimit] = useState(100)

  // Markets come directly from per-source snapshot (already filtered server-side)
  const sourceMarkets: SnapshotPrice[] = data?.prices ?? []

  // Apply search filter
  const filteredMarkets = useMemo(() => {
    if (!search.trim()) return sourceMarkets
    const q = search.toLowerCase()
    return sourceMarkets.filter(
      (m) =>
        m.symbol.toLowerCase().includes(q) ||
        m.name.toLowerCase().includes(q)
    )
  }, [sourceMarkets, search])

  // Only render a limited number of rows for performance
  const visibleMarkets = useMemo(
    () => filteredMarkets.slice(0, displayLimit),
    [filteredMarkets, displayLimit],
  )
  const hasMore = filteredMarkets.length > displayLimit

  const getBetState = (marketId: string): CellState => {
    return bitmapEditor.state[marketId] ?? 'empty'
  }

  const handleBet = (marketId: string, direction: 'up' | 'down') => {
    const current = getBetState(marketId)
    if (current === direction) {
      bitmapEditor.setCell(marketId, 'empty')
    } else {
      bitmapEditor.setCell(marketId, direction)
    }
  }

  const handleRowClick = (assetId: string) => {
    setExpandedAssetId(expandedAssetId === assetId ? null : assetId)
  }

  return (
    <div>
      {/* Markets bar */}
      <div className="section-bar">
        <div>
          <div className="section-bar-title">Markets</div>
          <div className="section-bar-value">
            {isLoading ? '...' : (meta?.assetCounts ? getAssetCountForSource(sourceId, meta.assetCounts) : sourceMarkets.length)}
          </div>
        </div>
        <div className="flex items-center gap-3">
          <input
            type="text"
            placeholder="Search markets..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setDisplayLimit(100) }}
            className="px-3 py-1.5 rounded text-[12px] bg-white/10 border border-white/20 text-white placeholder:text-white/40 outline-none focus:border-white/50 w-[180px]"
          />
        </div>
      </div>

      {/* Table */}
      <div className="bg-white border border-t-0 border-border-light overflow-x-auto">
        {/* Column headers */}
        <div className="grid grid-cols-[1fr_100px_80px_80px_80px_100px] items-center px-4 py-2.5 border-b-[3px] border-black text-[10px] font-bold uppercase tracking-[0.1em] text-text-muted">
          <div>Name</div>
          <div className="text-right">{valueLabel}{unit ? ` (${unit})` : ''}</div>
          <div className="text-right">1d</div>
          <div className="text-right">7d</div>
          <div className="text-center">Consensus</div>
          <div className="text-center">Bet</div>
        </div>

        {/* Loading state */}
        {isLoading && (
          <div className="px-4 py-8 text-center text-[13px] text-text-muted">
            Loading markets...
          </div>
        )}

        {/* Empty state */}
        {!isLoading && filteredMarkets.length === 0 && (
          <div className="px-4 py-8 text-center text-[13px] text-text-muted">
            {search ? 'No markets match your search' : 'No markets available'}
          </div>
        )}

        {/* Market rows */}
        <div className="max-h-[600px] overflow-y-auto">
          {visibleMarkets.map((market) => {
            const change1d = formatChangePct(market.changePct)
            const change7d = formatChangePct(null)
            const vol = formatVolume(market.volume24h)
            const betState = getBetState(market.assetId)
            const isExpanded = expandedAssetId === market.assetId
            const resType = resolutionMap.get(market.assetId)

            return (
              <div key={market.assetId}>
                <div
                  className={`grid grid-cols-[1fr_100px_80px_80px_80px_100px] items-center px-4 py-2.5 border-b border-border-light hover:bg-surface/50 transition-colors text-[13px] cursor-pointer ${
                    isExpanded ? 'bg-surface/50 border-b-0' : ''
                  }`}
                  onClick={() => handleRowClick(market.assetId)}
                >
                  {/* Name */}
                  <div className="min-w-0 flex items-center gap-2">
                    <svg
                      className={`w-3 h-3 text-text-muted shrink-0 transition-transform ${isExpanded ? 'rotate-90' : ''}`}
                      fill="currentColor"
                      viewBox="0 0 20 20"
                    >
                      <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
                    </svg>
                    <div className="min-w-0">
                      <div className="font-semibold text-black truncate">
                        {market.name || market.symbol}
                      </div>
                      <div className="text-[10px] font-mono text-text-muted mt-0.5">
                        {market.symbol}{resType ? ` · ${resType}` : ''}{vol ? ` · Vol ${vol}` : ''}
                      </div>
                    </div>
                  </div>

                  {/* Value */}
                  <div className="text-right font-mono tabular-nums text-black font-semibold">
                    {formatPrice(market.value, isPriceSource)}
                  </div>

                  {/* 1d change */}
                  <div className={`text-right font-mono tabular-nums font-semibold ${change1d.color}`}>
                    {change1d.text}
                  </div>

                  {/* 7d change */}
                  <div className={`text-right font-mono tabular-nums font-semibold ${change7d.color}`}>
                    {change7d.text}
                  </div>

                  {/* Consensus */}
                  <div className="text-center relative">
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        setConsensusOpen(
                          consensusOpen === market.assetId ? null : market.assetId
                        )
                      }}
                      className="inline-flex items-center justify-center px-2 py-0.5 rounded text-[11px] font-bold hover:bg-surface transition-colors cursor-pointer"
                    >
                      &mdash;
                    </button>
                    {consensusOpen === market.assetId && (
                      <ConsensusPopup
                        marketId={market.assetId}
                        onClose={() => setConsensusOpen(null)}
                      />
                    )}
                  </div>

                  {/* Bet UP/DN */}
                  <div className="flex items-center justify-center gap-1.5">
                    <button
                      onClick={(e) => { e.stopPropagation(); handleBet(market.assetId, 'up') }}
                      className={`px-2.5 py-1 rounded text-[10px] font-bold uppercase transition-all ${
                        betState === 'up'
                          ? 'bg-green-600 text-white shadow-sm'
                          : 'bg-green-50 text-green-700 hover:bg-green-100 border border-green-200'
                      }`}
                    >
                      UP
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); handleBet(market.assetId, 'down') }}
                      className={`px-2.5 py-1 rounded text-[10px] font-bold uppercase transition-all ${
                        betState === 'down'
                          ? 'bg-red-600 text-white shadow-sm'
                          : 'bg-red-50 text-red-700 hover:bg-red-100 border border-red-200'
                      }`}
                    >
                      DN
                    </button>
                  </div>
                </div>

                {/* Expanded history chart */}
                {isExpanded && dataNodeId && (
                  <div className="border-b border-border-light">
                    <AssetHistory dataNodeSourceId={dataNodeId} assetId={market.assetId} />
                  </div>
                )}
              </div>
            )
          })}
          {hasMore && (
            <button
              onClick={() => setDisplayLimit((l) => l + 200)}
              className="w-full py-3 text-[12px] font-bold text-text-muted hover:text-black hover:bg-surface/50 transition-colors border-t border-border-light cursor-pointer"
            >
              Show more ({filteredMarkets.length - displayLimit} remaining)
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
