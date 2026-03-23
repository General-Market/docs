'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import type { ProfileBatch } from '@/hooks/usePlayerProfile'
import { BatchTickRow } from './BatchTickRow'
import { TickSquaresLegend } from './TickSquares'

const PAGE_SIZE = 20

interface BatchTickHistoryProps {
  batches: ProfileBatch[]
}

export function BatchTickHistory({ batches }: BatchTickHistoryProps) {
  const t = useTranslations('common')
  const [visible, setVisible] = useState(PAGE_SIZE)
  const shown = batches.slice(0, visible)
  const hasMore = visible < batches.length

  return (
    <div>
      {/* Column headers */}
      <div className="flex items-center gap-3 px-3 py-2 text-micro font-semibold uppercase tracking-[0.08em] text-text-muted border-b border-border-light">
        <div className="w-[140px] shrink-0">{t('profile.batch')}</div>
        <div className="flex-1">{t('profile.round_history')}</div>
        <div className="w-[72px] shrink-0 text-right">{t('profile.roi')}</div>
      </div>

      {/* Rows — paginated */}
      {shown.map((batch) => (
        <BatchTickRow key={`${batch.sourceId}-${batch.batchId}`} batch={batch} />
      ))}

      {/* Load more / Legend */}
      <div className="px-3 py-2 border-t border-border-light flex items-center justify-between">
        <TickSquaresLegend />
        {hasMore && (
          <button
            onClick={() => setVisible(v => v + PAGE_SIZE)}
            className="text-label font-bold text-black hover:underline"
          >
            Show more ({batches.length - visible} remaining)
          </button>
        )}
      </div>
    </div>
  )
}
