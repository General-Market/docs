'use client'

import { useTranslations } from 'next-intl'
import type { ProfileBatch } from '@/hooks/usePlayerProfile'
import { TickSquares } from './TickSquares'
import { formatROI } from '@/lib/utils/formatters'

interface BatchTickRowProps {
  batch: ProfileBatch
}

export function BatchTickRow({ batch }: BatchTickRowProps) {
  const t = useTranslations('common')
  const roiColor = batch.roi >= 0 ? 'text-color-up' : 'text-color-down'
  const statusColor =
    batch.status === 'active'
      ? 'bg-green-100 text-green-700'
      : 'bg-gray-100 text-gray-500'

  return (
    <div className="flex items-center gap-3 px-3 py-2.5 hover:bg-surface transition-colors border-b border-border-light last:border-b-0">
      {/* Batch info */}
      <div className="w-[140px] shrink-0">
        <div className="text-caption font-semibold text-black truncate">
          {batch.sourceId} #{batch.batchId}
        </div>
        <div className="flex items-center gap-1.5 mt-0.5">
          <span className={`text-[9px] font-bold uppercase px-1.5 py-0.5 rounded ${statusColor}`}>
            {batch.status === 'active' ? t('profile.active') : t('profile.exited')}
          </span>
        </div>
        <div className="text-micro text-text-muted mt-0.5">
          {t('profile.ticks_count', { tickCount: batch.tickCount })} &middot; {t('profile.deposited_in', { deposited: batch.deposited.toFixed(0) })}
        </div>
      </div>

      {/* Tick squares */}
      <TickSquares ticks={batch.ticks} />

      {/* ROI */}
      <div className={`w-[72px] shrink-0 text-right text-body font-mono font-extrabold ${roiColor}`}>
        {formatROI(batch.roi)}
      </div>
    </div>
  )
}
