'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useTranslations } from 'next-intl'
import Image from 'next/image'
import { Link, useRouter } from '@/i18n/routing'
import type { VisionSource } from '@/lib/vision/sources'
import { getDataNodeSourceId } from '@/lib/vision/sources'
import { getCategoryLabel } from '@/lib/vision/source-categories'
import type { BitmapEditor } from '@/hooks/vision/useBitmapEditor'
import { useSourceSnapshot } from '@/hooks/vision/useMarketSnapshot'
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

/** Format a timestamp as relative age (e.g. "2m ago", "1h ago") */
function formatAge(iso: string): string {
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

export function SourceCard({ source, bitmapEditor, index = 99, metaAssetCount, metaStatus }: SourceCardProps) {
  const t = useTranslations('vision')
  const router = useRouter()

  // Fetch per-source data immediately on mount
  const dataNodeId = getDataNodeSourceId(source.id)
  const { data: sourceSnapshot, isLoading } = useSourceSnapshot(dataNodeId)

  const totalMarkets = sourceSnapshot?.prices?.length ?? 0
  const displayMarketCount = metaAssetCount ?? totalMarkets

  // Status from admin health, fall back to meta-based check
  const statusLabel = metaStatus === 'healthy' ? t('source_card.status_live') : metaStatus === 'stale' ? t('source_card.status_stale') : metaStatus === 'dead' ? t('source_card.status_dead') : displayMarketCount > 0 ? t('source_card.status_live') : t('source_card.status_pending')
  const statusColor = metaStatus === 'healthy' || (!metaStatus && displayMarketCount > 0) ? 'bg-color-up' : metaStatus === 'stale' ? 'bg-yellow-500' : 'bg-text-muted'
  const statusTextColor = metaStatus === 'healthy' || (!metaStatus && displayMarketCount > 0) ? 'text-color-up' : metaStatus === 'stale' ? 'text-yellow-600' : 'text-text-muted'

  // Count-up: start at 0, tick to real value when card enters viewport
  const metricsRef = useRef<HTMLDivElement>(null)
  const [metricsVisible, setMetricsVisible] = useState(false)
  useEffect(() => {
    const el = metricsRef.current
    if (!el) return
    const io = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) { setMetricsVisible(true); io.disconnect() } },
      { threshold: 0.1 },
    )
    io.observe(el)
    return () => io.disconnect()
  }, [])

  // Determine brand background style
  const brandStyle: React.CSSProperties = source.brandBg.startsWith('linear-gradient')
    ? { background: source.brandBg }
    : { backgroundColor: source.brandBg }

  // Detect light backgrounds — logos need a subtle vignette to stay visible
  const isLightBg = (() => {
    const hex = source.brandBg.replace('#', '')
    if (hex.length !== 6) return false
    const r = parseInt(hex.slice(0, 2), 16)
    const g = parseInt(hex.slice(2, 4), 16)
    const b = parseInt(hex.slice(4, 6), 16)
    return (r * 0.299 + g * 0.587 + b * 0.114) > 200
  })()

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

  // Hide card if source has no working data (covers meta-down scenario)
  if (!isLoading && totalMarkets === 0 && !metaAssetCount) return null

  return (
    <SpringCard className="bg-white border-r border-b border-border-light overflow-hidden">
    <Link
      href={`/source/${source.id}`}
      onClick={handleViewTransition}
      data-testid="source-card"
      className="block group cursor-pointer"
    >
      {/* Brand image area */}
      <div className="relative aspect-video w-full overflow-hidden source-brand-shimmer">
          <div
            className={`absolute inset-0 flex items-center justify-center ${isLightBg ? 'border-b border-border-light' : ''}`}
            style={{ ...brandStyle, viewTransitionName: `source-brand-${source.id}` } as React.CSSProperties}
          >
            <Image
              src={source.logo}
              alt={source.name}
              width={logoSize.w}
              height={logoSize.h}
              priority={index < 12}
              loading={index < 12 ? 'eager' : 'lazy'}
              className="max-w-[90%] object-contain"
              style={{ maxHeight: logoSize.maxH }}
            />
            <span className="absolute top-2.5 right-2.5 text-micro font-bold tracking-[0.08em] uppercase px-2 py-0.5 rounded glass-badge text-white/90">
              {getCategoryLabel(source.category).toUpperCase()}
            </span>
          </div>
        </div>

      {/* Card content */}
      <div className="px-5 pt-4 pb-0">
        <div className="flex justify-between items-start mb-1">
          <div className="min-w-0 flex-1 mr-2">
            <h3 className="text-subhead font-extrabold text-black tracking-[-0.01em]">{source.name}</h3>
            <p className="text-label text-text-muted leading-snug mt-0.5 line-clamp-2">{source.description}</p>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <span className={`w-[6px] h-[6px] rounded-full ${statusColor}`} />
            <span className={`text-label font-semibold ${statusTextColor}`}>
              {statusLabel}
            </span>
          </div>
        </div>

        {/* Metrics row */}
        <div ref={metricsRef} className="grid grid-cols-3 border-t border-b border-border-light -mx-5 px-5 mt-3">
          <div className="py-2.5 pr-3">
            <div className="text-micro font-semibold uppercase tracking-[0.08em] text-text-muted mb-0.5">{t('source_card.markets')}</div>
            <span className="text-body font-bold text-black font-mono tabular-nums">
              {displayMarketCount ? (
                <AnimatedNumber
                  value={metricsVisible ? displayMarketCount : 0}
                  decimals={0}
                  duration={800}
                  formatFn={(v) => Math.round(v).toLocaleString()}
                />
              ) : '—'}
            </span>
          </div>
          <div className="py-2.5 px-3 border-l border-border-light">
            <div className="text-micro font-semibold uppercase tracking-[0.08em] text-text-muted mb-0.5">{t('source_card.type')}</div>
            <span className="text-caption font-bold text-black truncate">{shortTypeLabel(source.valueLabel)}</span>
          </div>
          <div className="py-2.5 pl-3 border-l border-border-light">
            <div className="text-micro font-semibold uppercase tracking-[0.08em] text-text-muted mb-0.5">{t('source_card.updated')}</div>
            <span className="text-caption font-bold text-black">{sourceSnapshot?.generatedAt ? formatAge(sourceSnapshot.generatedAt) : '—'}</span>
          </div>
        </div>
      </div>

    </Link>
    </SpringCard>
  )
}
