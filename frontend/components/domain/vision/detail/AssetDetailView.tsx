'use client'

import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link } from '@/i18n/routing'
import { useSourceSnapshot } from '@/hooks/vision/useMarketSnapshot'
import { useSourceRegistry, findSource } from '@/hooks/vision/useSourceRegistry'
import { getAssetImageUrl } from '@/lib/vision/asset-images'
import { AssetActivityCard } from './AssetActivityCard'

interface AssetDetailViewProps {
  sourceId: string
  dataNodeSourceId: string
  assetId: string
  sourceName: string
}

interface SourceBatchConfig {
  tickDurationSecs?: number
  markets?: { assetId: string; resolutionType?: string; thresholdBps?: number }[]
}

function formatPct(bps: number): string {
  const pct = bps / 100
  if (pct >= 10) return `${pct.toFixed(0)}%`
  if (pct >= 1) return `${pct.toFixed(1).replace(/\.0$/, '')}%`
  return `${pct.toFixed(2).replace(/0+$/, '').replace(/\.$/, '')}%`
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

  const { data: batchConfig } = useQuery<SourceBatchConfig>({
    queryKey: ['source-batch-config', sourceId],
    queryFn: async () => {
      const res = await fetch(`/api/vision/config/${encodeURIComponent(sourceId)}`)
      if (!res.ok) return { markets: [] }
      return res.json()
    },
    staleTime: 300_000,
    retry: 1,
  })

  const rule = useMemo(() => {
    const entry = batchConfig?.markets?.find(m => m.assetId === assetId)
    if (!entry) return null
    return {
      resolutionType: (entry.resolutionType ?? '').toLowerCase(),
      thresholdBps: entry.thresholdBps ?? 0,
    }
  }, [batchConfig, assetId])

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
          {rule && (
            <LatestBandPill
              thresholdBps={rule.thresholdBps}
              resolutionType={rule.resolutionType}
            />
          )}
        </div>
      </section>

      <AssetActivityCard
        sourceId={sourceId}
        dataNodeSourceId={dataNodeSourceId}
        assetId={assetId}
        isPrice={isPrice}
        valueUnit={valueUnit}
        thresholdBps={rule?.thresholdBps ?? null}
        resolutionType={rule?.resolutionType ?? null}
      />
    </div>
  )
}

function LatestBandPill({
  thresholdBps,
  resolutionType,
}: {
  thresholdBps: number
  resolutionType: string
}) {
  const pctLabel = thresholdBps > 0 ? formatPct(thresholdBps) : null
  const binary = thresholdBps === 0 || resolutionType.endsWith('_0')

  return (
    <div
      className="mt-3 inline-flex items-center"
      style={{
        gap: 10,
        padding: '6px 12px',
        borderRadius: 'var(--apple-r-sm)',
        background: 'rgba(0,0,0,0.05)',
        border: '1px solid rgba(0,0,0,0.06)',
        fontFamily: 'var(--apple-font-text)',
        fontSize: 13,
        letterSpacing: 0,
        color: 'var(--apple-text)',
        fontVariantNumeric: 'tabular-nums',
      }}
    >
      <span
        style={{
          fontSize: 10,
          fontWeight: 700,
          letterSpacing: 'var(--apple-track-loose)',
          textTransform: 'uppercase',
          color: 'var(--apple-text-secondary)',
        }}
      >
        Latest batch
      </span>
      <span style={{ fontWeight: 600 }}>
        {binary ? 'any move wins' : `±${pctLabel} band`}
      </span>
      <span style={{ color: 'var(--apple-text-secondary)' }}>· reseeds next tick</span>
    </div>
  )
}
