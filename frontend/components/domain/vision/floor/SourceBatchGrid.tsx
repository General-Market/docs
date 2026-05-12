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
      <div
        className="flex items-baseline justify-between px-5 py-4"
        style={{ borderBottom: '1px solid var(--apple-border)' }}
      >
        <h2 className="floor-pane-header">Sources</h2>
        <span className="tabular-nums text-[11px] text-[#86868b]">{sorted.length}</span>
      </div>
      <div className="relative flex-1 overflow-y-auto px-3 py-3">
        {sorted.length === 0 ? (
          <div className="flex h-full items-center justify-center px-3 text-center">
            <p
              className="text-[13px] tracking-[-0.014em] text-[#6e6e73]"
              style={{ fontFamily: 'var(--apple-font-text)' }}
            >
              <span className="floor-breathe align-middle">·</span>
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
