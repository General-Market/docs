'use client'

import { useFloorBatches } from '@/hooks/vision/useFloorStream'
import { SourceBatchCard } from './SourceBatchCard'

export function SourceBatchGrid() {
  const batches = useFloorBatches()

  if (batches.length === 0) {
    return (
      <div className="flex h-full items-center justify-center px-6 text-center">
        <p className="text-[12px] tracking-[-0.01em] text-[#86868b]">
          Waiting for batches.
        </p>
      </div>
    )
  }

  const sorted = batches.slice().sort((a, b) => {
    const aEnd = a.bettingEnd ?? Number.POSITIVE_INFINITY
    const bEnd = b.bettingEnd ?? Number.POSITIVE_INFINITY
    return aEnd - bEnd
  })

  return (
    <div className="h-full overflow-y-auto px-3 py-3">
      <div className="mb-3 px-1">
        <h2 className="text-[10px] font-semibold uppercase tracking-[0.08em] text-[#86868b]">
          Sources
        </h2>
        <p className="mt-0.5 text-[11px] text-[#86868b]">{sorted.length} live</p>
      </div>
      <div className="flex flex-col gap-2">
        {sorted.map(b => (
          <SourceBatchCard key={`${b.sourceId}-${b.batchId}`} batch={b} />
        ))}
      </div>
    </div>
  )
}
