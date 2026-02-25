'use client'

import { useState, useEffect } from 'react'
import { useBatches } from '@/hooks/vision/useBatches'
import type { BatchInfo } from '@/hooks/vision/useBatches'

interface NextBatchesProps {
  onBatchSelect?: (batchId: number) => void
}

function formatTimer(seconds: number): string {
  if (seconds <= 0) return '0:00'
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return `${m}:${s.toString().padStart(2, '0')}`
}

function formatTvl(tvl: string | number): string {
  const n = typeof tvl === 'string' ? parseFloat(tvl) : tvl
  if (isNaN(n) || n === 0) return '$0'
  // TVL might be in wei (1e18) or raw USD — handle both
  const usd = n > 1e15 ? n / 1e18 : n
  if (usd >= 1_000_000) return `$${(usd / 1_000_000).toFixed(1)}M`
  if (usd >= 1_000) return `$${(usd / 1_000).toFixed(1)}K`
  return `$${usd.toLocaleString(undefined, { maximumFractionDigits: 0 })}`
}

function BatchCard({
  batch,
  isFirst,
  onSelect,
}: {
  batch: BatchInfo
  isFirst: boolean
  onSelect?: () => void
}) {
  const [remaining, setRemaining] = useState(batch.tickDuration)

  useEffect(() => {
    setRemaining(batch.tickDuration)
    const interval = setInterval(() => {
      setRemaining(prev => (prev > 0 ? prev - 1 : 0))
    }, 1000)
    return () => clearInterval(interval)
  }, [batch.tickDuration, batch.currentTick])

  return (
    <button
      onClick={onSelect}
      className={`
        shrink-0 flex flex-col items-start px-5 py-4 rounded-lg
        border bg-white transition-all min-w-[220px]
        ${isFirst ? 'border-black border-2' : 'border-[var(--border)] hover:border-[#999]'}
      `}
    >
      {/* Header: batch name + badge */}
      <div className="flex items-center justify-between w-full mb-1">
        <span className="text-[11px] font-bold text-[var(--foreground)]">
          Batch #{batch.id.toLocaleString()}
        </span>
        {isFirst ? (
          <span className="text-[10px] font-bold uppercase tracking-wide text-green-600 bg-green-50 px-2 py-0.5 rounded">
            Live
          </span>
        ) : (
          <span className="text-[10px] font-bold uppercase tracking-wide text-[#999] bg-[var(--surface)] px-2 py-0.5 rounded">
            Next
          </span>
        )}
      </div>

      {/* Timer */}
      <span
        className="text-[28px] font-bold tabular-nums tracking-tight leading-tight"
        style={{ fontFamily: 'var(--mono)' }}
      >
        {formatTimer(remaining)}
      </span>

      {/* Stats */}
      <div className="flex items-center gap-3 mt-2 text-[10px] font-semibold text-[#999]">
        <span>{batch.playerCount} players</span>
        <span>TVL {formatTvl(batch.tvl)}</span>
        <span>{batch.marketCount} mkts</span>
      </div>
    </button>
  )
}

export function NextBatches({ onBatchSelect }: NextBatchesProps) {
  const { data: batches, isLoading } = useBatches()

  return (
    <div className="px-6 lg:px-12">
      <div className="max-w-site mx-auto">
        <div className="text-[10px] font-bold uppercase tracking-[0.12em] text-[#999] pt-4 pb-2">
          Next Batches
        </div>

        {isLoading ? (
          <div className="flex gap-3 pb-4 overflow-x-auto" style={{ scrollbarWidth: 'none' }}>
            {[0, 1, 2, 3].map(i => (
              <div key={i} className="skeleton shrink-0 w-[220px] h-[110px] rounded-lg" />
            ))}
          </div>
        ) : !batches || batches.length === 0 ? (
          <div className="flex gap-3 pb-4 overflow-x-auto" style={{ scrollbarWidth: 'none' }}>
            <div className="shrink-0 flex flex-col items-start px-5 py-4 rounded-lg border border-dashed border-[var(--border)] min-w-[220px]">
              <span className="text-[11px] font-bold text-[#999]">No active batches</span>
              <span className="text-[13px] text-[#999] mt-1">Waiting for batch creation...</span>
            </div>
          </div>
        ) : (
          <div
            className="flex gap-3 pb-4 overflow-x-auto"
            style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
          >
            {batches.map((batch, i) => (
              <BatchCard
                key={batch.id}
                batch={batch}
                isFirst={i === 0}
                onSelect={() => onBatchSelect?.(batch.id)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
