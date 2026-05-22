'use client'

import { useState, useMemo, useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useSourceSnapshot, useMarketSnapshotMeta } from '@/hooks/vision/useMarketSnapshot'
import type { SnapshotPrice } from '@/hooks/vision/useMarketSnapshot'
import { useBatches } from '@/hooks/vision/useBatches'
import { useSourceRegistry, findSource } from '@/hooks/vision/useSourceRegistry'
import type { BitmapEditor, CellState } from '@/hooks/vision/useBitmapEditor'
import { SpringExpand, SpringRow, SpringPress } from '@/components/ui/spring'
import { GeneralLoader } from '@/components/ui/GeneralLoader'
import { getLineStyle } from '@/lib/vision/transport-colors'
import { getAssetImageUrl } from '@/lib/vision/asset-images'
// Side-effect imports: register official color maps
import '@/lib/vision/line-maps/transit-eu'
import '@/lib/vision/line-maps/db-trains'
import '@/lib/vision/line-maps/sports'
import '@/lib/vision/line-maps/gtfs-flights'
import '@/lib/vision/line-maps/aviation-misc'
import {
  LineChart,
  Line,
  ResponsiveContainer,
  XAxis,
  YAxis,
  Tooltip,
} from 'recharts'
import { useTranslations, useLocale } from 'next-intl'

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
  const color = num > 0 ? 'text-color-up' : num < 0 ? 'text-color-down' : 'text-text-muted'
  return { text: `${sign}${num.toFixed(2)}%`, color }
}


function truncateMiddle(str: string, maxLen: number): string {
  if (str.length <= maxLen) return str
  const half = Math.floor((maxLen - 3) / 2)
  return `${str.slice(0, half + 1)}...${str.slice(-half)}`
}

/** Format resolution type with precise threshold from config.
 *  UP_X + 30bps → "Up 0.3%"   DOWN_X + 50bps → "Dn 0.5%"   UP_0 → "Up/Dn"
 */
function formatResLabel(resType: string, thresholdBps?: number): string {
  const dir = resType.startsWith('UP') ? 'Up'
    : resType.startsWith('DOWN') ? 'Dn'
    : null
  if (!dir) return resType

  const bps = thresholdBps ?? 0
  if (bps <= 0) {
    return dir === 'Up' ? 'Up/Dn' : 'Dn/Up'
  }

  const pct = bps / 100
  const pctStr = pct >= 10 ? `${pct.toFixed(0)}%`
    : pct >= 1 ? `${pct.toFixed(1).replace(/\.0$/, '')}%`
    : `${pct.toFixed(2).replace(/0$/, '')}%`
  return `${dir} ${pctStr}`
}

function resolutionBadge(resType: string | undefined, thresholdBps?: number) {
  if (!resType) {
    return <span className="text-[9px] text-text-muted">&mdash;</span>
  }
  const label = formatResLabel(resType, thresholdBps)
  const isUp = resType.startsWith('UP')
  const isDown = resType.startsWith('DOWN')
  const bg = isUp
    ? 'bg-surface-up text-color-up border-color-up/20'
    : isDown
      ? 'bg-surface-down text-color-down border-color-down/20'
      : 'bg-muted text-text-secondary border-border-light'
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


// ── Asset Price History Chart ──

function AssetHistory({ dataNodeSourceId, assetId }: { dataNodeSourceId: string; assetId: string }) {
  const t = useTranslations('vision')
  const locale = useLocale()
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
        <div className="text-label text-text-muted">{t('markets_table.loading_history')}</div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="h-[60px] flex items-center justify-center bg-surface/50">
        <div className="text-label text-text-muted">{t('markets_table.no_history')}</div>
      </div>
    )
  }

  if (points.length < 2) {
    return (
      <div className="h-[60px] flex items-center justify-center bg-surface/50">
        <div className="text-label text-text-muted">{t('markets_table.not_enough_data', { count: points.length, plural: points.length !== 1 ? 's' : '' })}</div>
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
          {t('markets_table.history_label', { count: points.length.toLocaleString() })}
        </span>
        <div className="flex items-center gap-3">
          <span className="text-label font-mono text-text-muted">
            {formatValue(points[0].value)} &rarr; {formatValue(points[points.length - 1].value)}
          </span>
          {changePct !== null && (
            <span className={`text-label font-mono font-bold ${changePct >= 0 ? 'text-color-up' : 'text-color-down'}`}>
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
              return d.toLocaleDateString(locale, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false })
            }}
            formatter={(val: number) => [formatValue(val), t('markets_table.value_tooltip')]}
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

// ── Asset Icon (image → text badge → arrow fallback) ──

function AssetIcon({
  sourceId, assetId, prefixes, imageUrl: apiImageUrl, isExpanded,
}: {
  sourceId: string
  assetId: string
  prefixes?: string[]
  imageUrl?: string | null
  isExpanded: boolean
}) {
  const [imgErr, setImgErr] = useState(false)
  const src = apiImageUrl || getAssetImageUrl(sourceId, assetId, prefixes ?? [])
  const lineStyle = getLineStyle(sourceId, assetId, prefixes)

  if (src && !imgErr) {
    return (
      <img
        src={src}
        alt=""
        className="shrink-0 w-[22px] h-[22px] rounded-full object-cover"
        loading="lazy"
        onError={() => setImgErr(true)}
      />
    )
  }
  if (lineStyle) {
    return (
      <span
        className="shrink-0 inline-flex items-center justify-center rounded-full font-black text-[10px] leading-none"
        style={{
          background: lineStyle.bg,
          color: lineStyle.fg,
          width: lineStyle.label.length > 1 ? 28 : 22,
          height: 22,
        }}
      >
        {lineStyle.label}
      </span>
    )
  }
  return (
    <svg
      className={`w-3 h-3 text-text-muted shrink-0 transition-transform ${isExpanded ? 'rotate-90' : ''}`}
      fill="currentColor"
      viewBox="0 0 20 20"
    >
      <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
    </svg>
  )
}

// ── Markets Table ──

export function MarketsTable({ sourceId, bitmapEditor }: MarketsTableProps) {
  const t = useTranslations('vision')
  // Source metadata from registry
  const { sources } = useSourceRegistry()
  const sourceEntry = findSource(sources, sourceId)
  const valueLabel = sourceEntry?.valueLabel ?? 'Value'
  const isPriceSource = sourceEntry?.isPrice ?? true
  const unit = sourceEntry?.valueUnit ?? ''

  // Snapshot data — sourceId IS the data-node source ID
  const { data, isLoading, refetch, dataUpdatedAt } = useSourceSnapshot(sourceId)
  const { data: meta } = useMarketSnapshotMeta()

  // Markets come directly from per-source snapshot (already filtered server-side)
  const sourceMarkets: SnapshotPrice[] = data?.prices ?? []

  // Meta asset count for loading placeholder row count
  const metaAssetCount = meta?.assetCounts?.[sourceId]

  // If meta says markets exist but snapshot returned empty, keep showing loader and retry
  const expectsMarkets = (metaAssetCount ?? 0) > 0
  const snapshotEmpty = !isLoading && sourceMarkets.length === 0
  const shouldRetry = snapshotEmpty && expectsMarkets

  useEffect(() => {
    if (!shouldRetry) return
    // Retry every 5s until we get data
    const iv = setInterval(() => refetch(), 5_000)
    return () => clearInterval(iv)
  }, [shouldRetry, refetch])

  // Fetch live batch to get per-market resolution types via batch ID
  const { data: batches } = useBatches()
  const activeBatch = useMemo(() => {
    if (!batches) return null
    return batches.find(b => b.sourceId === sourceId) ?? null
  }, [batches, sourceId])

  // Fetch latest batch config for this source from data-node (has per-market resolution types + thresholds)
  const { data: batchConfigData } = useQuery<{ markets: { assetId: string; resolutionType: string; thresholdBps: number }[] }>({
    queryKey: ['batch-config-source', sourceId],
    queryFn: async () => {
      const res = await fetch(`/api/vision/config/${sourceId}`)
      if (!res.ok) return { markets: [] }
      return res.json()
    },
    enabled: !!sourceId,
    staleTime: 300_000,
    retry: 1,
  })

  // Resolution type + threshold per market
  const resolutionMap = useMemo(() => {
    const map = new Map<string, { resType: string; thresholdBps: number }>()
    // If data-node config has matching assetIds, use them (includes thresholdBps)
    if (batchConfigData?.markets?.length) {
      for (const m of batchConfigData.markets) {
        if (m.assetId && m.resolutionType) {
          map.set(m.assetId, { resType: m.resolutionType.toUpperCase(), thresholdBps: m.thresholdBps ?? 0 })
        }
      }
      if (map.size > 0) return map
    }
    // Compute from snapshot 24h change (mirrors resolution_for_volatility in batch_engine)
    for (const market of sourceMarkets) {
      const pct = parseFloat(market.changePct ?? '0')
      const abs = Math.abs(pct)
      let resType: string
      let thresholdBps: number
      // Snapshot fallback — mirrors the data-node EMA path's floor logic.
      // Below the 20-bps binary floor → up_0/down_0 (any-move-wins). Above
      // it → up_x/down_x at the exact 24h move in bps. flat_x retired.
      if (abs < 0.2) { resType = pct < 0 ? 'DOWN_0' : 'UP_0'; thresholdBps = 0 }
      else { resType = pct < 0 ? 'DOWN_X' : 'UP_X'; thresholdBps = Math.min(Math.round(abs * 100), 10000) }
      map.set(market.assetId, { resType, thresholdBps })
    }
    return map
  }, [batchConfigData, sourceMarkets])

  const [search, setSearch] = useState('')
  const [expandedAssetId, setExpandedAssetId] = useState<string | null>(null)

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
          <div className="section-bar-title">{t('markets_table.markets_title')}</div>
          <div className="section-bar-value">
            {isLoading || shouldRetry
              ? (metaAssetCount ? metaAssetCount.toLocaleString() : '...')
              : sourceMarkets.length.toLocaleString()}
          </div>
        </div>
        <div className="flex items-center gap-3">
          <input
            type="text"
            placeholder={t('markets_table.search_placeholder')}
            aria-label="Search markets"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="px-3 py-1.5 rounded text-caption bg-white/10 border border-white/20 text-white placeholder:text-white/40 outline-none focus:border-white/50 w-[120px] md:w-[180px]"
          />
        </div>
      </div>

      {/* Table */}
      <div role="table" aria-label={t('markets_table.markets_title')} className="bg-white border border-t-0 border-border-light overflow-x-auto">
        {/* Column headers — mobile: name + bet only; desktop: full 5-col */}
        <div role="row" className="grid grid-cols-[1fr_100px] md:grid-cols-[1fr_80px_100px_80px_100px] items-center px-3 md:px-4 py-2.5 border-b-[3px] border-black text-micro font-bold uppercase tracking-[0.08em] text-text-muted">
          <div role="columnheader">{t('markets_table.name')}</div>
          <div role="columnheader" className="hidden md:block text-center">{t('markets_table.type')}</div>
          <div role="columnheader" className="hidden md:block text-right">{valueLabel}{unit ? ` (${unit})` : ''}</div>
          <div role="columnheader" className="hidden md:block text-right">{t('markets_table.one_day')}</div>
          <div role="columnheader" className="text-center">{t('markets_table.bet')}</div>
        </div>

        {/* Loading state — logo, name, ring. The table waits. */}
        {(isLoading || shouldRetry) && (
          <div className="py-12">
            <GeneralLoader height={240} />
          </div>
        )}

        {/* Empty state — only when meta also confirms no markets */}
        {!isLoading && !shouldRetry && filteredMarkets.length === 0 && (
          <div className="px-4 py-8 text-center text-caption text-text-muted">
            {search ? t('markets_table.no_match') : t('markets_table.no_markets')}
          </div>
        )}

        {/* Market rows — tall viewport, content-visibility for offscreen perf */}
        <div className="max-h-[calc(100vh-280px)] overflow-y-auto">
          {visibleMarkets.map((market, idx) => {
            const change1d = formatChangePct(market.changePct)
            const vol = formatVolume(market.volume24h)
            const betState = getBetState(market.assetId)
            const isExpanded = expandedAssetId === market.assetId
            const resInfo = resolutionMap.get(market.assetId)

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
                  role="row"
                  tabIndex={0}
                  className={`grid grid-cols-[1fr_100px] md:grid-cols-[1fr_80px_100px_80px_100px] items-center px-3 md:px-4 py-2.5 border-b border-border-light text-caption cursor-pointer ${
                    isExpanded ? 'bg-surface/50 border-b-0' : ''
                  }`}
                  onClick={() => handleRowClick(market.assetId)}
                  onKeyDown={(e: React.KeyboardEvent) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault()
                      handleRowClick(market.assetId)
                    }
                  }}
                >
                  {/* Name + mobile inline value/change */}
                  <div role="cell" className="min-w-0 flex items-center gap-2">
                    <AssetIcon
                      sourceId={sourceId}
                      assetId={market.assetId}
                      prefixes={sourceEntry?.prefixes}
                      imageUrl={market.imageUrl}
                      isExpanded={isExpanded}
                    />
                    <div className="min-w-0 overflow-hidden">
                      <div className="font-semibold text-black truncate" title={market.name || market.symbol}>
                        {truncateMiddle(market.name || market.symbol, 28)}
                      </div>
                      <div className="text-micro font-mono text-text-muted mt-0.5 truncate">
                        {truncateMiddle(market.symbol, 20)}{vol ? ` · Vol ${vol}` : ''}
                      </div>
                      {/* Mobile: value + change inline */}
                      <div className="flex items-center gap-2 mt-0.5 md:hidden">
                        <span className="font-mono tabular-nums text-black font-semibold text-micro">
                          {formatPrice(market.value, isPriceSource)}
                        </span>
                        <span className={`font-mono tabular-nums font-semibold text-micro ${change1d.color}`}>
                          {change1d.text}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Resolution type — desktop only */}
                  <div role="cell" className="hidden md:block text-center">
                    {resolutionBadge(
                      resInfo?.resType ?? (() => {
                        const pct = parseFloat(market.changePct ?? '0')
                        const abs = Math.abs(pct)
                        if (abs < 0.2) return pct < 0 ? 'DOWN_0' : 'UP_0'
                        return pct < 0 ? 'DOWN_X' : 'UP_X'
                      })(),
                      resInfo?.thresholdBps
                    )}
                  </div>

                  {/* Value — desktop only */}
                  <div role="cell" className="hidden md:block text-right font-mono tabular-nums text-black font-semibold" style={momentumStyle}>
                    {formatPrice(market.value, isPriceSource)}
                  </div>

                  {/* 1d change — desktop only */}
                  <div role="cell" className={`hidden md:block text-right font-mono tabular-nums font-semibold ${change1d.color}`}>
                    {change1d.text}
                  </div>

                  {/* Bet UP/DN */}
                  <div role="cell" className="flex items-center justify-center gap-1.5">
                    <SpringPress><button
                      onClick={(e) => { e.stopPropagation(); handleBet(market.assetId, 'up') }}
                      className={`px-2.5 py-1 rounded text-micro font-bold uppercase transition-colors ${
                        betState === 'up'
                          ? 'bg-green-600 text-white shadow-sm'
                          : 'bg-green-50 text-green-700 hover:bg-green-100 border border-green-200'
                      }`}
                    >
                      {t('common_labels.up')}
                    </button></SpringPress>
                    <SpringPress><button
                      onClick={(e) => { e.stopPropagation(); handleBet(market.assetId, 'down') }}
                      className={`px-2.5 py-1 rounded text-micro font-bold uppercase transition-colors ${
                        betState === 'down'
                          ? 'bg-red-600 text-white shadow-sm'
                          : 'bg-red-50 text-red-700 hover:bg-red-100 border border-red-200'
                      }`}
                    >
                      {t('common_labels.dn')}
                    </button></SpringPress>
                  </div>
                </SpringRow>

                {/* Expanded history chart */}
                <SpringExpand isOpen={isExpanded}>
                  <div className="border-b border-border-light">
                    <AssetHistory dataNodeSourceId={sourceId} assetId={market.assetId} />
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
