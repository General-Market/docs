'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useTranslations } from 'next-intl'
import Image from 'next/image'
import { Link, useRouter } from '@/i18n/routing'
import { useQueryClient } from '@tanstack/react-query'
import type { VisionSource } from '@/lib/vision/sources'
import { toInternalId } from '@/lib/vision/source-ids'
import { getCategoryLabel } from '@/lib/vision/source-categories'
import { SOURCE_BROLLS } from '@/lib/vision/source-brolls'
import type { BitmapEditor } from '@/hooks/vision/useBitmapEditor'
import { useSourceSnapshot } from '@/hooks/vision/useMarketSnapshot'
import { getFundCountForSource } from '@/hooks/vaults/useFundBranding'
import { AnimatedNumber } from '@/components/ui/AnimatedNumber'
import { SpringCard } from '@/components/ui/spring'

interface SourceCardProps {
  source: VisionSource
  bitmapEditor: BitmapEditor
  /** Position in the grid — first 12 get priority loading */
  index?: number
  /** Accurate asset count from admin health (overrides markets.length for display) */
  metaAssetCount?: number
  /** Source status from admin health: healthy, stale, dead, etc. */
  metaStatus?: string
}

/** Live-ticking relative age component (re-renders every 10s) */
function LiveAge({ iso }: { iso?: string }) {
  const [age, setAge] = useState('—')
  useEffect(() => {
    if (!iso) return
    const calc = () => {
      const diff = Date.now() - new Date(iso).getTime()
      if (diff < 0) return 'now'
      const secs = Math.floor(diff / 1000)
      if (secs < 60) return `${secs}s ago`
      const mins = Math.floor(secs / 60)
      if (mins < 60) return `${mins}m ago`
      const hrs = Math.floor(mins / 60)
      if (hrs < 24) return `${hrs}h ago`
      return `${Math.floor(hrs / 24)}d ago`
    }
    setAge(calc())
    const iv = setInterval(() => setAge(calc()), 10_000)
    return () => clearInterval(iv)
  }, [iso])
  return <>{age}</>
}

/** Shorten multi-word value labels to fit the Type column on 1 line */
const SHORT_TYPE_LABELS: Record<string, string> = {
  'Viewer Count': 'Viewers',
  'Delay Minutes': 'Delay',
  'Active Flights': 'Flights',
  'Transaction Count': 'Txns',
  'Probability': 'Odds',
  'Short Volume': 'Short Vol',
  'Avg Salary': 'Salary',
  'Basket Price': 'Basket',
  'Alert Level': 'Alert',
  'Water Level': 'Level',
  'Wave Height': 'Waves',
  'Stage Height': 'Stage',
  'Kp Index': 'Kp',
  'Sale Price': 'Sale',
  'Avg Delay': 'Delay',
  'Wait Time': 'Wait',
  'Avg Wait': 'Wait',
  'Free Spaces': 'Spaces',
  '% Broken': 'Broken',
}

function shortTypeLabel(label: string): string {
  return SHORT_TYPE_LABELS[label] ?? label
}

/** Perceived luminance from a hex color (0–255 scale, ITU-R BT.601) */
function hexLuminance(hex: string): number {
  const h = hex.replace('#', '')
  if (h.length !== 6) return 128
  const r = parseInt(h.slice(0, 2), 16)
  const g = parseInt(h.slice(2, 4), 16)
  const b = parseInt(h.slice(4, 6), 16)
  return r * 0.299 + g * 0.587 + b * 0.114
}

export function SourceCard({ source, bitmapEditor, index = 99, metaAssetCount, metaStatus }: SourceCardProps) {
  const t = useTranslations('vision')
  const router = useRouter()
  const queryClient = useQueryClient()
  const fundCount = getFundCountForSource(source.id)

  // Fetch per-source data on mount — warms React Query cache for detail page navigation.
  // The grid passes metaAssetCount for immediate display; snapshot provides generatedAt.
  const dataNodeId = toInternalId(source.id)
  const { data: sourceSnapshot } = useSourceSnapshot(dataNodeId)

  // Prefetch detail page data on hover — fills the cache before navigation
  const handlePrefetch = useCallback(() => {
    queryClient.prefetchQuery({
      queryKey: ['source-snapshot', dataNodeId],
      queryFn: () => fetch(`/api/vision/snapshot?source=${encodeURIComponent(dataNodeId)}`).then(r => r.json()),
      staleTime: 30_000,
    })
    queryClient.prefetchQuery({
      queryKey: ['batch-config-source', source.id],
      queryFn: () => fetch(`/api/vision/config/${source.id}`).then(r => r.json()),
      staleTime: 300_000,
    })
  }, [queryClient, dataNodeId, source.id])

  const totalMarkets = sourceSnapshot?.prices?.length ?? 0
  const displayMarketCount = metaAssetCount ?? totalMarkets

  // Status from admin health, fall back to meta-based check
  const statusLabel = metaStatus === 'healthy' ? t('source_card.status_live') : metaStatus === 'stale' ? t('source_card.status_stale') : metaStatus === 'dead' ? t('source_card.status_dead') : displayMarketCount > 0 ? t('source_card.status_live') : t('source_card.status_pending')
  const statusColor = metaStatus === 'healthy' || (!metaStatus && displayMarketCount > 0) ? 'bg-color-up' : metaStatus === 'stale' ? 'bg-color-warning' : 'bg-text-muted'
  const statusTextColor = metaStatus === 'healthy' || (!metaStatus && displayMarketCount > 0) ? 'text-color-up' : metaStatus === 'stale' ? 'text-color-warning' : 'text-text-muted'

  // Settlement quality derived from source health status
  const settlementDotColor = metaStatus === 'healthy' || (!metaStatus && displayMarketCount > 0) ? 'bg-color-up' : metaStatus === 'stale' ? 'bg-color-warning' : 'bg-color-down'
  const settlementLabel = metaStatus === 'healthy' || (!metaStatus && displayMarketCount > 0)
    ? t('source_card.settlement_healthy')
    : metaStatus === 'stale'
      ? t('source_card.settlement_delayed')
      : t('source_card.settlement_inactive')

  const metricsRef = useRef<HTMLDivElement>(null)

  // Accent color for the Live dot — use brandBg unless it's too light
  const accentColor = source.brandBg.startsWith('linear') || hexLuminance(source.brandBg) > 200
    ? '#00A36C'
    : source.brandBg
  const isLive = metaStatus === 'healthy' || (!metaStatus && displayMarketCount > 0)

  // Determine brand background style
  const brandStyle: React.CSSProperties = source.brandBg.startsWith('linear-gradient')
    ? { background: source.brandBg }
    : { backgroundColor: source.brandBg }

  // Ambient b-roll (if mapped). Plays muted + looping behind the logo.
  const broll = SOURCE_BROLLS[source.id]

  // Detect light backgrounds — logos need a subtle vignette to stay visible
  const isLightBg = hexLuminance(source.brandBg) > 200

  // Per-source logo size overrides (2x for circular/seal logos)
  const LARGE_LOGOS = new Set(['nwps', 'wildfire', 'parking', 'mta_subway', 'queue_times'])
  const logoSize = source.id === 'pumpfun'
    ? { w: 420, h: 120, maxH: '120px' }
    : LARGE_LOGOS.has(source.id)
      ? { w: 480, h: 120, maxH: '120px' }
      : { w: 360, h: 90, maxH: '90px' }

  // View Transitions API — morph card brand into detail hero
  const handleViewTransition = useCallback((e: React.MouseEvent) => {
    const d = document as any
    if (!d.startViewTransition) return
    e.preventDefault()
    d.startViewTransition(() => {
      router.push(`/source/${source.id}`)
    })
  }, [router, source.id])

  // Never hide a registry source card. Sources appear because they have
  // deployed batches — returning null here created a race condition where
  // cards vanished when the per-source snapshot timed out (totalMarkets=0)
  // and metaAssetCount was 0 or undefined (falsy). The "Pending" status
  // label already communicates zero-data states to the user.

  return (
    <SpringCard className="bg-white border-r border-b border-border-light overflow-hidden">
    <Link
      href={`/source/${source.id}`}
      onClick={handleViewTransition}
      onMouseEnter={handlePrefetch}
      data-testid="source-card"
      className="block group cursor-pointer"
    >
      {/* Brand image area */}
      <div className="relative aspect-video w-full overflow-hidden source-brand-shimmer">
          <div
            className={`absolute inset-0 flex items-center justify-center ${isLightBg ? 'border-b border-border-light' : ''}`}
            style={{ ...brandStyle, viewTransitionName: `source-brand-${source.id}` } as React.CSSProperties}
          >
            {broll && (
              <video
                src={broll}
                autoPlay
                muted
                loop
                playsInline
                preload={index < 12 ? 'auto' : 'metadata'}
                aria-hidden
                className="absolute inset-0 h-full w-full object-cover"
              />
            )}
            {broll && <div className="absolute inset-0 bg-black/35" />}
            <Image
              src={source.logo}
              alt={source.name}
              width={logoSize.w}
              height={logoSize.h}
              priority={index < 12}
              loading={index < 12 ? 'eager' : 'lazy'}
              className="relative max-w-[80%] object-contain"
              style={{ maxHeight: logoSize.maxH }}
            />
            <span className="absolute top-2.5 right-2.5 text-micro font-bold tracking-[0.08em] uppercase px-2 py-0.5 rounded glass-badge text-white/90">
              {getCategoryLabel(source.category).toUpperCase()}
            </span>
          </div>
        </div>

      {/* Card content */}
      <div className="px-3 pt-2.5 pb-0 sm:px-5 sm:pt-4">
        <div className="flex justify-between items-start mb-1">
          <div className="min-w-0 flex-1 mr-2">
            <h3 className="text-subhead font-extrabold text-text-primary tracking-[-0.01em]">{source.name}</h3>
            <p className="text-caption text-text-muted leading-snug mt-0.5 line-clamp-2">{source.description}</p>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            {isLive ? (
              <span className="relative flex h-[6px] w-[6px]">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-60" style={{ backgroundColor: accentColor }} />
                <span className="relative inline-flex rounded-full h-[6px] w-[6px]" style={{ backgroundColor: accentColor }} />
              </span>
            ) : (
              <span className={`w-[6px] h-[6px] rounded-full ${statusColor}`} />
            )}
            <span className={`text-label font-semibold ${isLive ? '' : statusTextColor}`} style={isLive ? { color: accentColor } : undefined}>
              {statusLabel}
            </span>
          </div>
        </div>

        {/* Fund count badge */}
        {fundCount > 0 && (
          <div className="mt-1.5 mb-0.5">
            <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-brand bg-brand/8 px-1.5 py-0.5 rounded-full">
              <span>{fundCount} fund{fundCount !== 1 ? 's' : ''}</span>
            </span>
          </div>
        )}

        {/* Metrics row */}
        <div ref={metricsRef} className="grid grid-cols-2 sm:grid-cols-4 border-t border-b border-border-light -mx-3 px-3 sm:-mx-5 sm:px-5 mt-2 sm:mt-3">
          <div className="py-2.5 pr-3">
            <div className="text-micro font-semibold uppercase tracking-[0.08em] text-text-muted mb-0.5">{t('source_card.markets')}</div>
            <span className="text-body font-bold text-text-primary font-mono tabular-nums">
              {displayMarketCount ? (
                <AnimatedNumber
                  value={displayMarketCount}
                  decimals={0}
                  duration={800}
                  formatFn={(v) => Math.round(v).toLocaleString()}
                />
              ) : '—'}
            </span>
          </div>
          <div className="py-2.5 px-3 border-l border-border-light">
            <div className="text-micro font-semibold uppercase tracking-[0.08em] text-text-muted mb-0.5">{t('source_card.type')}</div>
            <span className="text-caption font-bold text-text-primary truncate">{shortTypeLabel(source.valueLabel)}</span>
          </div>
          <div className="py-2.5 px-3 border-l border-border-light hidden sm:block">
            <div className="text-micro font-semibold uppercase tracking-[0.08em] text-text-muted mb-0.5">{t('source_card.updated')}</div>
            <span className="text-caption font-bold text-text-primary"><LiveAge iso={sourceSnapshot?.generatedAt} /></span>
          </div>
          <div className="py-2.5 pl-3 border-l border-border-light hidden sm:block">
            <div className="text-micro font-semibold uppercase tracking-[0.08em] text-text-muted mb-0.5">{t('source_card.settlement')}</div>
            <span className="flex items-center gap-1">
              <span className={`w-[5px] h-[5px] rounded-full ${settlementDotColor}`} />
              <span className="text-caption font-bold text-text-primary truncate">{settlementLabel}</span>
            </span>
          </div>
        </div>
      </div>

    </Link>
    </SpringCard>
  )
}
