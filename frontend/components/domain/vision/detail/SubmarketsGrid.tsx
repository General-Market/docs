'use client'

import { useState, useMemo } from 'react'
import { useSourceSnapshot } from '@/hooks/vision/useMarketSnapshot'
import { useSourceRegistry, findSource } from '@/hooks/vision/useSourceRegistry'
import { useQuery } from '@tanstack/react-query'
import type { SnapshotPrice } from '@/hooks/vision/useMarketSnapshot'
import type { MarketRatio } from '@/hooks/vision/useSettlementSSE'
import { getAssetImageUrl } from '@/lib/vision/asset-images'
import { getLineStyle } from '@/lib/vision/transport-colors'
import '@/lib/vision/line-maps/transit-eu'
import '@/lib/vision/line-maps/db-trains'
import '@/lib/vision/line-maps/sports'
import '@/lib/vision/line-maps/gtfs-flights'
import '@/lib/vision/line-maps/aviation-misc'

interface SubmarketsGridProps {
  sourceId: string
}

type FilterTab = 'all' | 'up' | 'down' | 'flat'

function MarketIcon({ sourceId, assetId, prefixes, imageUrl }: {
  sourceId: string; assetId: string; prefixes?: string[]; imageUrl?: string | null
}) {
  const [err, setErr] = useState(false)
  const src = imageUrl || getAssetImageUrl(sourceId, assetId, prefixes ?? [])
  const lineStyle = getLineStyle(sourceId, assetId, prefixes)

  if (src && !err) {
    return (
      <img
        src={src}
        alt=""
        className="w-[20px] h-[20px] rounded-full object-cover shrink-0"
        loading="lazy"
        onError={() => setErr(true)}
      />
    )
  }
  if (lineStyle) {
    return (
      <span
        className="shrink-0 inline-flex items-center justify-center rounded-full font-black text-[7px] leading-none"
        style={{ background: lineStyle.bg, color: lineStyle.fg, width: 20, height: 20 }}
      >
        {lineStyle.label.slice(0, 3)}
      </span>
    )
  }
  return <span className="w-[20px] h-[20px] rounded-full bg-white/10 shrink-0" />
}

function formatCompact(value: string, isPrice: boolean): string {
  const num = parseFloat(value)
  if (isNaN(num)) return '--'
  const p = isPrice ? '$' : ''
  if (num >= 1e9) return `${p}${(num / 1e9).toFixed(1)}B`
  if (num >= 1e6) return `${p}${(num / 1e6).toFixed(1)}M`
  if (num >= 1e3) return `${p}${(num / 1e3).toFixed(1)}K`
  if (num >= 1) return `${p}${num.toFixed(2)}`
  return `${p}${num.toFixed(4)}`
}

interface RatiosResponse {
  batchId: number
  markets: MarketRatio[]
}

export function SubmarketsGrid({ sourceId }: SubmarketsGridProps) {
  const [filter, setFilter] = useState<FilterTab>('all')
  const [search, setSearch] = useState('')
  const { sources } = useSourceRegistry()
  const sourceEntry = findSource(sources, sourceId)
  const isPrice = sourceEntry?.isPrice ?? true

  const { data, isLoading } = useSourceSnapshot(sourceId)
  const markets: SnapshotPrice[] = data?.prices ?? []

  // Batch config for resolution types
  const { data: batchConfig } = useQuery<{ markets: { assetId: string; resolutionType: string; thresholdBps: number }[] }>({
    queryKey: ['batch-config-source', sourceId],
    queryFn: async () => {
      const res = await fetch(`/api/vision/config/${sourceId}`)
      if (!res.ok) return { markets: [] }
      return res.json()
    },
    enabled: !!sourceId,
    staleTime: 300_000,
  })

  // Fetch last settled batch to get parimutuel ratios
  const { data: historyData } = useQuery<{ batches: { batchId: number; status: string }[] }>({
    queryKey: ['source-history', sourceId, 1],
    queryFn: async () => {
      const res = await fetch(`/api/vision/source/${encodeURIComponent(sourceId)}/history?page=1&per_page=1`)
      if (!res.ok) return { batches: [] }
      return res.json()
    },
    staleTime: 30_000,
  })

  const lastSettledBatchId = useMemo(() => {
    const settled = historyData?.batches?.find(b => b.status === 'settled')
    return settled?.batchId ?? null
  }, [historyData])

  // Fetch ratios for last settled batch
  const { data: ratiosData } = useQuery<RatiosResponse>({
    queryKey: ['vision-batch-ratios', lastSettledBatchId],
    queryFn: async () => {
      const res = await fetch(`/api/vision/batch/${lastSettledBatchId}/ratios`)
      if (!res.ok) return { batchId: 0, markets: [] }
      return res.json()
    },
    enabled: lastSettledBatchId !== null,
    staleTime: 60_000,
  })

  // Map assetId → ratios for quick lookup
  const ratioMap = useMemo(() => {
    const map = new Map<string, MarketRatio>()
    if (ratiosData?.markets) {
      for (const r of ratiosData.markets) {
        map.set(r.assetId, r)
      }
    }
    return map
  }, [ratiosData])

  const resMap = useMemo(() => {
    const map = new Map<string, string>()
    if (batchConfig?.markets) {
      for (const m of batchConfig.markets) {
        if (m.assetId && m.resolutionType) {
          const rt = m.resolutionType.toUpperCase()
          if (rt.startsWith('UP')) map.set(m.assetId, 'up')
          else if (rt.startsWith('DOWN')) map.set(m.assetId, 'down')
          else map.set(m.assetId, 'flat')
        }
      }
    }
    return map
  }, [batchConfig])

  const getDirection = (m: SnapshotPrice): string => {
    const dir = resMap.get(m.assetId)
    if (dir) return dir
    const pct = parseFloat(m.changePct ?? '0')
    if (Math.abs(pct) < 0.3) return 'flat'
    return pct > 0 ? 'up' : 'down'
  }

  const counts = useMemo(() => {
    let up = 0, down = 0, flat = 0
    for (const m of markets) {
      const d = getDirection(m)
      if (d === 'up') up++
      else if (d === 'down') down++
      else flat++
    }
    return { all: markets.length, up, down, flat }
  }, [markets, resMap])

  const filtered = useMemo(() => {
    let list = markets
    if (filter !== 'all') {
      list = list.filter(m => getDirection(m) === filter)
    }
    if (search.trim()) {
      const q = search.toLowerCase()
      list = list.filter(m =>
        (m.name || '').toLowerCase().includes(q) ||
        m.symbol.toLowerCase().includes(q),
      )
    }
    return list
  }, [markets, filter, search, resMap])

  const tabs: [FilterTab, string][] = [
    ['all', `All (${counts.all})`],
    ['up', `Up (${counts.up})`],
    ['down', `Dn (${counts.down})`],
    ['flat', `Flat (${counts.flat})`],
  ]

  return (
    <div>
      {/* Header */}
      <div className="bg-[#0d1117] px-5 py-3 flex items-center justify-between flex-wrap gap-2">
        <div>
          <div className="text-[10px] font-semibold uppercase tracking-[0.1em] text-white/35">
            Submarkets
          </div>
          <div className="text-[15px] font-bold text-white">
            {sourceEntry?.name ?? sourceId}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <input
            type="text"
            placeholder="Search..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="px-2.5 py-1 rounded text-[11px] bg-white/[0.04] border border-white/10 text-white placeholder:text-white/20 outline-none focus:border-white/20 w-[120px]"
          />
          <div className="flex gap-0.5">
            {tabs.map(([key, label]) => (
              <button
                key={key}
                onClick={() => setFilter(key)}
                className={`px-2.5 py-1 rounded text-[11px] font-semibold transition-colors ${
                  filter === key
                    ? 'bg-white/10 text-white'
                    : 'text-white/30 hover:text-white/50'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Grid */}
      <div className="bg-[#161b22] px-3 py-3">
        {isLoading ? (
          <div className="py-12 text-center text-[12px] text-white/20 animate-pulse">
            Loading markets...
          </div>
        ) : filtered.length === 0 ? (
          <div className="py-12 text-center text-[12px] text-white/20">
            {search ? 'No matches' : 'No markets available'}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-1">
            {filtered.map((market) => {
              const pct = parseFloat(market.changePct ?? '0')
              const valColor = Math.abs(pct) < 0.1
                ? 'text-white/25'
                : pct > 0
                  ? 'text-emerald-400'
                  : 'text-red-400'
              const name = market.name || market.symbol
              const truncated = name.length > 18 ? name.slice(0, 16) + '\u2026' : name
              const ratio = ratioMap.get(market.assetId)

              return (
                <div
                  key={market.assetId}
                  className="flex items-center gap-1.5 px-2.5 py-[7px] rounded bg-white/[0.02] hover:bg-white/[0.05] transition-colors"
                >
                  <MarketIcon
                    sourceId={sourceId}
                    assetId={market.assetId}
                    prefixes={sourceEntry?.prefixes}
                    imageUrl={market.imageUrl}
                  />
                  <span className="text-[11px] text-white/65 truncate flex-1 font-medium leading-tight">
                    {truncated}
                  </span>
                  {/* Parimutuel rates from last settled round */}
                  {ratio ? (
                    <span className="flex items-center gap-1 shrink-0">
                      <span className="text-[9px] font-mono tabular-nums text-emerald-400/70">
                        {ratio.upPct.toFixed(0)}%
                      </span>
                      <span className="text-[8px] text-white/15">/</span>
                      <span className="text-[9px] font-mono tabular-nums text-red-400/70">
                        {ratio.downPct.toFixed(0)}%
                      </span>
                    </span>
                  ) : (
                    <span className={`text-[10px] font-mono tabular-nums shrink-0 ${valColor}`}>
                      ({formatCompact(market.value, isPrice)})
                    </span>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
