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
    <div className="border-t-[3px] border-b border-black border-b-border-light bg-surface mb-6">
      <div className="grid grid-cols-3 md:grid-cols-5 divide-x divide-border-light stagger">
        {items.map(item => (
          <div key={item.label} className="px-4 py-4 animate-fade-up hover-lift">
            <div className="text-micro font-semibold uppercase tracking-[0.08em] text-text-muted">{item.label}</div>
            <div className={`text-lg font-bold tabular-nums font-mono mt-0.5 ${item.color}`}>{item.value}</div>
          </div>
        ))}
      </div>
    </div>
  )
}
