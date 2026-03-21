'use client'

import { useState, useEffect, useMemo, useRef } from 'react'
import { useRouter } from '@/i18n/routing'
import { useSourceSnapshot, useMarketSnapshotMeta } from '@/hooks/vision/useMarketSnapshot'
import { useBatches } from '@/hooks/vision/useBatches'
import { useRounds } from '@/hooks/vision/useRounds'
import { useBitmapEditor } from '@/hooks/vision/useBitmapEditor'
import { useSourceRegistry, findSource } from '@/hooks/vision/useSourceRegistry'
import { getBatchTickState } from '@/lib/vision/tick'
import { Link } from '@/i18n/routing'
import { SourceHero } from './SourceHero'
import { MarketsTable } from './MarketsTable'
import { TopPlayers } from './TopPlayers'
import BatchEntryPanel from './BatchEntryPanel'
import type { SourceDisplayServer } from '@/lib/vision/sources-server'
import { useTranslations } from 'next-intl'

interface SourceDetailProps {
  sourceId: string
  initialSource?: SourceDisplayServer
}

type TickUrgency = 'normal' | 'urgent' | 'critical'

function getTickUrgency(remaining: number): TickUrgency {
  if (remaining <= 15) return 'critical'
  if (remaining <= 60) return 'urgent'
  return 'normal'
}

function formatTvl(tvl: string): string {
  const raw = parseFloat(tvl)
  if (isNaN(raw) || raw === 0) return '$0'
  const num = raw / 1e18
  if (num >= 1_000_000) return `$${(num / 1_000_000).toFixed(2)}M`
  if (num >= 1_000) return `$${(num / 1_000).toFixed(1)}K`
  return `$${num.toFixed(2)}`
}

export function SourceDetail({ sourceId, initialSource }: SourceDetailProps) {
  const t = useTranslations('vision')
  const router = useRouter()

  // Source registry — all metadata comes from data-node API
  const { sources, isLoading: isRegistryLoading } = useSourceRegistry()
  const sourceEntry = findSource(sources, sourceId)

  // Adapt to VisionSource shape — use initialSource for instant render before SWR loads
  const source = sourceEntry
    ? {
        id: sourceEntry.sourceId,
        name: sourceEntry.name,
        description: sourceEntry.description,
        category: sourceEntry.category,
        logo: sourceEntry.logo,
        brandBg: sourceEntry.brandBg,
        prefixes: sourceEntry.prefixes,
        valueLabel: sourceEntry.valueLabel,
        valueUnit: sourceEntry.valueUnit,
        isPrice: sourceEntry.isPrice,
      }
    : initialSource
      ? {
          id: initialSource.sourceId,
          name: initialSource.name,
          description: initialSource.description,
          category: initialSource.category,
          logo: initialSource.logo,
          brandBg: initialSource.brandBg,
          prefixes: initialSource.prefixes,
          valueLabel: initialSource.valueLabel,
          valueUnit: initialSource.valueUnit,
          isPrice: initialSource.isPrice,
        }
      : null

  // Per-source snapshot for market list
  const { data: snapshotData } = useSourceSnapshot(sourceId)
  const { data: meta } = useMarketSnapshotMeta()
  const { data: batches } = useBatches()
  const { data: rounds } = useRounds(sourceId)
  const activeRound = rounds?.[0]
  const bitmapEditor = useBitmapEditor()

  // Find source schedule from meta
  const sourceSchedule = useMemo(() => {
    if (!meta?.sources) return undefined
    return meta.sources.find((s) => s.sourceId === sourceId)
  }, [meta?.sources, sourceId])

  // Markets come directly from the per-source snapshot (already filtered server-side)
  const sourceMarkets = snapshotData?.prices ?? []

  // Use meta for accurate total count, fall back to snapshot
  const metaCount = meta?.assetCounts?.[sourceId] ?? 0
  const marketCount = metaCount > 0 ? metaCount : (sourceMarkets.length || undefined)
  const marketIds = useMemo(() => sourceMarkets.map(p => p.assetId), [sourceMarkets])

  // Pick the active batch matching this source — live data only
  const activeBatch = useMemo(() => {
    if (!batches || batches.length === 0) return null
    return batches.find(b => b.sourceId === sourceId) ?? null
  }, [batches, sourceId])

  // Per-batch tick timer using live tickDuration from batch data
  const tickDuration = activeBatch?.tickDuration ?? 600
  const [tickState, setTickState] = useState(() => getBatchTickState(tickDuration))
  useEffect(() => {
    const td = activeBatch?.tickDuration ?? 600
    const interval = setInterval(() => {
      setTickState(getBatchTickState(td))
    }, 1000)
    return () => clearInterval(interval)
  }, [activeBatch?.tickDuration])

  // ── Tick Pulse System ──
  const urgency = getTickUrgency(tickState.remaining)

  // Resolution detection — when tick counter resets, flash the page
  const prevRemainingRef = useRef(tickState.remaining)
  const [justResolved, setJustResolved] = useState(false)
  useEffect(() => {
    const prev = prevRemainingRef.current
    const curr = tickState.remaining
    prevRemainingRef.current = curr
    // Detect reset: previous was low (<30s), current jumped past halfway
    if (prev <= 30 && curr > tickDuration * 0.5) {
      setJustResolved(true)
      const t = setTimeout(() => setJustResolved(false), 1500)
      return () => clearTimeout(t)
    }
  }, [tickState.remaining, tickDuration])

  // Show loading state while registry loads (skip if we have initialSource)
  if (isRegistryLoading && !initialSource) {
    return (
      <div className="px-6 lg:px-12 py-12">
        <div className="max-w-5xl mx-auto text-center">
          <p className="text-text-muted">{t('source_detail.loading_source')}</p>
        </div>
      </div>
    )
  }

  if (!source) {
    return (
      <div className="px-6 lg:px-12 py-12">
        <div className="max-w-5xl mx-auto text-center">
          <h1 className="text-2xl font-black text-black mb-2">{t('source_detail.source_not_found')}</h1>
          <p className="text-text-secondary mb-4">
            {t('source_detail.source_not_found_description', { sourceId })}
          </p>
          <button
            onClick={() => router.push('/')}
            className="text-[13px] font-bold text-black underline hover:no-underline"
          >
            {t('common_labels.back_to_sources')}
          </button>
        </div>
      </div>
    )
  }

  const formatTime = (secs: number): string => {
    const m = Math.floor(secs / 60)
    const s = secs % 60
    return `${m}:${s.toString().padStart(2, '0')}`
  }

  // Bitmap counts for this source
  const counts = bitmapEditor.getCounts(sourceId, marketIds)
  const totalMarkets = marketIds.length
  const totalSet = counts.up + counts.down

  const urgencyBarCls =
    urgency === 'critical' ? 'batch-bar-critical' :
    urgency === 'urgent' ? 'batch-bar-urgent' : ''

  const urgencyProgressCls =
    urgency === 'critical' ? 'tick-progress-critical' :
    urgency === 'urgent' ? 'tick-progress-urgent' : 'bg-black'

  const urgencyTimerCls =
    urgency === 'critical' ? 'tick-timer-critical' :
    urgency === 'urgent' ? 'tick-timer-urgent' : 'text-black'

  return (
    <div className="px-6 lg:px-12 py-6">
      <div className="max-w-site mx-auto">
        {/* Source Hero */}
        <SourceHero source={source} sourceSchedule={sourceSchedule} marketCount={marketCount} tickRemaining={tickState.remaining} tickDuration={tickDuration} sourceId={sourceId} urgency={urgency} />

        {/* Batch bar — breathes with tick urgency */}
        <div className={`mt-4 bg-[var(--surface)] border border-border-light px-5 py-3 flex items-center gap-6 transition-shadow duration-700 ${urgencyBarCls} ${justResolved ? 'tick-resolved' : ''}`}>
          <div>
            <div className="text-[10px] font-semibold uppercase tracking-[0.08em] text-text-muted">
              {t('source_detail.tick')}
            </div>
            <div className="text-[16px] font-bold font-mono text-black">
              {activeBatch ? `#${activeBatch.currentTick}` : '#0'}
            </div>
          </div>
          <div>
            <div className="text-[10px] font-semibold uppercase tracking-[0.08em] text-text-muted">
              {t('source_detail.players')}
            </div>
            <div className="text-[16px] font-bold font-mono text-black">
              {activeBatch?.playerCount ?? 0}
            </div>
          </div>
          <div>
            <div className="text-[10px] font-semibold uppercase tracking-[0.08em] text-text-muted">
              {t('source_detail.pool')}
            </div>
            <div className="text-[16px] font-bold font-mono text-color-up">
              {activeBatch ? formatTvl(activeBatch.tvl) : '$0'}
            </div>
          </div>
          {/* Progress bar — glows as tick approaches */}
          <div className="flex-1">
            <div className="h-1.5 bg-border-light overflow-hidden rounded-full">
              <div
                className={`h-full tick-progress ${urgencyProgressCls}`}
                style={{ width: `${(tickState.elapsed / tickState.tickDuration) * 100}%` }}
              />
            </div>
          </div>
          {/* Set status */}
          <div>
            <div className="text-[10px] font-semibold uppercase tracking-[0.08em] text-text-muted">
              {t('source_detail.set')}
            </div>
            <div className="text-[16px] font-bold font-mono text-color-up">
              {totalSet}/{totalMarkets}
            </div>
          </div>
          {/* Timer — pulses on critical */}
          <div>
            <div className="text-[10px] font-semibold uppercase tracking-[0.08em] text-text-muted">
              {t('source_detail.timer')}
            </div>
            <div className={`text-[16px] font-bold font-mono tabular-nums ${urgencyTimerCls}`}>
              {formatTime(tickState.remaining)}
            </div>
          </div>
          {/* Round state — shown when rounds API is available */}
          {activeRound && (
            <div>
              <div className="text-[10px] font-semibold uppercase tracking-[0.08em] text-text-muted">
                {t('source_detail.round')}
              </div>
              <div className="text-[16px] font-bold font-mono text-black">
                {activeRound.status === 'betting' ? t('source_detail.betting_open') :
                 activeRound.status === 'settling' ? t('source_detail.settling') :
                 activeRound.status === 'settled' ? t('source_detail.settled') :
                 activeRound.status === 'locked' ? t('source_detail.locked') :
                 activeRound.status}
              </div>
            </div>
          )}
        </div>

        {/* Content split */}
        <div className="flex flex-col lg:flex-row gap-6 mt-6">
          {/* Left: Markets + Leaderboard */}
          <div className="flex-1 min-w-0">
            <MarketsTable sourceId={sourceId} bitmapEditor={bitmapEditor} isResolving={justResolved} />
            <TopPlayers sourceId={sourceId} />
          </div>

          {/* Right: Batch entry panel (300px, sticky) */}
          <div className="w-full lg:w-[300px] shrink-0">
            <div className="lg:sticky lg:top-28">
              <BatchEntryPanel
                bitmapEditor={bitmapEditor}
                sourceId={sourceId}
                marketIds={marketIds}
              />
            </div>
          </div>
        </div>

        {/* Related links */}
        <div className="mt-8 pt-6 border-t border-border-light flex flex-wrap gap-4 text-[12px] text-text-secondary">
          <Link href="/" className="hover:text-black transition-colors">{t('source_detail.all_sources')}</Link>
          <Link href="/sources" className="hover:text-black transition-colors">{t('source_detail.source_health')}</Link>
          <Link href="/points" className="hover:text-black transition-colors">{t('source_detail.earn_points')}</Link>
          <Link href="/about" className="hover:text-black transition-colors">{t('source_detail.about')}</Link>
        </div>
      </div>
    </div>
  )
}
