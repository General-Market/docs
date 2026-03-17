'use client'

import { useState, useEffect, useMemo } from 'react'
import { getBatchTickState, formatTickDuration } from '@/lib/vision/tick'
import { useBatches, type BatchInfo } from '@/hooks/vision/useBatches'
import { useSourceRegistry, findSource } from '@/hooks/vision/useSourceRegistry'
import Image from 'next/image'
import { Link } from '@/i18n/routing'

function formatTimer(seconds: number): string {
  if (seconds <= 0) return '0:00'
  if (seconds >= 3600) {
    const h = Math.floor(seconds / 3600)
    const m = Math.floor((seconds % 3600) / 60)
    return `${h}:${m.toString().padStart(2, '0')}:${(seconds % 60).toString().padStart(2, '0')}`
  }
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return `${m}:${s.toString().padStart(2, '0')}`
}

/** Category color mapping for the pill badges */
const CATEGORY_COLORS: Record<string, string> = {
  finance:       'bg-blue-50 text-blue-700',
  economic:      'bg-amber-50 text-amber-700',
  regulatory:    'bg-purple-50 text-purple-700',
  tech:          'bg-cyan-50 text-cyan-700',
  academic:      'bg-indigo-50 text-indigo-700',
  entertainment: 'bg-pink-50 text-pink-700',
  geophysical:   'bg-orange-50 text-orange-700',
  transport:     'bg-teal-50 text-teal-700',
  nature:        'bg-emerald-50 text-emerald-700',
  space:         'bg-violet-50 text-violet-700',
}

interface BatchWithTick {
  batch: BatchInfo
  remaining: number
  elapsed: number
  tickDuration: number
  isLocked: boolean
  logo?: string
  displayName: string
  category: string
  sourceKey: string
}

function BatchCard({ item }: { item: BatchWithTick }) {
  const catColors = CATEGORY_COLORS[item.category] ?? 'bg-gray-50 text-gray-700'
  const urgencyPct = 1 - item.remaining / item.tickDuration
  const progressWidth = `${Math.min(urgencyPct * 100, 100)}%`

  return (
    <Link
      href={`/source/${item.sourceKey}`}
      className={`
        shrink-0 flex flex-col px-4 py-3 border bg-white transition-all w-[200px] cursor-pointer
        ${item.isLocked ? 'border-red-300 border-2' : 'border-border-light hover:border-black'}
      `}
    >
      {/* Header: logo + name */}
      <div className="flex items-center gap-2 mb-1.5 min-w-0">
        {item.logo && (
          <Image
            src={item.logo}
            alt=""
            width={14}
            height={14}
            className="rounded-sm object-contain shrink-0"
          />
        )}
        <span className="text-[11px] font-bold text-black truncate leading-tight">
          {item.displayName}
        </span>
      </div>

      {/* Timer — large */}
      <span
        className={`text-[24px] font-bold tabular-nums tracking-tight leading-none font-mono ${item.isLocked ? 'text-red-600' : 'text-black'}`}
      >
        {formatTimer(item.remaining)}
      </span>

      {/* Progress bar */}
      <div className="h-1 bg-border-light mt-2 mb-1.5 overflow-hidden">
        <div
          className={`h-full transition-all duration-1000 ${item.isLocked ? 'bg-red-500' : 'bg-black'}`}
          style={{ width: progressWidth }}
        />
      </div>

      {/* Footer: category + tick duration */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <span className={`text-[9px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded ${catColors}`}>
            {item.category}
          </span>
          <span className="text-[9px] font-semibold text-text-muted">
            {formatTickDuration(item.tickDuration)}
          </span>
        </div>
        <span className="text-[9px] font-bold text-text-muted">
          #{item.batch.currentTick}
        </span>
      </div>
    </Link>
  )
}

export function NextBatches() {
  const { data: apiBatches } = useBatches()
  const { sources: registrySources } = useSourceRegistry()

  // Initialize with 0 to avoid hydration mismatch
  const [now, setNow] = useState(0)

  useEffect(() => {
    setNow(Date.now())
    const interval = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(interval)
  }, [])

  const sortedBatches = useMemo((): BatchWithTick[] => {
    if (!apiBatches || apiBatches.length === 0) return []

    return apiBatches
      .filter(b => b.marketCount > 0)
      .map(batch => {
        const tickDuration = batch.tickDuration > 0 ? batch.tickDuration : 600
        const tickState = now === 0
          ? { elapsed: 0, remaining: tickDuration, tickDuration, isLocked: false, lockOffset: 0 }
          : getBatchTickState(tickDuration)

        // Resolve display info from source registry
        const source = findSource(registrySources, batch.sourceId)
        const displayName = source?.name ?? batch.sourceId
        const logo = source?.logo
        const category = source?.category ?? 'finance'

        return {
          batch,
          remaining: tickState.remaining,
          elapsed: tickState.elapsed,
          tickDuration,
          isLocked: tickState.isLocked,
          logo,
          displayName,
          category,
          sourceKey: batch.sourceId,
        }
      })
      .sort((a, b) => a.remaining - b.remaining)
  }, [apiBatches, registrySources, now])

  const lockedCount = sortedBatches.filter(b => b.isLocked).length

  if (sortedBatches.length === 0) return null

  return (
    <div className="px-6 lg:px-12">
      <div className="max-w-site mx-auto">
        <div className="flex items-center justify-between pt-4 pb-2">
          <div className="text-[10px] font-bold uppercase tracking-[0.12em] text-text-muted">
            Live Batches
          </div>
          <div className="flex items-center gap-3 text-[10px] font-semibold text-text-muted">
            <span>{sortedBatches.length} batches</span>
            {lockedCount > 0 && (
              <span className="text-red-500">{lockedCount} locked</span>
            )}
          </div>
        </div>

        <div
          className="flex gap-2 pb-4 overflow-x-auto"
          style={{ scrollbarWidth: 'thin' }}
        >
          {sortedBatches.map((item) => (
            <BatchCard key={item.batch.id} item={item} />
          ))}
        </div>
      </div>
    </div>
  )
}
