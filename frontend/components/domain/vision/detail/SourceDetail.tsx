'use client'

import { useState, useEffect, useMemo } from 'react'
import { useRouter } from '@/i18n/routing'
import { getSource, getAssetCountForSource, getSourceStatusFromMeta, getDataNodeSourceId, getBatchKey } from '@/lib/vision/sources'
import { useSourceSnapshot, useMarketSnapshotMeta } from '@/hooks/vision/useMarketSnapshot'
import { useBatches } from '@/hooks/vision/useBatches'
import { useBitmapEditor } from '@/hooks/vision/useBitmapEditor'
import { getBatchTickState, getMultiplier, getSourceKeyForBatch } from '@/lib/vision/tick'
import batchConfig from '@/lib/contracts/vision-batches.json'
import { Link } from '@/i18n/routing'
import { SourceHero } from './SourceHero'
import { MarketsTable } from './MarketsTable'
import { TopPlayers } from './TopPlayers'
import BatchEntryPanel from './BatchEntryPanel'

interface SourceDetailProps {
  sourceId: string
}

function formatTvl(tvl: string): string {
  const raw = parseFloat(tvl)
  if (isNaN(raw) || raw === 0) return '$0'
  // Raw value is in L3 USDC smallest units (18 decimals)
  const num = raw / 1e18
  if (num >= 1_000_000) return `$${(num / 1_000_000).toFixed(2)}M`
  if (num >= 1_000) return `$${(num / 1_000).toFixed(1)}K`
  return `$${num.toFixed(2)}`
}

export function SourceDetail({ sourceId }: SourceDetailProps) {
  const router = useRouter()
  const source = getSource(sourceId)
  const dataNodeId = source ? getDataNodeSourceId(sourceId) : undefined
  const { data: snapshotData } = useSourceSnapshot(dataNodeId)
  const { data: meta } = useMarketSnapshotMeta()
  const { data: batches } = useBatches()
  const bitmapEditor = useBitmapEditor()

  // Find source schedule from meta
  const sourceSchedule = useMemo(() => {
    if (!meta?.sources) return undefined
    return meta.sources.find((s) => s.sourceId === sourceId || s.sourceId === dataNodeId)
  }, [meta?.sources, sourceId, dataNodeId])

  // Markets come directly from the per-source snapshot (already filtered server-side)
  const sourceMarkets = snapshotData?.prices ?? []

  // Use meta for accurate total count, fall back to snapshot
  const metaCount = meta?.assetCounts ? getAssetCountForSource(sourceId, meta.assetCounts) : 0
  const marketCount = metaCount > 0 ? metaCount : (sourceMarkets.length || undefined)
  const marketIds = useMemo(() => sourceMarkets.map(p => p.assetId), [sourceMarkets])

  // Pick the active batch matching this source via static config (batchId lookup)
  // Falls back to a minimal static batch when API data isn't available yet
  const batchKey = getBatchKey(sourceId)
  const staticEntry = (batchConfig.batches as Record<string, { batchId: number; configHash: string; tickDuration?: number }>)[batchKey]
  const activeBatch = useMemo(() => {
    // Try to find from live API data first
    if (batches && batches.length > 0) {
      if (staticEntry) {
        const fromApi = batches.find(b => b.id === staticEntry.batchId)
        if (fromApi) return fromApi
      }
      // Fallback: try matching by source_id string (for dynamically created batches)
      const bySource = batches.find(b =>
        b.sourceId === sourceId || b.sourceId === dataNodeId
      )
      if (bySource) return bySource
    }
    // When API data isn't available, construct minimal batch from static config
    // This ensures TICK/PLAYERS/POOL show something instead of dashes
    if (staticEntry) {
      return {
        id: staticEntry.batchId,
        creator: '',
        sourceId: batchKey,
        marketIds: [] as string[],
        resolutionTypes: [] as number[],
        tickDuration: staticEntry.tickDuration ?? 600,
        marketCount: 0,
        playerCount: 0,
        tvl: '0',
        currentTick: 0,
        paused: false,
      } satisfies import('@/hooks/vision/useBatches').BatchInfo
    }
    return null
  }, [batches, sourceId, dataNodeId, staticEntry, batchKey])

  // Per-batch tick timer using category-specific duration
  const [tickState, setTickState] = useState(() =>
    activeBatch ? getBatchTickState(activeBatch.id, source?.category ?? 'finance') : getBatchTickState(0, source?.category ?? 'finance')
  )
  useEffect(() => {
    const interval = setInterval(() => {
      setTickState(activeBatch ? getBatchTickState(activeBatch.id, source?.category ?? 'finance') : getBatchTickState(0, source?.category ?? 'finance'))
    }, 1000)
    return () => clearInterval(interval)
  }, [activeBatch, source?.category])
  const multiplier = getMultiplier(tickState.elapsed, tickState.tickDuration, tickState.lockOffset)

  if (!source) {
    return (
      <div className="px-6 lg:px-12 py-12">
        <div className="max-w-5xl mx-auto text-center">
          <h1 className="text-2xl font-black text-black mb-2">Source not found</h1>
          <p className="text-text-secondary mb-4">
            No source with ID &quot;{sourceId}&quot; exists.
          </p>
          <button
            onClick={() => router.push('/')}
            className="text-[13px] font-bold text-black underline hover:no-underline"
          >
            Back to Sources
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

  return (
    <div className="px-6 lg:px-12 py-6">
      <div className="max-w-site mx-auto">
        {/* Source Hero */}
        <SourceHero source={source} sourceSchedule={sourceSchedule} marketCount={marketCount} />

        {/* Batch bar */}
        <div className="mt-4 bg-[var(--surface)] border border-border-light px-5 py-3 flex items-center gap-6">
          <div>
            <div className="text-[10px] font-semibold uppercase tracking-[0.08em] text-text-muted">
              Tick
            </div>
            <div className="text-[16px] font-bold font-mono text-black">
              {activeBatch ? `#${activeBatch.currentTick}` : '—'}
            </div>
          </div>
          <div>
            <div className="text-[10px] font-semibold uppercase tracking-[0.08em] text-text-muted">
              Players
            </div>
            <div className="text-[16px] font-bold font-mono text-black">
              {activeBatch?.playerCount ?? '—'}
            </div>
          </div>
          <div>
            <div className="text-[10px] font-semibold uppercase tracking-[0.08em] text-text-muted">
              Pool
            </div>
            <div className="text-[16px] font-bold font-mono text-color-up">
              {activeBatch ? formatTvl(activeBatch.tvl) : '—'}
            </div>
          </div>
          {/* Progress bar */}
          <div className="flex-1">
            <div className="h-1.5 bg-border-light overflow-hidden">
              <div
                className={`h-full transition-all duration-1000 ${tickState.isLocked ? 'bg-red-500' : 'bg-black'}`}
                style={{ width: `${(tickState.elapsed / tickState.tickDuration) * 100}%` }}
              />
            </div>
          </div>
          {/* Multiplier */}
          <div>
            <div className="text-[10px] font-semibold uppercase tracking-[0.08em] text-text-muted">
              Multiplier
            </div>
            <div className={`text-[16px] font-bold font-mono ${tickState.isLocked ? 'text-red-600' : 'text-color-up'}`}>
              {multiplier.label}
            </div>
          </div>
          {/* Set status */}
          <div>
            <div className="text-[10px] font-semibold uppercase tracking-[0.08em] text-text-muted">
              Set
            </div>
            <div className="text-[16px] font-bold font-mono text-color-up">
              {totalSet}/{totalMarkets}
            </div>
          </div>
          {/* Timer */}
          <div>
            <div className="text-[10px] font-semibold uppercase tracking-[0.08em] text-text-muted">
              Timer
            </div>
            <div className={`text-[16px] font-bold font-mono tabular-nums ${tickState.isLocked ? 'text-red-600' : 'text-black'}`}>
              {formatTime(tickState.remaining)}
            </div>
          </div>
        </div>

        {/* Content split */}
        <div className="flex flex-col lg:flex-row gap-6 mt-6">
          {/* Left: Markets + Leaderboard */}
          <div className="flex-1 min-w-0">
            <MarketsTable sourceId={sourceId} bitmapEditor={bitmapEditor} />
            <TopPlayers batchId={activeBatch?.id} />
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
          <Link href="/" className="hover:text-black transition-colors">All Sources</Link>
          <Link href="/sources" className="hover:text-black transition-colors">Source Health</Link>
          <Link href="/points" className="hover:text-black transition-colors">Earn Points</Link>
          <Link href="/about" className="hover:text-black transition-colors">About</Link>
        </div>
      </div>
    </div>
  )
}
