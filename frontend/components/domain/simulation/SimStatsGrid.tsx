'use client'

import type { SimStats } from '@/hooks/useSimulation'

interface SimStatsGridProps {
  stats: SimStats
}

export function SimStatsGrid({ stats }: SimStatsGridProps) {
  const items = [
    {
      label: 'Total Return',
      value: `${stats.total_return_pct >= 0 ? '+' : ''}${stats.total_return_pct.toFixed(2)}%`,
      color: stats.total_return_pct >= 0 ? 'text-color-up' : 'text-color-down',
    },
    {
      label: 'Annualized',
      value: `${stats.annualized_return >= 0 ? '+' : ''}${stats.annualized_return.toFixed(2)}%`,
      color: stats.annualized_return >= 0 ? 'text-color-up' : 'text-color-down',
    },
    {
      label: 'Max Drawdown',
      value: `${stats.max_drawdown_pct.toFixed(2)}%`,
      color: 'text-color-down',
    },
    {
      label: 'Sharpe Ratio',
      value: stats.sharpe_ratio.toFixed(3),
      color: stats.sharpe_ratio >= 1 ? 'text-color-up' : stats.sharpe_ratio >= 0 ? 'text-text-primary' : 'text-color-down',
    },
    {
      label: 'Total Fees',
      value: `${stats.total_fees_pct.toFixed(2)}%`,
      color: 'text-text-secondary',
    },
    {
      label: 'Trades',
      value: String(stats.total_trades),
      color: 'text-text-secondary',
    },
    {
      label: 'Rebalances',
      value: String(stats.total_rebalances),
      color: 'text-text-secondary',
    },
    {
      label: 'Delistings',
      value: String(stats.total_delistings),
      color: stats.total_delistings > 0 ? 'text-color-warning' : 'text-text-secondary',
    },
    {
      label: 'Period',
      value: stats.start_date && stats.end_date
        ? `${stats.start_date} to ${stats.end_date}`
        : 'N/A',
      color: 'text-text-muted',
    },
  ]

  return (
    <div className="grid grid-cols-3 md:grid-cols-5 gap-4 mb-6">
      {items.map(item => (
        <div key={item.label} className="bg-white rounded-xl shadow-card border border-border-light p-6 text-center">
          <div className="text-xs font-medium uppercase tracking-widest text-text-muted">{item.label}</div>
          <div className={`text-2xl font-bold tabular-nums font-mono mt-1 ${item.color}`}>{item.value}</div>
        </div>
      ))}
    </div>
  )
}
