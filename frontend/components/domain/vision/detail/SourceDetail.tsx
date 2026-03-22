'use client'

import { useState, useEffect, useMemo, useRef } from 'react'
import { useRouter } from '@/i18n/routing'
import { useSourceSnapshot, useMarketSnapshotMeta } from '@/hooks/vision/useMarketSnapshot'
import { useBatches } from '@/hooks/vision/useBatches'
import { useRounds } from '@/hooks/vision/useRounds'
import { useBitmapEditor } from '@/hooks/vision/useBitmapEditor'
import { useSourceRegistry, findSource } from '@/hooks/vision/useSourceRegistry'
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

  // Source registry
  const { sources, isLoading: isRegistryLoading } = useSourceRegistry()
  const sourceEntry = findSource(sources, sourceId)

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

  const sourceMarkets = snapshotData?.prices ?? []
  const metaCount = meta?.assetCounts?.[sourceId] ?? 0
  const marketCount = metaCount > 0 ? metaCount : (sourceMarkets.length || undefined)
  const marketIds = useMemo(() => sourceMarkets.map(p => p.assetId), [sourceMarkets])

  // Active batch matching this source
  const activeBatch = useMemo(() => {
    if (!batches || batches.length === 0) return null
    return batches.find(b => b.sourceId === sourceId) ?? null
  }, [batches, sourceId])

  // Bitmap counts for this source
  const counts = bitmapEditor.getCounts(sourceId, marketIds)
  const totalMarkets = marketIds.length
  const totalSet = counts.up + counts.down

  // Round status display
  const roundStatusLabel = activeRound
    ? activeRound.status === 'betting' ? t('source_detail.betting_open')
    : activeRound.status === 'settling' ? t('source_detail.settling')
    : activeRound.status === 'settled' ? t('source_detail.settled')
    : activeRound.status === 'locked' ? t('source_detail.locked')
    : activeRound.status
    : 'Waiting'

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

  return (
    <div className="px-6 lg:px-12 py-6">
      <div className="max-w-site mx-auto">
        {/* Source Hero */}
        <SourceHero source={source} sourceSchedule={sourceSchedule} marketCount={marketCount} tickRemaining={0} tickDuration={0} sourceId={sourceId} urgency={'normal'} />

        {/* Batch bar — round status */}
        <div className="mt-4 bg-[var(--surface)] border border-border-light px-5 py-3 flex items-center gap-6">
          <div>
            <div className="text-[10px] font-semibold uppercase tracking-[0.08em] text-text-muted">
              {t('source_detail.round')}
            </div>
            <div className="text-[16px] font-bold font-mono text-black">
              {activeBatch ? `#${activeBatch.id}` : '#0'}
            </div>
          </div>
          <div>
            <div className="text-[10px] font-semibold uppercase tracking-[0.08em] text-text-muted">
              Status
            </div>
            <div className="text-[16px] font-bold font-mono text-black">
              {roundStatusLabel}
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
          {/* Set status */}
          <div className="flex-1" />
          <div>
            <div className="text-[10px] font-semibold uppercase tracking-[0.08em] text-text-muted">
              {t('source_detail.set')}
            </div>
            <div className="text-[16px] font-bold font-mono text-color-up">
              {totalSet}/{totalMarkets}
            </div>
          </div>
        </div>

        {/* Content split */}
        <div className="flex flex-col lg:flex-row gap-6 mt-6">
          {/* Left: Markets + Leaderboard */}
          <div className="flex-1 min-w-0">
            <MarketsTable sourceId={sourceId} bitmapEditor={bitmapEditor} />
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
