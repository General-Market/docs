'use client'

import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link } from '@/i18n/routing'
import { useSourceSnapshot } from '@/hooks/vision/useMarketSnapshot'
import { useSourceRegistry, findSource } from '@/hooks/vision/useSourceRegistry'
import { getAssetImageUrl } from '@/lib/vision/asset-images'
import { toBatchSourceId } from '@/lib/vision/source-ids'
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

  // Settlements are keyed by the batch source id on the oracle. For curated
  // subsources that is the subsource key, not the parent firehose id used for
  // price history (dataNodeSourceId).
  const settlementSourceId = toBatchSourceId(sourceId)

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
              value={value}
              isPrice={isPrice}
              valueUnit={valueUnit}
            />
          )}
        </div>
      </section>

      <AssetActivityCard
        sourceId={sourceId}
        dataNodeSourceId={dataNodeSourceId}
        settlementSourceId={settlementSourceId}
        assetId={assetId}
        isPrice={isPrice}
        valueUnit={valueUnit}
        thresholdBps={rule?.thresholdBps ?? null}
        resolutionType={rule?.resolutionType ?? null}
      />
    </div>
  )
}

// The threshold this market settles against, stated as a target rather than a
// band. The percentage is the round's rule; the absolute figure is projected
// from the current value (the real target reseeds off each round's open, hence
// "from … now"). Direction colours the whole pill green for UP, red for DOWN.
function LatestBandPill({
  thresholdBps,
  resolutionType,
  value,
  isPrice,
  valueUnit,
}: {
  thresholdBps: number
  resolutionType: string
  value: number | null
  isPrice: boolean
  valueUnit: string
}) {
  const binary = thresholdBps === 0 || resolutionType.endsWith('_0')
  const up = !resolutionType.startsWith('down')
  const pctLabel = thresholdBps > 0 ? formatPct(thresholdBps) : null
  const accent = up ? 'rgb(40,205,65)' : 'rgb(255,59,48)'
  const accentSoft = up ? 'rgba(40,205,65,0.12)' : 'rgba(255,59,48,0.12)'

  const fmt = (v: number) =>
    `${isPrice ? '$' : ''}${formatValue(v, isPrice, valueUnit)}${!isPrice && valueUnit ? ` ${valueUnit}` : ''}`

  const target =
    !binary && value != null && isFinite(value)
      ? value * (1 + (up ? 1 : -1) * (thresholdBps / 10000))
      : null

  return (
    <div
      className="mt-3 inline-flex flex-wrap items-center"
      style={{
        gap: 10,
        padding: '8px 12px',
        borderRadius: 'var(--apple-r-sm)',
        background: 'var(--apple-surface)',
        border: '1px solid var(--apple-line)',
        fontFamily: 'var(--apple-font-text)',
        fontSize: 14,
        color: 'var(--apple-text)',
        fontVariantNumeric: 'tabular-nums',
      }}
    >
      <span
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 5,
          padding: '3px 9px',
          borderRadius: 980,
          background: accentSoft,
          color: accent,
          fontSize: 11,
          fontWeight: 700,
          letterSpacing: 'var(--apple-track-loose)',
        }}
      >
        <span aria-hidden style={{ fontSize: 9 }}>{up ? '▲' : '▼'}</span>
        {binary ? 'ANY MOVE' : up ? 'UP' : 'DOWN'}
      </span>

      {binary ? (
        <span style={{ fontWeight: 500 }}>
          any move {up ? 'up' : 'down'} wins this round
        </span>
      ) : (
        <span style={{ fontWeight: 500 }}>
          must {up ? 'reach' : 'fall to'}{' '}
          <strong style={{ fontWeight: 700 }}>
            {target != null ? fmt(target) : `${up ? '+' : '−'}${pctLabel}`}
          </strong>
          {target != null && pctLabel && (
            <span style={{ marginLeft: 6, color: accent, fontWeight: 600 }}>
              ({up ? '+' : '−'}
              {pctLabel})
            </span>
          )}{' '}
          to win
        </span>
      )}

      <span style={{ color: 'var(--apple-text-secondary)', fontSize: 12 }}>
        {target != null ? `from ${fmt(value!)} now · ` : ''}reseeds each round
      </span>
    </div>
  )
}
