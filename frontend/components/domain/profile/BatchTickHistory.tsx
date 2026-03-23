'use client'

import { useState, useMemo } from 'react'
import { useTranslations } from 'next-intl'
import type { ProfileBatch, ProfileTick } from '@/hooks/usePlayerProfile'
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
}

function groupBySource(batches: ProfileBatch[]): SourceGroup[] {
  const map = new Map<string, SourceGroup>()
  for (const b of batches) {
    const key = b.sourceId
    let g = map.get(key)
    if (!g) {
      g = { sourceId: key, totalDeposited: 0, totalBalance: 0, pnl: 0, roi: 0, rounds: 0, ticks: [], hasActive: false }
      map.set(key, g)
    }
    g.totalDeposited += b.deposited
    g.totalBalance += b.balance
    g.rounds += b.tickCount
    g.ticks.push(...b.ticks)
    if (b.status === 'active') g.hasActive = true
  }
  for (const g of map.values()) {
    g.pnl = g.totalBalance - g.totalDeposited
    g.roi = g.totalDeposited > 0 ? (g.pnl / g.totalDeposited) * 100 : 0
  }
  // Sort: biggest absolute PnL first
  return Array.from(map.values()).sort((a, b) => Math.abs(b.pnl) - Math.abs(a.pnl))
}

interface BatchTickHistoryProps {
  batches: ProfileBatch[]
}

export function BatchTickHistory({ batches }: BatchTickHistoryProps) {
  const t = useTranslations('common')
  const groups = useMemo(() => groupBySource(batches), [batches])
  const [visible, setVisible] = useState(PAGE_SIZE)
  const shown = groups.slice(0, visible)
  const hasMore = visible < groups.length

  return (
    <div>
      {/* Column headers */}
      <div className="flex items-center gap-3 px-3 py-2 text-micro font-semibold uppercase tracking-[0.08em] text-text-muted border-b border-border-light">
        <div className="w-[160px] shrink-0">{t('profile.batch')}</div>
        <div className="flex-1">{t('profile.round_history')}</div>
        <div className="w-[80px] shrink-0 text-right">P&L</div>
        <div className="w-[72px] shrink-0 text-right">{t('profile.roi')}</div>
      </div>

      {/* Grouped rows */}
      {shown.map((g) => {
        const pnlColor = g.pnl >= 0 ? 'text-color-up' : 'text-color-down'
        return (
          <div key={g.sourceId} className="flex items-center gap-3 px-3 py-2.5 hover:bg-surface transition-colors border-b border-border-light last:border-b-0">
            <div className="w-[160px] shrink-0">
              <div className="text-caption font-semibold text-black truncate">{g.sourceId}</div>
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

      {/* Footer */}
      <div className="px-3 py-2 border-t border-border-light flex items-center justify-between">
        <TickSquaresLegend />
        {hasMore && (
          <button
            onClick={() => setVisible(v => v + PAGE_SIZE)}
            className="text-label font-bold text-black hover:underline"
          >
            Show more ({groups.length - visible} remaining)
          </button>
        )}
      </div>
    </div>
  )
}
