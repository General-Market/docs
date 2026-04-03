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

function MarketIcon({ sourceId, assetId, prefixes, imageUrl }: {
  sourceId: string; assetId: string; prefixes?: string[]; imageUrl?: string | null
}) {
  const [err, setErr] = useState(false)
  const src = imageUrl || getAssetImageUrl(sourceId, assetId, prefixes ?? [])
  const lineStyle = getLineStyle(sourceId, assetId, prefixes)

  if (src && !err) {
    return (
      <img
        src={src} alt=""
        className="w-[22px] h-[22px] rounded-full object-cover shrink-0"
        loading="lazy" onError={() => setErr(true)}
      />
    )
  }
  if (lineStyle) {
    return (
      <span
        className="shrink-0 inline-flex items-center justify-center rounded-full font-black text-[7px] leading-none"
        style={{ background: lineStyle.bg, color: lineStyle.fg, width: 22, height: 22 }}
      >
        {lineStyle.label.slice(0, 3)}
      </span>
    )
  }
  return <span className="w-[22px] h-[22px] rounded-full bg-white/10 shrink-0" />
}

interface RatiosResponse {
  batchId: number
  markets: MarketRatio[]
}

/** Convert implied probability (0-100) to decimal odds (min 1.01) */
function toOdds(pct: number): string {
  if (pct <= 0) return '99.00'
  if (pct >= 100) return '1.01'
  return (100 / pct).toFixed(2)
}

/** Derive implied Up/Down % from 24h change when oracle ratios unavailable */
function impliedRates(changePct: string | null): { upPct: number; downPct: number } {
  const pct = parseFloat(changePct ?? '0')
  if (isNaN(pct) || Math.abs(pct) < 0.01) return { upPct: 50, downPct: 50 }
  const strength = Math.min(Math.abs(pct) / 10, 0.4)
  if (pct > 0) {
    const up = 50 + strength * 100
    return { upPct: Math.round(up), downPct: Math.round(100 - up) }
  }
  const down = 50 + strength * 100
  return { upPct: Math.round(100 - down), downPct: Math.round(down) }
}

export function SubmarketsGrid({ sourceId }: SubmarketsGridProps) {
  const [search, setSearch] = useState('')
  const { sources } = useSourceRegistry()
  const sourceEntry = findSource(sources, sourceId)

  const { data, isLoading } = useSourceSnapshot(sourceId)
  const markets: SnapshotPrice[] = data?.prices ?? []

  // Try real parimutuel ratios from last settled batch
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

  const ratioMap = useMemo(() => {
    const map = new Map<string, MarketRatio>()
    if (ratiosData?.markets) {
      for (const r of ratiosData.markets) {
        // Skip cancelled/flat markets with no real stakes — their 50/50 ratios are meaningless
        if (r.outcome === 'Cancelled' || r.outcome === 'Flat' || (r.upStake === '0' && r.downStake === '0')) continue
        map.set(r.assetId, r)
      }
    }
    return map
  }, [ratiosData])

  const filtered = useMemo(() => {
    if (!search.trim()) return markets
    const q = search.toLowerCase()
    return markets.filter(m =>
      (m.name || '').toLowerCase().includes(q) ||
      m.symbol.toLowerCase().includes(q),
    )
  }, [markets, search])

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
            <span className="text-[11px] font-normal text-white/30 ml-2">
              {markets.length.toLocaleString()}
            </span>
          </div>
        </div>
        <input
          type="text"
          placeholder="Search..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="px-2.5 py-1 rounded text-[11px] bg-white/[0.04] border border-white/10 text-white placeholder:text-white/20 outline-none focus:border-white/20 w-[140px]"
        />
      </div>

      {/* Grid */}
      <div className="bg-[#161b22] px-3 py-3">
        {isLoading ? (
          <div className="py-12 text-center text-[12px] text-white/20 animate-pulse">
            Loading markets...
          </div>
        ) : filtered.length === 0 ? (
          <div className="py-12 text-center text-[12px] text-white/20">
            {search ? `No markets matching "${search}"` : 'No markets yet for this source'}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-1.5">
            {filtered.map((market) => {
              const name = market.name || market.symbol
              const truncated = name.length > 20 ? name.slice(0, 18) + '\u2026' : name
              const realRatio = ratioMap.get(market.assetId)
              const rates = realRatio
                ? { upPct: realRatio.upPct, downPct: realRatio.downPct }
                : impliedRates(market.changePct)
              const upOdds = toOdds(rates.upPct)
              const downOdds = toOdds(rates.downPct)

              return (
                <div
                  key={market.assetId}
                  className="flex items-center gap-2 px-2 py-[5px] rounded bg-white/[0.02] hover:bg-white/[0.04] transition-colors"
                >
                  <MarketIcon
                    sourceId={sourceId}
                    assetId={market.assetId}
                    prefixes={sourceEntry?.prefixes}
                    imageUrl={market.imageUrl}
                  />
                  <span className="text-[11px] text-white/60 truncate flex-1 font-medium leading-tight">
                    {truncated}
                  </span>
                  {/* GG.bet-style decimal odds buttons */}
                  <div className="flex gap-1 shrink-0">
                    <button className="px-2 py-[3px] rounded bg-emerald-500/15 border border-emerald-500/20 hover:bg-emerald-500/25 transition-colors group">
                      <div className="text-[8px] font-semibold text-emerald-400/50 group-hover:text-emerald-400/70 leading-none">UP</div>
                      <div className="text-[11px] font-bold font-mono tabular-nums text-emerald-400 leading-tight">
                        {upOdds}
                      </div>
                    </button>
                    <button className="px-2 py-[3px] rounded bg-red-500/15 border border-red-500/20 hover:bg-red-500/25 transition-colors group">
                      <div className="text-[8px] font-semibold text-red-400/50 group-hover:text-red-400/70 leading-none">DOWN</div>
                      <div className="text-[11px] font-bold font-mono tabular-nums text-red-400 leading-tight">
                        {downOdds}
                      </div>
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
