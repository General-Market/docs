'use client'

import { useMemo } from 'react'
import { useTranslations } from 'next-intl'
import type { PlayerProfile } from '@/hooks/usePlayerProfile'
import { PositionsList } from './PositionsList'
import { BatchTickHistory } from './BatchTickHistory'
import { formatPnL, formatVolume } from '@/lib/utils/formatters'

interface VisionTabProps {
  profile: PlayerProfile
}

interface Metric {
  label: string
  value: string
  color?: string
}

function VisionSummary({ metrics }: { metrics: Metric[] }) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-px bg-border-light border border-border-light rounded-lg overflow-hidden">
      {metrics.map((m) => (
        <div key={m.label} className="bg-white px-5 py-4">
          <div className="text-micro text-text-muted uppercase tracking-wider font-semibold">
            {m.label}
          </div>
          <div
            className={`text-[20px] font-black font-mono tabular-nums mt-1 ${m.color ?? 'text-black'}`}
          >
            {m.value}
          </div>
        </div>
      ))}
    </div>
  )
}

export function VisionTab({ profile }: VisionTabProps) {
  const t = useTranslations('common')

  const summary = useMemo(() => {
    const active = profile.batches.filter((b) => b.status === 'active')
    const portfolioValue =
      active.reduce((s, b) => s + (b.balance ?? 0), 0) ||
      profile.batches.reduce((s, b) => s + (b.balance ?? 0), 0)
    const wagered = profile.stats?.totalDeposited ?? 0
    const pnl = profile.stats?.pnl ?? 0
    const winRate = profile.stats?.winRate
    return { portfolioValue, wagered, pnl, winRate, rounds: profile.batches.length }
  }, [profile])

  const pnlColor = summary.pnl >= 0 ? 'text-color-up' : 'text-color-down'
  const winRateLabel =
    typeof summary.winRate === 'number'
      ? `${(summary.winRate * 100).toFixed(1)}%`
      : '—'

  const metrics: Metric[] = [
    { label: t('profile.portfolio_value'), value: formatVolume(summary.portfolioValue) },
    { label: t('profile.pnl'), value: formatPnL(summary.pnl), color: pnlColor },
    { label: t('profile.wagered'), value: formatVolume(summary.wagered) },
    { label: t('profile.win_rate'), value: winRateLabel },
  ]

  if (profile.batches.length === 0) {
    return (
      <div className="space-y-6">
        <VisionSummary metrics={metrics} />
        <div className="py-16 text-center">
          <div className="text-caption text-text-muted">
            {t('profile.no_vision_history')}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <VisionSummary metrics={metrics} />
      <PositionsList batches={profile.batches} />
      <div className="border border-border-light rounded overflow-hidden">
        <BatchTickHistory batches={profile.batches} />
      </div>
    </div>
  )
}
