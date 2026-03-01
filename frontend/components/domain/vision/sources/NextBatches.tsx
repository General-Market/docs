'use client'

import { useState, useEffect, useMemo } from 'react'
import { getAllBatches, getBatchTickState, getMultiplier, formatTickDuration, type StaticBatch } from '@/lib/vision/tick'
import { useBatches } from '@/hooks/vision/useBatches'
import { getCategoryLabel } from '@/lib/vision/source-categories'
import Image from 'next/image'
import Link from 'next/link'

interface BatchWithTick extends StaticBatch {
  remaining: number
  elapsed: number
  isLocked: boolean
  lockOffset: number
}

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

function BatchCard({ batch }: { batch: BatchWithTick }) {
  const multiplier = getMultiplier(batch.elapsed, batch.tickDuration, batch.lockOffset)
  const catColors = CATEGORY_COLORS[batch.category] ?? 'bg-gray-50 text-gray-700'
  const urgencyPct = 1 - batch.remaining / batch.tickDuration
  // Progress bar width
  const progressWidth = `${Math.min(urgencyPct * 100, 100)}%`

  return (
    <Link
      href={`/source/${batch.sourceKey}`}
      className={`
        shrink-0 flex flex-col px-4 py-3 border bg-white transition-all w-[200px] cursor-pointer
        ${batch.isLocked ? 'border-red-300 border-2' : 'border-border-light hover:border-black'}
      `}
    >
      {/* Header: logo + name */}
      <div className="flex items-center gap-2 mb-1.5 min-w-0">
        {batch.logo && (
          <Image
            src={batch.logo}
            alt=""
            width={14}
            height={14}
            className="rounded-sm object-contain shrink-0"
          />
        )}
        <span className="text-[11px] font-bold text-black truncate leading-tight">
          {batch.displayName}
        </span>
      </div>

      {/* Timer — large */}
      <span
        className={`text-[24px] font-bold tabular-nums tracking-tight leading-none font-mono ${batch.isLocked ? 'text-red-600' : 'text-black'}`}
      >
        {formatTimer(batch.remaining)}
      </span>

      {/* Progress bar */}
      <div className="h-1 bg-border-light mt-2 mb-1.5 overflow-hidden">
        <div
          className={`h-full transition-all duration-1000 ${batch.isLocked ? 'bg-red-500' : 'bg-black'}`}
          style={{ width: progressWidth }}
        />
      </div>

      {/* Footer: category + tick duration + multiplier */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <span className={`text-[9px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded ${catColors}`}>
            {getCategoryLabel(batch.category)}
          </span>
          <span className="text-[9px] font-semibold text-text-muted">
            {formatTickDuration(batch.tickDuration)}
          </span>
        </div>
        {batch.isLocked ? (
          <span className="text-[9px] font-bold uppercase text-red-600">
            Locked
          </span>
        ) : (
          <span className="text-[9px] font-bold text-green-600">
            {multiplier.label}
          </span>
        )}
      </div>
    </Link>
  )
}

export function NextBatches() {
  const staticBatches = useMemo(() => getAllBatches(), [])
  const { data: apiBatches } = useBatches()

  const [now, setNow] = useState(() => Date.now())

  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(interval)
  }, [])

  // Compute per-batch tick state and sort by remaining time (soonest first)
  const sortedBatches = useMemo((): BatchWithTick[] => {
    // Create a map of batch ID -> API tick duration for quick lookup
    const apiTickDurationMap = new Map(
      apiBatches?.map(b => [b.id, b.tickDuration]) ?? []
    )

    return staticBatches
      .map(batch => {
        const apiTickDuration = apiTickDurationMap.get(batch.batchId)
        const tick = getBatchTickState(
          batch.batchId,
          batch.category,
          now,
          apiTickDuration // Pass the real tick duration from API, falls back to category default if not available
        )
        return { ...batch, ...tick }
      })
      .sort((a, b) => a.remaining - b.remaining)
  }, [staticBatches, apiBatches, now])

  // Count how many are locked right now
  const lockedCount = sortedBatches.filter(b => b.isLocked).length

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
          {sortedBatches.map((batch) => (
            <BatchCard key={batch.batchId} batch={batch} />
          ))}
        </div>
      </div>
    </div>
  )
}
