'use client'

import { useMemo } from 'react'
import { useTranslations } from 'next-intl'
import type { PlayerProfile, ProfileBatch } from '@/hooks/usePlayerProfile'
import { useSourceRegistry, findSource } from '@/hooks/vision/useSourceRegistry'
import { formatPnL } from '@/lib/utils/formatters'
import { PnlChart } from './PnlChart'
import { BatchTickHistory } from './BatchTickHistory'
import Link from 'next/link'

interface VisionTabProps {
  profile: PlayerProfile
}

function OpenPositions({ batches }: { batches: ProfileBatch[] }) {
  const { sources } = useSourceRegistry()

  if (batches.length === 0) return null

  return (
    <div>
      <div className="section-bar">
        <div>
          <div className="section-bar-title">Open Positions</div>
          <div className="section-bar-value">{batches.length}</div>
        </div>
      </div>
      <div className="bg-white border border-t-0 border-border-light">
        {batches.map((b) => {
          const sourceEntry = findSource(sources, b.sourceId)
          const pnl = b.balance - b.deposited
          const pnlColor = pnl >= 0 ? 'text-color-up' : 'text-color-down'

          return (
            <Link
              key={`${b.sourceId}-${b.batchId}`}
              href={`/source/${b.sourceId}`}
              className="flex items-center gap-4 px-4 py-3 border-b border-border-light last:border-b-0 hover:bg-surface/50 transition-colors"
            >
              {/* Source logo */}
              {sourceEntry?.logo && (
                <div
                  className="w-8 h-8 rounded flex items-center justify-center shrink-0"
                  style={{ background: sourceEntry.brandBg ?? '#000' }}
                >
                  <img src={sourceEntry.logo} alt="" className="w-5 h-5 object-contain" />
                </div>
              )}

              {/* Source + batch info */}
              <div className="flex-1 min-w-0">
                <div className="text-caption font-semibold text-black truncate">
                  {sourceEntry?.name ?? b.sourceId}
                </div>
                <div className="text-micro text-text-muted mt-0.5">
                  Round #{b.batchId} &middot; {b.tickCount} ticks
                </div>
              </div>

              {/* Deposit */}
              <div className="shrink-0 text-right">
                <div className="text-[15px] font-black font-mono tabular-nums text-black">
                  ${b.deposited.toFixed(2)}
                </div>
                <div className="text-micro text-text-muted">deposited</div>
              </div>

              {/* P&L so far */}
              <div className="shrink-0 text-right w-[80px]">
                <div className={`text-caption font-mono font-bold ${pnlColor}`}>
                  {formatPnL(pnl)}
                </div>
                <div className="text-micro text-text-muted">current</div>
              </div>

              {/* Live indicator */}
              <span className="relative flex h-2 w-2 shrink-0">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-color-up opacity-50" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-color-up" />
              </span>
            </Link>
          )
        })}
      </div>
    </div>
  )
}

export function VisionTab({ profile }: VisionTabProps) {
  const t = useTranslations('common')

  const activeBatches = useMemo(
    () => profile.batches.filter(b => b.status === 'active'),
    [profile.batches],
  )

  if (profile.batches.length === 0 && profile.pnlHistory.length === 0) {
    return (
      <div className="py-16 text-center">
        <div className="text-caption text-text-muted">{t('profile.no_vision_history')}</div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <OpenPositions batches={activeBatches} />
      <PnlChart history={profile.pnlHistory} />
      {profile.batches.length > 0 && (
        <div className="border border-border-light rounded overflow-hidden">
          <BatchTickHistory batches={profile.batches} />
        </div>
      )}
    </div>
  )
}
