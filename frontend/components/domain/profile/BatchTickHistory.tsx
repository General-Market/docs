'use client'

import type { ProfileBatch } from '@/hooks/usePlayerProfile'
import { BatchTickRow } from './BatchTickRow'
import { TickSquaresLegend } from './TickSquares'

interface BatchTickHistoryProps {
  batches: ProfileBatch[]
}

export function BatchTickHistory({ batches }: BatchTickHistoryProps) {
  return (
    <div>
      {/* Column headers */}
      <div className="flex items-center gap-3 px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.08em] text-text-muted border-b border-border-light">
        <div className="w-[140px] shrink-0">Batch</div>
        <div className="flex-1">Tick History</div>
        <div className="w-[72px] shrink-0 text-right">ROI</div>
      </div>

      {/* Rows */}
      {batches.map((batch) => (
        <BatchTickRow key={`${batch.sourceId}-${batch.batchId}`} batch={batch} />
      ))}

      {/* Legend */}
      <div className="px-3 py-2 border-t border-border-light">
        <TickSquaresLegend />
      </div>
    </div>
  )
}
