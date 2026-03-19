'use client'

import { useState, useMemo, useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useSourceSnapshot, useMarketSnapshotMeta } from '@/hooks/vision/useMarketSnapshot'
import type { SnapshotPrice } from '@/hooks/vision/useMarketSnapshot'
import { useBatches } from '@/hooks/vision/useBatches'
import { useBatchHistory } from '@/hooks/vision/useBatchHistory'
import { useSourceRegistry, findSource } from '@/hooks/vision/useSourceRegistry'
import type { BitmapEditor, CellState } from '@/hooks/vision/useBitmapEditor'
import { DATA_NODE_URL } from '@/lib/config'
import { ConsensusPopup } from './ConsensusPopup'
import { SpringExpand, SpringRow, SpringPress } from '@/components/ui/spring'
import {
  LineChart,
  Line,
  ResponsiveContainer,
  XAxis,
  YAxis,
  Tooltip,
  ReferenceLine,
} from 'recharts'
import type { BatchHistoryEntry } from '@/hooks/vision/useBatchHistory'

interface MarketsTableProps {
  sourceId: string
  bitmapEditor: BitmapEditor
  isResolving?: boolean
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


function truncateMiddle(str: string, maxLen: number): string {
  if (str.length <= maxLen) return str
  const half = Math.floor((maxLen - 3) / 2)
  return `${str.slice(0, half + 1)}...${str.slice(-half)}`
}

// Human-readable resolution type labels
const RES_TYPE_DISPLAY: Record<string, string> = {
  UP_0: 'Up/Dn', UP_30: 'Up 30bp', UP_X: 'Up X',
  DOWN_0: 'Dn/Up', DOWN_30: 'Dn 30bp', DOWN_X: 'Dn X',
  FLAT_0: 'Flat', FLAT_X: 'Flat X',
  UP_300: 'Up 3%', UP_3000: 'Up 30%',
  DOWN_300: 'Dn 3%', DOWN_3000: 'Dn 30%',
}

function resolutionBadge(resType: string | undefined) {
  if (!resType) {
    return <span className="text-[9px] text-text-muted">&mdash;</span>
  }
  const label = RES_TYPE_DISPLAY[resType] ?? resType
  const isUp = resType.startsWith('UP')
  const isDown = resType.startsWith('DOWN')
  const isFlat = resType.startsWith('FLAT')
  const bg = isUp
    ? 'bg-green-100 text-green-700 border-green-200'
    : isDown
      ? 'bg-red-100 text-red-700 border-red-200'
      : isFlat
        ? 'bg-yellow-50 text-yellow-700 border-yellow-200'
        : 'bg-gray-100 text-gray-600 border-gray-200'
  return (
    <span className={`inline-block px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-[0.08em] border ${bg}`}>
      {label}
    </span>
  )
}

function formatVolume(vol: string | null): string {
  if (!vol) return ''
  const num = parseFloat(vol)
  if (isNaN(num) || num === 0) return ''
  if (num >= 1_000_000_000) return `${(num / 1_000_000_000).toFixed(1)}B`
  if (num >= 1_000_000) return `${(num / 1_000_000).toFixed(1)}M`
  if (num >= 1_000) return `${(num / 1_000).toFixed(1)}K`
  return num.toFixed(0)
}

// Resolution type enum → label (matches IVision.ResolutionType)
const RESOLUTION_TYPE_LABELS: Record<number, string> = {
  0: 'UP_0', 1: 'UP_30', 2: 'UP_X',
  3: 'DOWN_0', 4: 'DOWN_30', 5: 'DOWN_X',
  6: 'FLAT_0', 7: 'FLAT_X',
  8: 'UP_300', 9: 'UP_3000',
  10: 'DOWN_300', 11: 'DOWN_3000',
}

// ── Asset Price History Chart ──

function AssetHistory({ dataNodeSourceId, assetId, tickHistory }: { dataNodeSourceId: string; assetId: string; tickHistory?: BatchHistoryEntry[] }) {
  const [points, setPoints] = useState<PriceHistoryPoint[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)

    const now = new Date()
    const from = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
    const url = `/api/market/history?source=${encodeURIComponent(dataNodeSourceId)}&asset=${encodeURIComponent(assetId)}&from=${from.toISOString()}&to=${now.toISOString()}`

    fetch(url, { signal: AbortSignal.timeout(15_000) })
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
        <div className="text-label text-text-muted">Loading history...</div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="h-[60px] flex items-center justify-center bg-surface/50">
        <div className="text-label text-text-muted">No history available</div>
      </div>
    )
  }

  if (points.length < 2) {
    return (
      <div className="h-[60px] flex items-center justify-center bg-surface/50">
        <div className="text-label text-text-muted">Not enough data ({points.length} point{points.length !== 1 ? 's' : ''})</div>
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
        <span className="text-micro font-semibold uppercase tracking-[0.08em] text-text-muted">
          7-day history ({points.length.toLocaleString()} points)
        </span>
        <div className="flex items-center gap-3">
          <span className="text-label font-mono text-text-muted">
            {formatValue(points[0].value)} &rarr; {formatValue(points[points.length - 1].value)}
          </span>
          {changePct !== null && (
            <span className={`text-label font-mono font-bold ${changePct >= 0 ? 'text-green-600' : 'text-red-600'}`}>
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
          {/* Resolution time markers */}
          {(tickHistory ?? []).map((tick) => {
            if (!tick.resolvedAt) return null
            const ts = new Date(typeof tick.resolvedAt === 'number' ? tick.resolvedAt * 1000 : tick.resolvedAt).toISOString()
            const outcome = tick.marketOutcomes?.find(mo => mo.marketId === assetId)
            return (
              <ReferenceLine
                key={tick.tickId}
                x={ts}
                stroke={outcome?.wentUp ? '#16a34a' : '#dc2626'}
                strokeDasharray="3 3"
                strokeWidth={1}
                opacity={0.6}
              />
            )
          })}
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

export function MarketsTable({ sourceId, bitmapEditor, isResolving }: MarketsTableProps) {
  // Source metadata from registry
  const { sources } = useSourceRegistry()
  const sourceEntry = findSource(sources, sourceId)
  const valueLabel = sourceEntry?.valueLabel ?? 'Value'
  const isPriceSource = sourceEntry?.isPrice ?? true
  const unit = sourceEntry?.valueUnit ?? ''

  // Snapshot data — sourceId IS the data-node source ID
  const { data, isLoading } = useSourceSnapshot(sourceId)
  const { data: meta } = useMarketSnapshotMeta()

  // Fetch live batch to get per-market resolution types via batch ID
  const { data: batches } = useBatches()
  const activeBatch = useMemo(() => {
    if (!batches) return null
    return batches.find(b => b.sourceId === sourceId) ?? null
  }, [batches, sourceId])

  // Fetch batch config by hash from data-node (has per-market resolution types)
  const configHash = activeBatch?.configHash
  const { data: batchConfigData } = useQuery<{ markets: { assetId: string; resolutionType: string }[] }>({
    queryKey: ['batch-config-hash', configHash],
    queryFn: async () => {
      const res = await fetch(`${DATA_NODE_URL}/batches/config/${configHash}`)
      if (!res.ok) return { markets: [] }
      return res.json()
    },
    enabled: !!configHash,
    staleTime: 300_000,
    retry: 1,
  })

  // Build resolution type map from config (data-node) or from batch arrays (oracle)
  const resolutionMap = useMemo(() => {
    const map = new Map<string, string>()
    // Prefer data-node config (has per-market resolution types)
    if (batchConfigData?.markets?.length) {
      for (const m of batchConfigData.markets) {
        if (m.assetId && m.resolutionType) {
          map.set(m.assetId, m.resolutionType.toUpperCase())
        }
      }
      return map
    }
    // Fallback: oracle batch arrays (if populated)
    if (activeBatch?.marketIds?.length && activeBatch?.resolutionTypes?.length) {
      const { marketIds, resolutionTypes } = activeBatch
      for (let i = 0; i < marketIds.length; i++) {
        const label = RESOLUTION_TYPE_LABELS[resolutionTypes[i]] ?? `TYPE_${resolutionTypes[i]}`
        map.set(marketIds[i], label)
      }
    }
    return map
  }, [batchConfigData, activeBatch])

  // Fetch tick history for consensus arrows
  const { data: tickHistory } = useBatchHistory(activeBatch?.id ?? null)

  // Per-market consensus: last N tick outcomes (up/down per market)
  const consensusMap = useMemo(() => {
    const map = new Map<string, ('UP' | 'DN')[]>()
    if (!tickHistory || tickHistory.length === 0) return map
    // tickHistory is sorted DESC (newest first), take last 5
    const recentTicks = tickHistory.slice(0, 5)
    for (const tick of recentTicks) {
      for (const mo of tick.marketOutcomes ?? []) {
        const arr = map.get(mo.marketId) ?? []
        arr.push(mo.wentUp ? 'UP' : 'DN')
        map.set(mo.marketId, arr)
      }
    }
    return map
  }, [tickHistory])

  const [search, setSearch] = useState('')
  const [consensusOpen, setConsensusOpen] = useState<string | null>(null)
  const [expandedAssetId, setExpandedAssetId] = useState<string | null>(null)

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

  // All rows — content-visibility handles offscreen perf
  const visibleMarkets = filteredMarkets

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
            {isLoading ? '...' : (meta?.assetCounts?.[sourceId] ?? sourceMarkets.length)}
          </div>
        </div>
        <div className="flex items-center gap-3">
          <input
            type="text"
            placeholder="Search markets..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="px-3 py-1.5 rounded text-caption bg-white/10 border border-white/20 text-white placeholder:text-white/40 outline-none focus:border-white/50 w-[180px]"
          />
        </div>
      </div>

      {/* Table */}
      <div className="bg-white border border-t-0 border-border-light overflow-x-auto">
        {/* Column headers */}
        <div className="grid grid-cols-[1fr_80px_100px_80px_100px_100px] items-center px-4 py-2.5 border-b-[3px] border-black text-micro font-bold uppercase tracking-[0.08em] text-text-muted">
          <div>Name</div>
          <div className="text-center">Type</div>
          <div className="text-right">{valueLabel}{unit ? ` (${unit})` : ''}</div>
          <div className="text-right">1d</div>
          <div className="text-center">Consensus</div>
          <div className="text-center">Bet</div>
        </div>

        {/* Loading state */}
        {isLoading && (
          <div className="px-4 py-8 text-center text-caption text-text-muted">
            Loading markets...
          </div>
        )}

        {/* Empty state */}
        {!isLoading && filteredMarkets.length === 0 && (
          <div className="px-4 py-8 text-center text-caption text-text-muted">
            {search ? 'No markets match your search' : 'No markets available'}
          </div>
        )}

        {/* Market rows — tall viewport, content-visibility for offscreen perf */}
        <div className={`max-h-[calc(100vh-280px)] overflow-y-auto ${isResolving ? 'rows-resolving' : ''}`}>
          {visibleMarkets.map((market, idx) => {
            const change1d = formatChangePct(market.changePct)
            const vol = formatVolume(market.volume24h)
            const betState = getBetState(market.assetId)
            const isExpanded = expandedAssetId === market.assetId
            const resType = resolutionMap.get(market.assetId)
            const consensus = consensusMap.get(market.assetId) ?? []

            // Momentum bar — 24h change as subtle colored background behind price
            const changePctNum = parseFloat(market.changePct ?? '0')
            const momentumStyle: React.CSSProperties | undefined = (() => {
              if (isNaN(changePctNum) || Math.abs(changePctNum) < 0.1) return undefined
              const w = Math.min(Math.abs(changePctNum), 30) / 30 * 100
              const c = changePctNum >= 0 ? 'rgba(22,163,74,0.06)' : 'rgba(220,38,38,0.06)'
              return { background: `linear-gradient(to ${changePctNum >= 0 ? 'right' : 'left'}, ${c} ${w}%, transparent ${w}%)` }
            })()

            return (
              <div key={market.assetId} data-row className={isExpanded ? '' : 'cv-row'} style={{ '--row-i': idx } as React.CSSProperties}>
                <SpringRow
                  className={`grid grid-cols-[1fr_80px_100px_80px_100px_100px] items-center px-4 py-2.5 border-b border-border-light text-caption cursor-pointer ${
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
                    <div className="min-w-0 overflow-hidden">
                      <div className="font-semibold text-black truncate" title={market.name || market.symbol}>
                        {truncateMiddle(market.name || market.symbol, 28)}
                      </div>
                      <div className="text-micro font-mono text-text-muted mt-0.5 truncate">
                        {truncateMiddle(market.symbol, 20)}{vol ? ` · Vol ${vol}` : ''}
                      </div>
                    </div>
                  </div>

                  {/* Resolution type — default to UP/DN (type 0) when config unavailable */}
                  <div className="text-center">
                    {resolutionBadge(resType ?? 'UP_0')}
                  </div>

                  {/* Value — momentum bar behind price */}
                  <div className="text-right font-mono tabular-nums text-black font-semibold" style={momentumStyle}>
                    {formatPrice(market.value, isPriceSource)}
                  </div>

                  {/* 1d change */}
                  <div className={`text-right font-mono tabular-nums font-semibold ${change1d.color}`}>
                    {change1d.text}
                  </div>


                  {/* Consensus — last N tick outcomes as colored arrow squares */}
                  <div className="relative">
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        setConsensusOpen(
                          consensusOpen === market.assetId ? null : market.assetId
                        )
                      }}
                      className="flex items-center justify-center gap-0.5 w-full cursor-pointer rounded py-0.5 hover:bg-surface/50 transition-colors"
                    >
                      {consensus.length === 0 ? (
                        <span className="text-[9px] text-text-muted">&mdash;</span>
                      ) : (
                        consensus.map((dir, idx) => (
                          <span
                            key={idx}
                            className={`inline-flex items-center justify-center w-4 h-4 rounded-sm text-[8px] font-bold ${
                              dir === 'UP'
                                ? 'bg-green-100 text-green-700'
                                : 'bg-red-100 text-red-700'
                            }`}
                          >
                            {dir === 'UP' ? '↑' : '↓'}
                          </span>
                        ))
                      )}
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
                    <SpringPress><button
                      onClick={(e) => { e.stopPropagation(); handleBet(market.assetId, 'up') }}
                      className={`px-2.5 py-1 rounded text-micro font-bold uppercase transition-colors ${
                        betState === 'up'
                          ? 'bg-green-600 text-white shadow-sm'
                          : 'bg-green-50 text-green-700 hover:bg-green-100 border border-green-200'
                      }`}
                    >
                      UP
                    </button></SpringPress>
                    <SpringPress><button
                      onClick={(e) => { e.stopPropagation(); handleBet(market.assetId, 'down') }}
                      className={`px-2.5 py-1 rounded text-micro font-bold uppercase transition-colors ${
                        betState === 'down'
                          ? 'bg-red-600 text-white shadow-sm'
                          : 'bg-red-50 text-red-700 hover:bg-red-100 border border-red-200'
                      }`}
                    >
                      DN
                    </button></SpringPress>
                  </div>
                </SpringRow>

                {/* Expanded history chart */}
                <SpringExpand isOpen={isExpanded}>
                  <div className="border-b border-border-light">
                    <AssetHistory dataNodeSourceId={sourceId} assetId={market.assetId} tickHistory={tickHistory ?? []} />
                  </div>
                </SpringExpand>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
