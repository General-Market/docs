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
      color: stats.total_return_pct >= 0 ? 'text-green-400' : 'text-accent',
    },
    {
      label: 'Annualized',
      value: `${stats.annualized_return >= 0 ? '+' : ''}${stats.annualized_return.toFixed(2)}%`,
      color: stats.annualized_return >= 0 ? 'text-green-400' : 'text-accent',
    },
    {
      label: 'Max Drawdown',
      value: `${stats.max_drawdown_pct.toFixed(2)}%`,
      color: 'text-accent',
    },
    {
      label: 'Sharpe Ratio',
      value: stats.sharpe_ratio.toFixed(3),
      color: stats.sharpe_ratio >= 1 ? 'text-green-400' : stats.sharpe_ratio >= 0 ? 'text-white' : 'text-accent',
    },
    {
      label: 'Total Fees',
      value: `${stats.total_fees_pct.toFixed(2)}%`,
      color: 'text-white/70',
    },
    {
      label: 'Trades',
      value: String(stats.total_trades),
      color: 'text-white/70',
    },
    {
      label: 'Rebalances',
      value: String(stats.total_rebalances),
      color: 'text-white/70',
    },
    {
      label: 'Delistings',
      value: String(stats.total_delistings),
      color: stats.total_delistings > 0 ? 'text-yellow-400' : 'text-white/70',
    },
    {
      label: 'Period',
      value: stats.start_date && stats.end_date
        ? `${stats.start_date} to ${stats.end_date}`
        : 'N/A',
      color: 'text-white/50',
    },
  ]

  return (
    <div className="grid grid-cols-3 md:grid-cols-5 gap-3 mb-4">
      {items.map(item => (
        <div key={item.label} className="bg-white/5 rounded p-2">
          <div className="text-[10px] text-white/40 font-mono uppercase">{item.label}</div>
          <div className={`text-sm font-mono font-bold ${item.color}`}>{item.value}</div>
        </div>
      ))}
    </div>
  )
}
