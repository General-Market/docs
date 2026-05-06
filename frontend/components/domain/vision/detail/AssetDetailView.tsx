'use client'

import { useMemo, useState } from 'react'
import { Link } from '@/i18n/routing'
import { useSourceSnapshot } from '@/hooks/vision/useMarketSnapshot'
import { useSourceRegistry, findSource } from '@/hooks/vision/useSourceRegistry'
import { useAssetSettlements } from '@/hooks/vision/useAssetSettlements'
import { getAssetImageUrl } from '@/lib/vision/asset-images'
import AssetHistory from './AssetHistory'
import { AssetSettlementMatrix } from './AssetSettlementMatrix'

interface AssetDetailViewProps {
  sourceId: string
  dataNodeSourceId: string
  assetId: string
  sourceName: string
}

function formatValue(v: number, isPrice: boolean, unit: string | undefined): string {
  if (!isFinite(v)) return '--'
  if (Math.abs(v) >= 1_000_000_000) return `${(v / 1_000_000_000).toFixed(2)}B`
  if (Math.abs(v) >= 1_000_000) return `${(v / 1_000_000).toFixed(2)}M`
  if (Math.abs(v) >= 1_000) return `${(v / 1_000).toFixed(2)}K`
  if (Math.abs(v) >= 1) return v.toFixed(2)
  if (Math.abs(v) >= 0.01) return v.toFixed(4)
  return v.toFixed(6)
}

function AssetIcon({
  src,
  alt,
}: {
  src: string | null
  alt: string
}) {
  const [broken, setBroken] = useState(false)
  if (!src || broken) return null
  return (
    <img
      src={src}
      alt={alt}
      width={56}
      height={56}
      onError={() => setBroken(true)}
      style={{
        width: 56,
        height: 56,
        borderRadius: 12,
        objectFit: 'cover',
        background: 'var(--apple-surface)',
        flexShrink: 0,
      }}
    />
  )
}

export function AssetDetailView({
  sourceId,
  dataNodeSourceId,
  assetId,
  sourceName,
}: AssetDetailViewProps) {
  const { sources } = useSourceRegistry()
  const sourceEntry = findSource(sources, sourceId)

  const { data } = useSourceSnapshot(dataNodeSourceId)
  const market = useMemo(() => {
    return data?.prices.find(p => p.assetId === assetId) ?? null
  }, [data, assetId])

  const { data: settlements } = useAssetSettlements(dataNodeSourceId, assetId, 60)
  const settlementMarkers = useMemo(
    () =>
      (settlements ?? []).map(s => ({
        at: new Date(s.settledAt).getTime(),
        outcome: s.outcome,
      })),
    [settlements],
  )

  const displayName = market?.name || market?.symbol || assetId.replace(/_/g, ' ')
  const imageUrl =
    market?.imageUrl || getAssetImageUrl(sourceId, assetId, sourceEntry?.prefixes ?? [])

  const isPrice = !!sourceEntry?.isPrice
  const valueUnit = sourceEntry?.valueUnit ?? ''
  const value = market?.value ? parseFloat(market.value) : null
  const changePct = market?.changePct ? parseFloat(market.changePct) : null

  return (
    <div className="flex flex-col gap-6">
      <Link
        href={`/source/${sourceId}/markets`}
        style={{
          fontFamily: 'var(--apple-font-text)',
          fontSize: 'var(--apple-fs-12)',
          letterSpacing: 'var(--apple-track-loose)',
          color: 'var(--apple-text-tertiary)',
          textTransform: 'uppercase',
          textDecoration: 'none',
          fontWeight: 600,
        }}
      >
        ← {sourceName} markets
      </Link>

      <section
        className="flex items-center gap-5 sm:gap-6 border p-5 sm:p-6"
        style={{
          background: 'var(--apple-panel)',
          borderColor: 'var(--apple-line)',
          borderRadius: 'var(--apple-r-card)',
        }}
      >
        <AssetIcon src={imageUrl} alt={displayName} />
        <div className="min-w-0 flex-1">
          <div
            style={{
              fontFamily: 'var(--apple-font-text)',
              fontSize: 11,
              fontWeight: 600,
              letterSpacing: 'var(--apple-track-loose)',
              color: 'var(--apple-text-tertiary)',
              textTransform: 'uppercase',
            }}
          >
            {sourceName}
          </div>
          <h1
            className="mt-1 truncate font-semibold"
            style={{
              fontFamily: 'var(--apple-font-display)',
              fontSize: 28,
              letterSpacing: 'var(--apple-track-tight)',
              lineHeight: 1.1,
              color: 'var(--apple-text)',
              margin: 0,
            }}
          >
            {displayName}
          </h1>
          {value !== null && (
            <div className="mt-3 flex flex-wrap items-baseline gap-3">
              <span
                style={{
                  fontFamily: 'var(--apple-font-display)',
                  fontSize: 22,
                  fontWeight: 600,
                  letterSpacing: 'var(--apple-track-tight)',
                  color: 'var(--apple-text)',
                  fontVariantNumeric: 'tabular-nums',
                }}
              >
                {isPrice ? '$' : ''}
                {formatValue(value, isPrice, valueUnit)}
                {!isPrice && valueUnit ? ` ${valueUnit}` : ''}
              </span>
              {changePct !== null && (
                <span
                  style={{
                    fontFamily: 'var(--apple-font-text)',
                    fontSize: 14,
                    fontWeight: 600,
                    color:
                      changePct >= 0 ? 'rgb(52,199,89)' : 'rgb(255,59,48)',
                    fontVariantNumeric: 'tabular-nums',
                  }}
                >
                  {changePct >= 0 ? '+' : ''}
                  {changePct.toFixed(2)}%
                </span>
              )}
            </div>
          )}
        </div>
      </section>

      <section
        className="border overflow-hidden"
        style={{
          background: 'var(--apple-panel)',
          borderColor: 'var(--apple-line)',
          borderRadius: 'var(--apple-r-card)',
        }}
      >
        <header
          className="flex items-baseline justify-between px-5 sm:px-6 pt-5 pb-3"
        >
          <h2
            style={{
              fontFamily: 'var(--apple-font-display)',
              fontSize: 17,
              fontWeight: 600,
              letterSpacing: 'var(--apple-track-tight)',
              color: 'var(--apple-text)',
              margin: 0,
            }}
          >
            History · 7d
          </h2>
        </header>
        <div className="px-2 pb-2">
          <AssetHistory
            dataNodeSourceId={dataNodeSourceId}
            assetId={assetId}
            settlements={settlementMarkers}
          />
        </div>
      </section>

      <section
        className="border overflow-hidden"
        style={{
          background: 'var(--apple-panel)',
          borderColor: 'var(--apple-line)',
          borderRadius: 'var(--apple-r-card)',
        }}
      >
        <header className="flex items-baseline justify-between px-5 sm:px-6 pt-5 pb-3">
          <h2
            style={{
              fontFamily: 'var(--apple-font-display)',
              fontSize: 17,
              fontWeight: 600,
              letterSpacing: 'var(--apple-track-tight)',
              color: 'var(--apple-text)',
              margin: 0,
            }}
          >
            Positions per round
          </h2>
          <span
            style={{
              fontFamily: 'var(--apple-font-text)',
              fontSize: 11,
              color: 'var(--apple-text-tertiary)',
              letterSpacing: 'var(--apple-track-loose)',
              textTransform: 'uppercase',
            }}
          >
            ▲ up · ▼ down · faded = lost
          </span>
        </header>
        <div className="px-5 sm:px-6 pb-5">
          <AssetSettlementMatrix sourceId={dataNodeSourceId} assetId={assetId} />
        </div>
      </section>
    </div>
  )
}
