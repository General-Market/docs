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

const PAGE_SIZE = 120

interface SubmarketsGridProps {
  sourceId: string
}

function MarketIcon({ sourceId, assetId, prefixes, imageUrl }: {
  sourceId: string; assetId: string; prefixes?: string[]; imageUrl?: string | null
}) {
  const [err, setErr] = useState(false)
  const [loaded, setLoaded] = useState(false)
  const src = imageUrl || getAssetImageUrl(sourceId, assetId, prefixes ?? [])
  const lineStyle = getLineStyle(sourceId, assetId, prefixes)

  if (src && !err) {
    return (
      <span className="relative inline-block w-[22px] h-[22px] shrink-0">
        {!loaded && (
          <span className="absolute inset-0 rounded-full bg-white/[0.08] animate-pulse" />
        )}
        <img
          src={src} alt=""
          className={`absolute inset-0 w-[22px] h-[22px] rounded-full object-cover transition-opacity duration-200 ${loaded ? 'opacity-100' : 'opacity-0'}`}
          loading="lazy"
          onLoad={() => setLoaded(true)}
          onError={() => setErr(true)}
        />
      </span>
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
  // No src and no badge — keep the shimmer so the slot reads as "still resolving"
  return <span className="w-[22px] h-[22px] rounded-full bg-white/[0.08] animate-pulse shrink-0" />
}

interface RatiosResponse {
  batchId: number
  markets: MarketRatio[]
}

function toOdds(pct: number): string {
  if (pct <= 0) return '99.00'
  if (pct >= 100) return '1.01'
  return (100 / pct).toFixed(2)
}

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
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE)
  const { sources } = useSourceRegistry()
  const sourceEntry = findSource(sources, sourceId)

  const { data, isLoading, isError, isFetching } = useSourceSnapshot(sourceId)
  const markets: SnapshotPrice[] = data?.prices ?? []

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

  const visible = filtered.slice(0, visibleCount)
  const hasMore = filtered.length > visibleCount

  return (
    <div>
      {/* Header */}
      <div className="bg-terminal-dark px-5 py-3 flex items-center justify-between flex-wrap gap-2">
        <div>
          <div className="text-micro font-semibold uppercase tracking-[0.1em] text-text-inverse-muted/50">
            Markets
          </div>
          <div className="text-[15px] font-bold text-text-inverse">
            {sourceEntry?.name ?? sourceId}
            {markets.length > 0 && (
              <span className="text-label font-normal text-text-inverse-muted/45 ml-2">
                {markets.length.toLocaleString()}
              </span>
            )}
          </div>
        </div>
        <input
          type="text"
          placeholder="Search..."
          value={search}
          onChange={e => { setSearch(e.target.value); setVisibleCount(PAGE_SIZE) }}
          aria-label="Search submarkets"
          className="px-2.5 py-1 rounded text-label bg-white/[0.05] border border-white/10 text-text-inverse placeholder:text-text-inverse-muted/30 outline-none focus:border-white/25 focus:ring-1 focus:ring-white/15 w-[140px] transition-colors"
        />
      </div>

      {/* Grid */}
      <div className="bg-terminal px-4 py-4">
        {isLoading ? (
          <div className="py-12 text-center text-caption text-text-inverse-muted/30 animate-pulse">
            Loading markets...
          </div>
        ) : isError ? (
          <div className="py-12 text-center text-caption text-color-down/60">
            Failed to load markets. Retrying...
          </div>
        ) : filtered.length === 0 ? (
          <div className="py-16 text-center">
            {search ? (
              <div className="text-caption text-text-inverse-muted/30">
                No markets matching &ldquo;{search}&rdquo;
              </div>
            ) : isFetching ? (
              <div className="text-caption text-text-inverse-muted/30 animate-pulse">
                Loading markets...
              </div>
            ) : (
              <div className="flex flex-col items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-white/[0.04] border border-white/[0.08] flex items-center justify-center animate-pulse">
                  <svg className="w-5 h-5 text-text-inverse-muted/20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 3v11.25A2.25 2.25 0 006 16.5h2.25M3.75 3h-1.5m1.5 0h16.5m0 0h1.5m-1.5 0v11.25A2.25 2.25 0 0118 16.5h-2.25m-7.5 0h7.5m-7.5 0l-1 3m8.5-3l1 3m0 0l.5 1.5m-.5-1.5h-9.5m0 0l-.5 1.5" />
                  </svg>
                </div>
                <div className="text-caption text-text-inverse-muted/35 font-medium">
                  No markets yet
                </div>
                <div className="text-micro text-text-inverse-muted/25 max-w-[240px] leading-relaxed">
                  Markets appear when a new round opens. Check back shortly.
                </div>
              </div>
            )}
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 xl:grid-cols-3 gap-2.5">
              {visible.map((market) => {
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
                    className="flex items-center gap-2.5 px-3 py-2 rounded bg-white/[0.03] hover:bg-white/[0.07] transition-colors"
                  >
                    <MarketIcon
                      sourceId={sourceId}
                      assetId={market.assetId}
                      prefixes={sourceEntry?.prefixes}
                      imageUrl={market.imageUrl}
                    />
                    <span className="text-label text-text-inverse-muted truncate flex-1 font-medium leading-tight">
                      {truncated}
                    </span>
                    <div className="flex gap-1 shrink-0">
                      <span className="px-2 py-[3px] rounded bg-color-up/15 border border-color-up/20">
                        <div className="text-[8px] font-semibold text-color-up/50 leading-none">UP</div>
                        <div className="text-label font-bold font-mono tabular-nums text-color-up leading-tight">
                          {upOdds}
                        </div>
                      </span>
                      <span className="px-2 py-[3px] rounded bg-color-down/15 border border-color-down/20">
                        <div className="text-[8px] font-semibold text-color-down/50 leading-none">DOWN</div>
                        <div className="text-label font-bold font-mono tabular-nums text-color-down leading-tight">
                          {downOdds}
                        </div>
                      </span>
                    </div>
                  </div>
                )
              })}
            </div>
            {hasMore && (
              <button
                onClick={() => setVisibleCount(v => v + PAGE_SIZE)}
                className="mt-4 w-full py-2 text-caption font-semibold text-text-inverse-muted/40 hover:text-text-inverse-muted/60 bg-white/[0.03] hover:bg-white/[0.06] rounded transition-colors"
              >
                Show more ({(filtered.length - visibleCount).toLocaleString()} remaining)
              </button>
            )}
          </>
        )}
      </div>
    </div>
  )
}
