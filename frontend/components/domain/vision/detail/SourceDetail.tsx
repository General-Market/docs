'use client'

import { useState, useEffect, useMemo } from 'react'
import { useRouter } from '@/i18n/routing'
import { getSource } from '@/lib/vision/sources'
import { useMarketSnapshot } from '@/hooks/vision/useMarketSnapshot'
import { useBatches } from '@/hooks/vision/useBatches'
import { useBitmapEditor } from '@/hooks/vision/useBitmapEditor'
import { SourceHero } from './SourceHero'
import { MarketsTable } from './MarketsTable'
import { TopPlayers } from './TopPlayers'
import BatchEntryPanel from './BatchEntryPanel'

interface SourceDetailProps {
  sourceId: string
}

function formatTvl(tvl: string): string {
  const num = parseFloat(tvl)
  if (isNaN(num) || num === 0) return '$0'
  if (num >= 1_000_000) return `$${(num / 1_000_000).toFixed(2)}M`
  if (num >= 1_000) return `$${(num / 1_000).toFixed(1)}K`
  return `$${num.toFixed(2)}`
}

export function SourceDetail({ sourceId }: SourceDetailProps) {
  const router = useRouter()
  const source = getSource(sourceId)
  const { data: snapshotData } = useMarketSnapshot()
  const { data: batches } = useBatches()
  const bitmapEditor = useBitmapEditor()

  // Find source schedule from snapshot
  const sourceSchedule = useMemo(() => {
    if (!snapshotData?.sources) return undefined
    return snapshotData.sources.find((s) => s.sourceId === sourceId)
  }, [snapshotData?.sources, sourceId])

  // Get markets for this source from snapshot prices
  const sourceMarkets = useMemo(() => {
    if (!snapshotData?.prices || !source) return []
    const prefixes = source.prefixes
    return snapshotData.prices.filter((p) => {
      const id = p.assetId.toLowerCase()
      return prefixes.some((prefix) => id.startsWith(prefix))
    })
  }, [snapshotData?.prices, source])

  const marketCount = sourceMarkets.length || undefined
  const marketIds = useMemo(() => sourceMarkets.map(p => p.assetId), [sourceMarkets])

  // Pick the first active batch for the batch bar
  const activeBatch = useMemo(() => {
    if (!batches || batches.length === 0) return null
    return batches[0]
  }, [batches])

  // Batch timer countdown
  const [tickElapsed, setTickElapsed] = useState(0)
  useEffect(() => {
    if (!activeBatch) return
    const interval = setInterval(() => {
      setTickElapsed((prev) => {
        const next = prev + 1
        if (next >= activeBatch.tickDuration) return 0
        return next
      })
    }, 1000)
    return () => clearInterval(interval)
  }, [activeBatch])

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

  const timeRemaining = activeBatch
    ? Math.max(activeBatch.tickDuration - tickElapsed, 0)
    : 0

  const formatTime = (secs: number): string => {
    const m = Math.floor(secs / 60)
    const s = secs % 60
    return `${m}:${s.toString().padStart(2, '0')}`
  }

  // Bitmap counts for this source
  const counts = bitmapEditor.getCounts(sourceId)
  const totalMarkets = marketIds.length
  const totalSet = counts.up + counts.down

  return (
    <div className="px-6 lg:px-12 py-6">
      <div className="max-w-site mx-auto">
        {/* Back link */}
        <button
          onClick={() => router.push('/')}
          className="inline-flex items-center gap-1 text-[13px] font-semibold text-text-secondary hover:text-black transition-colors mb-4"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Sources
        </button>

        {/* Source Hero */}
        <SourceHero source={source} sourceSchedule={sourceSchedule} marketCount={marketCount} />

        {/* Batch bar — light gray like mockup */}
        <div className="mt-4 bg-[var(--surface)] border border-border-light rounded-lg px-5 py-3 flex items-center gap-6">
          <div>
            <div className="text-[10px] font-semibold uppercase tracking-[0.08em] text-text-muted">
              Batch
            </div>
            <div className="text-[16px] font-bold font-mono text-black">
              {activeBatch ? `#${activeBatch.id.toLocaleString()}` : '—'}
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
              TVL
            </div>
            <div className="text-[16px] font-bold font-mono text-color-up">
              {activeBatch ? formatTvl(activeBatch.tvl) : '—'}
            </div>
          </div>
          {/* Progress bar */}
          <div className="flex-1">
            <div className="h-1.5 bg-border-light rounded-full overflow-hidden">
              <div
                className="h-full bg-black rounded-full transition-all duration-1000"
                style={{ width: activeBatch ? `${Math.min((tickElapsed / activeBatch.tickDuration) * 100, 100)}%` : '0%' }}
              />
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
            <div className="text-[16px] font-bold font-mono tabular-nums text-black">
              {formatTime(timeRemaining)}
            </div>
          </div>
        </div>

        {/* Content split */}
        <div className="flex flex-col lg:flex-row gap-6 mt-6">
          {/* Left: Markets + Leaderboard */}
          <div className="flex-1 min-w-0">
            <MarketsTable sourceId={sourceId} bitmapEditor={bitmapEditor} />
            <TopPlayers />
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
      </div>
    </div>
  )
}
