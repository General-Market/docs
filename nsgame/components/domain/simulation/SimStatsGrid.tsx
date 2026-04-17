'use client'

import { useTranslations } from 'next-intl'
import type { SimStats } from '@/hooks/useSimulation'

interface SimStatsGridProps {
  stats: SimStats
}

export function SimStatsGrid({ stats }: SimStatsGridProps) {
  const t = useTranslations('backtest')

  const items = [
    {
      label: t('stats.total_return'),
      value: `${stats.total_return_pct >= 0 ? '+' : ''}${stats.total_return_pct.toFixed(2)}%`,
      color: stats.total_return_pct >= 0 ? 'text-color-up' : 'text-color-down',
    },
    {
      label: t('stats.annualized'),
      value: `${stats.annualized_return >= 0 ? '+' : ''}${stats.annualized_return.toFixed(2)}%`,
      color: stats.annualized_return >= 0 ? 'text-color-up' : 'text-color-down',
    },
    {
      label: t('stats.max_drawdown'),
      value: `${stats.max_drawdown_pct.toFixed(2)}%`,
      color: 'text-color-down',
    },
    {
      label: t('stats.sharpe_ratio'),
      value: stats.sharpe_ratio.toFixed(3),
      color: stats.sharpe_ratio >= 1 ? 'text-color-up' : stats.sharpe_ratio >= 0 ? 'text-text-primary' : 'text-color-down',
    },
    {
      label: t('stats.total_fees'),
      value: `${stats.total_fees_pct.toFixed(2)}%`,
      color: 'text-text-secondary',
    },
    {
      label: t('stats.trades'),
      value: String(stats.total_trades),
      color: 'text-text-secondary',
    },
    {
      label: t('stats.rebalances'),
      value: String(stats.total_rebalances),
      color: 'text-text-secondary',
    },
    {
      label: t('stats.delistings'),
      value: String(stats.total_delistings),
      color: stats.total_delistings > 0 ? 'text-color-warning' : 'text-text-secondary',
    },
    {
      label: t('stats.period'),
      value: stats.start_date && stats.end_date
        ? t('stats.period_range', { start: stats.start_date, end: stats.end_date })
        : t('stats.na'),
      color: 'text-text-muted',
    },
  ]

  return (
    <div className="grid grid-cols-3 md:grid-cols-5 gap-4 mb-6">
      {items.map(item => (
        <div key={item.label} className="bg-white rounded-xl shadow-card border border-border-light p-6 text-center">
          <div className="text-xs font-medium uppercase tracking-[0.08em] text-text-muted">{item.label}</div>
          <div className={`text-2xl font-bold tabular-nums font-mono mt-1 ${item.color}`}>{item.value}</div>
        </div>
      ))}
    </div>
  )
}
