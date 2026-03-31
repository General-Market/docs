'use client'

import { useState, useMemo } from 'react'
import { useTranslations } from 'next-intl'
import type { ProfileBatch, ProfileTick } from '@/hooks/usePlayerProfile'
import { useSourceRegistry, findSource } from '@/hooks/vision/useSourceRegistry'
import { TickSquares, TickSquaresLegend } from './TickSquares'
import { formatROI, formatPnL } from '@/lib/utils/formatters'

const PAGE_SIZE = 20

interface SourceGroup {
  sourceId: string
  totalDeposited: number
  totalBalance: number
  pnl: number
  roi: number
  rounds: number
  ticks: ProfileTick[]
  hasActive: boolean
  latestBatchId: number
}

function groupBySource(batches: ProfileBatch[]): SourceGroup[] {
  const map = new Map<string, SourceGroup>()
  for (const b of batches) {
    const key = b.sourceId
    let g = map.get(key)
    if (!g) {
      g = { sourceId: key, totalDeposited: 0, totalBalance: 0, pnl: 0, roi: 0, rounds: 0, ticks: [], hasActive: false, latestBatchId: 0 }
      map.set(key, g)
    }
    g.totalDeposited += b.deposited
    g.totalBalance += b.balance
    g.rounds += b.tickCount
    g.ticks.push(...b.ticks)
    if (b.status === 'active') g.hasActive = true
    if (b.batchId > g.latestBatchId) g.latestBatchId = b.batchId
  }
  for (const g of map.values()) {
    g.pnl = g.totalBalance - g.totalDeposited
    g.roi = g.totalDeposited > 0 ? (g.pnl / g.totalDeposited) * 100 : 0
  }
  // Sort: most recent activity first (latest batchId in group), active sources on top
  return Array.from(map.values()).sort((a, b) => {
    if (a.hasActive !== b.hasActive) return a.hasActive ? -1 : 1
    return b.latestBatchId - a.latestBatchId
  })
}

interface BatchTickHistoryProps {
  batches: ProfileBatch[]
}

export function BatchTickHistory({ batches }: BatchTickHistoryProps) {
  const t = useTranslations('common')
  const { sources: registrySources } = useSourceRegistry()
  const groups = useMemo(() => groupBySource(batches), [batches])
  return (
    <div>
      {/* Column headers */}
      <div className="flex items-center gap-3 px-3 py-2 text-micro font-semibold uppercase tracking-[0.08em] text-text-muted border-b border-border-light">
        <div className="w-[160px] shrink-0">{t('profile.batch')}</div>
        <div className="flex-1">{t('profile.round_history')}</div>
        <div className="w-[80px] shrink-0 text-right">P&L</div>
        <div className="w-[72px] shrink-0 text-right">{t('profile.roi')}</div>
      </div>

      {/* Grouped rows — scrollable, latest first */}
      <div className="max-h-[600px] overflow-y-auto">
      {groups.map((g) => {
        const pnlColor = g.pnl >= 0 ? 'text-color-up' : 'text-color-down'
        const sourceEntry = findSource(registrySources, g.sourceId)
        return (
          <div key={g.sourceId} className="flex items-center gap-3 px-3 py-2.5 hover:bg-surface transition-colors border-b border-border-light last:border-b-0">
            <div className="w-[160px] shrink-0">
              <div className="flex items-center gap-2">
                {sourceEntry?.logo && (
                  <div
                    className="w-7 h-7 rounded flex items-center justify-center shrink-0"
                    style={{ background: sourceEntry.brandBg ?? '#f5f5f5' }}
                  >
                    <img src={sourceEntry.logo} alt="" className="w-4 h-4 object-contain" />
                  </div>
                )}
                <div className="text-caption font-semibold text-black truncate">
                  {sourceEntry?.name ?? g.sourceId}
                </div>
              </div>
              <div className="flex items-center gap-1.5 mt-0.5">
                {g.hasActive && (
                  <span className="text-[9px] font-bold uppercase px-1.5 py-0.5 rounded bg-green-100 text-green-700">
                    {t('profile.active')}
                  </span>
                )}
              </div>
              <div className="text-micro text-text-muted mt-0.5">
                {g.rounds} rounds &middot; ${g.totalDeposited.toFixed(0)} vol
              </div>
            </div>
            <TickSquares ticks={g.ticks} />
            <div className={`w-[80px] shrink-0 text-right text-caption font-mono font-bold ${pnlColor}`}>
              {formatPnL(g.pnl)}
            </div>
            <div className={`w-[72px] shrink-0 text-right text-body font-mono font-extrabold ${pnlColor}`}>
              {formatROI(g.roi)}
            </div>
          </div>
        )
      })}

      </div>

      {/* Footer */}
      <div className="px-3 py-2 border-t border-border-light">
        <TickSquaresLegend />
      </div>
    </div>
  )
}
