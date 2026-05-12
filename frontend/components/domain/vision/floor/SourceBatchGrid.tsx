'use client'

import { useFloorBatches } from '@/hooks/vision/useFloorStream'
import { SourceBatchCard } from './SourceBatchCard'

export function SourceBatchGrid() {
  const batches = useFloorBatches()

  const sorted = batches.slice().sort((a, b) => {
    const aEnd = a.bettingEnd ?? Number.POSITIVE_INFINITY
    const bEnd = b.bettingEnd ?? Number.POSITIVE_INFINITY
    return aEnd - bEnd
  })

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-baseline justify-between border-b border-black/[0.06] px-4 py-3">
        <h2 className="text-[10px] font-semibold uppercase tracking-[0.08em] text-[#86868b]">
          Sources
        </h2>
        <span className="tabular-nums text-[10px] text-[#86868b]">{sorted.length}</span>
      </div>
      <div className="relative flex-1 overflow-y-auto px-3 py-3">
        {sorted.length === 0 ? (
          <div className="flex h-full items-center justify-center px-3 text-center">
            <p className="text-[12px] tracking-[-0.01em] text-[#86868b]">
              <span className="floor-breathe inline-block align-middle">·</span>
              <span className="ml-2 align-middle">Waiting for batches.</span>
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {sorted.map(b => (
              <SourceBatchCard key={`${b.sourceId}-${b.batchId}`} batch={b} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
