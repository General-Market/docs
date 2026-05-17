'use client'

import { useState, useMemo } from 'react'
import { Link } from '@/i18n/routing'
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
          <span
            className="absolute inset-0 rounded-full"
            style={{ background: 'var(--apple-surface)' }}
          />
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
  // No icon source available — render nothing rather than a perpetual shimmer.
  return null
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
    <div
      className="border overflow-hidden"
      style={{
        background: 'var(--apple-panel)',
        borderColor: 'var(--apple-line)',
        borderRadius: 'var(--apple-r-card)',
      }}
    >
      {/* Header */}
      <div
        className="flex items-center justify-between flex-wrap gap-3 px-5 sm:px-6 py-4"
        style={{ borderBottom: '1px solid var(--apple-line)' }}
      >
        <div className="flex items-baseline gap-3">
          <span
            style={{
              fontFamily: 'var(--apple-font-text)',
              fontSize: 11,
              fontWeight: 600,
              letterSpacing: 'var(--apple-track-loose)',
              color: 'var(--apple-text-secondary)',
              textTransform: 'uppercase',
            }}
          >
            Markets
          </span>
          <span
            style={{
              fontFamily: 'var(--apple-font-display)',
              fontSize: 17,
              fontWeight: 600,
              letterSpacing: 'var(--apple-track-tight)',
              color: 'var(--apple-text)',
            }}
          >
            {sourceEntry?.name ?? sourceId}
          </span>
          {markets.length > 0 && (
            <span
              style={{
                fontFamily: 'var(--apple-font-text)',
                fontSize: 12,
                color: 'var(--apple-text-tertiary)',
                fontVariantNumeric: 'tabular-nums',
              }}
            >
              {markets.length.toLocaleString()}
            </span>
          )}
        </div>
        <input
          type="text"
          placeholder="Search..."
          value={search}
          onChange={e => { setSearch(e.target.value); setVisibleCount(PAGE_SIZE) }}
          aria-label="Search submarkets"
          className="outline-none transition-colors"
          style={{
            padding: '6px 10px',
            borderRadius: 'var(--apple-r-sm)',
            border: '1px solid var(--apple-line)',
            background: 'var(--apple-surface)',
            color: 'var(--apple-text)',
            fontFamily: 'var(--apple-font-text)',
            fontSize: 13,
            letterSpacing: 'var(--apple-track-tight)',
            width: 180,
          }}
        />
      </div>

      {/* Grid */}
      <div className="px-3 sm:px-4 py-4">
        {isLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-2.5" aria-hidden="true">
            {Array.from({ length: 12 }).map((_, i) => (
              <div
                key={i}
                className="flex items-center gap-2.5 px-3 py-2.5 rounded-[var(--apple-r-sm)]"
                style={{
                  background: 'var(--apple-surface)',
                  border: '1px solid var(--apple-line)',
                  animationDelay: `${i * 40}ms`,
                }}
              >
                <span className="skeleton w-[22px] h-[22px] rounded-full shrink-0" />
                <span className="skeleton flex-1 h-[11px] rounded" />
                <div className="flex gap-1 shrink-0">
                  <span className="skeleton w-[42px] h-[28px] rounded" />
                  <span className="skeleton w-[42px] h-[28px] rounded" />
                </div>
              </div>
            ))}
          </div>
        ) : isError ? (
          <div
            className="py-12 text-center"
            style={{
              fontFamily: 'var(--apple-font-text)',
              fontSize: 13,
              color: 'rgb(255,59,48)',
            }}
          >
            Failed to load markets. Retrying\u2026
          </div>
        ) : filtered.length === 0 ? (
          <div className="py-16 text-center">
            {search ? (
              <div
                style={{
                  fontFamily: 'var(--apple-font-text)',
                  fontSize: 13,
                  color: 'var(--apple-text-tertiary)',
                }}
              >
                No markets matching &ldquo;{search}&rdquo;
              </div>
            ) : isFetching ? (
              <div
                className="animate-pulse"
                style={{
                  fontFamily: 'var(--apple-font-text)',
                  fontSize: 13,
                  color: 'var(--apple-text-tertiary)',
                }}
              >
                Loading markets\u2026
              </div>
            ) : (
              <div className="flex flex-col items-center gap-3">
                <div
                  style={{
                    fontFamily: 'var(--apple-font-display)',
                    fontSize: 15,
                    fontWeight: 600,
                    color: 'var(--apple-text)',
                  }}
                >
                  No markets yet
                </div>
                <div
                  style={{
                    fontFamily: 'var(--apple-font-text)',
                    fontSize: 13,
                    color: 'var(--apple-text-secondary)',
                    maxWidth: 280,
                    lineHeight: 1.4,
                  }}
                >
                  Markets appear when a new round opens. Check back shortly.
                </div>
              </div>
            )}
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-2.5">
              {visible.map((market) => {
                const name = market.name || market.symbol
                const truncated = name.length > 20 ? name.slice(0, 18) + '\u2026' : name
                const realRatio = ratioMap.get(market.assetId)
                const rates = realRatio
                  ? { upPct: realRatio.upPct, downPct: realRatio.downPct }
                  : impliedRates(market.changePct)
                const upOdds = toOdds(rates.upPct)
                const downOdds = toOdds(rates.downPct)
                const href = `/source/${sourceId}/market/${encodeURIComponent(market.assetId)}`

                return (
                  <Link
                    key={market.assetId}
                    href={href}
                    aria-label={`Open ${name} history`}
                    className="market-row flex items-center gap-2.5 px-3 py-2.5 no-underline"
                    style={{
                      borderRadius: 'var(--apple-r-sm)',
                      background: 'var(--apple-surface)',
                      border: '1px solid var(--apple-line)',
                      color: 'inherit',
                      transition:
                        'background 200ms var(--apple-ease-default), border-color 200ms var(--apple-ease-default)',
                    }}
                  >
                    <MarketIcon
                      sourceId={sourceId}
                      assetId={market.assetId}
                      prefixes={sourceEntry?.prefixes}
                      imageUrl={market.imageUrl}
                    />
                    <span
                      className="truncate flex-1"
                      style={{
                        fontFamily: 'var(--apple-font-text)',
                        fontSize: 13,
                        fontWeight: 500,
                        letterSpacing: 'var(--apple-track-tight)',
                        color: 'var(--apple-text)',
                        lineHeight: 1.3,
                      }}
                    >
                      {truncated}
                    </span>
                    <div className="flex gap-1 shrink-0">
                      <span
                        className="px-2 py-[3px] rounded"
                        style={{
                          background: 'rgba(15,143,74,0.10)',
                          border: '1px solid rgba(15,143,74,0.24)',
                        }}
                      >
                        <div
                          style={{
                            fontSize: 8,
                            fontWeight: 700,
                            color: '#0E8F4A',
                            lineHeight: 1,
                            letterSpacing: '0.04em',
                          }}
                        >
                          UP
                        </div>
                        <div
                          style={{
                            fontFamily: 'var(--apple-font-text)',
                            fontSize: 13,
                            fontWeight: 700,
                            color: '#0E8F4A',
                            fontVariantNumeric: 'tabular-nums',
                            lineHeight: 1.2,
                          }}
                        >
                          {upOdds}
                        </div>
                      </span>
                      <span
                        className="px-2 py-[3px] rounded"
                        style={{
                          background: 'rgba(197,40,61,0.10)',
                          border: '1px solid rgba(197,40,61,0.24)',
                        }}
                      >
                        <div
                          style={{
                            fontSize: 8,
                            fontWeight: 700,
                            color: '#C5283D',
                            lineHeight: 1,
                            letterSpacing: '0.04em',
                          }}
                        >
                          DOWN
                        </div>
                        <div
                          style={{
                            fontFamily: 'var(--apple-font-text)',
                            fontSize: 13,
                            fontWeight: 700,
                            color: '#C5283D',
                            fontVariantNumeric: 'tabular-nums',
                            lineHeight: 1.2,
                          }}
                        >
                          {downOdds}
                        </div>
                      </span>
                    </div>
                  </Link>
                )
              })}
            </div>
            {hasMore && (
              <button
                onClick={() => setVisibleCount(v => v + PAGE_SIZE)}
                className="mt-4 w-full py-2.5 transition-colors"
                style={{
                  borderRadius: 'var(--apple-r-sm)',
                  background: 'var(--apple-surface)',
                  border: '1px solid var(--apple-line)',
                  fontFamily: 'var(--apple-font-text)',
                  fontSize: 13,
                  fontWeight: 600,
                  color: 'var(--apple-text-secondary)',
                  cursor: 'pointer',
                }}
              >
                Show more ({(filtered.length - visibleCount).toLocaleString()} remaining)
              </button>
            )}
          </>
        )}
      </div>

      <style jsx>{`
        :global(.market-row:hover) {
          background: var(--apple-panel) !important;
          border-color: rgba(0, 0, 0, 0.16) !important;
        }
      `}</style>
    </div>
  )
}
