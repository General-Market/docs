'use client'

import type { SimStats } from '@/hooks/useSimulation'

interface SweepVariant {
  variant: string
  stats: SimStats
}

interface SimSweepStatsTableProps {
  variants: SweepVariant[]
}

export function SimSweepStatsTable({ variants }: SimSweepStatsTableProps) {
  if (!variants.length) return null

  // Sort by total return descending
  const sorted = [...variants].sort((a, b) => b.stats.total_return_pct - a.stats.total_return_pct)

  // Find best values for highlighting
  const bestReturn = Math.max(...sorted.map(v => v.stats.total_return_pct))
  const bestSharpe = Math.max(...sorted.map(v => v.stats.sharpe_ratio))
  const bestDrawdown = Math.max(...sorted.map(v => v.stats.max_drawdown_pct)) // least negative

  return (
    <div className="overflow-x-auto mb-4">
      <table className="w-full">
        <thead>
          <tr className="text-white/60 text-[10px] font-mono border-b border-white/10 uppercase">
            <th className="text-left pb-2 pr-3">Variant</th>
            <th className="text-right pb-2 pr-3">Return</th>
            <th className="text-right pb-2 pr-3">Annual.</th>
            <th className="text-right pb-2 pr-3">Max DD</th>
            <th className="text-right pb-2 pr-3">Sharpe</th>
            <th className="text-right pb-2 pr-3">Fees</th>
            <th className="text-right pb-2">Trades</th>
          </tr>
        </thead>
        <tbody>
          {sorted.map(v => (
            <tr key={v.variant} className="border-b border-white/5 hover:bg-white/5">
              <td className="py-1.5 pr-3 text-white text-xs font-mono font-bold">
                {v.variant}
              </td>
              <td className={`py-1.5 pr-3 text-right text-xs font-mono ${
                v.stats.total_return_pct === bestReturn ? 'text-green-400 font-bold' :
                v.stats.total_return_pct >= 0 ? 'text-green-400' : 'text-accent'
              }`}>
                {v.stats.total_return_pct >= 0 ? '+' : ''}{v.stats.total_return_pct.toFixed(2)}%
              </td>
              <td className={`py-1.5 pr-3 text-right text-xs font-mono ${
                v.stats.annualized_return >= 0 ? 'text-green-400' : 'text-accent'
              }`}>
                {v.stats.annualized_return >= 0 ? '+' : ''}{v.stats.annualized_return.toFixed(2)}%
              </td>
              <td className={`py-1.5 pr-3 text-right text-xs font-mono ${
                v.stats.max_drawdown_pct === bestDrawdown ? 'text-green-400 font-bold' : 'text-accent'
              }`}>
                {v.stats.max_drawdown_pct.toFixed(2)}%
              </td>
              <td className={`py-1.5 pr-3 text-right text-xs font-mono ${
                v.stats.sharpe_ratio === bestSharpe ? 'text-green-400 font-bold' :
                v.stats.sharpe_ratio >= 1 ? 'text-green-400' :
                v.stats.sharpe_ratio >= 0 ? 'text-white' : 'text-accent'
              }`}>
                {v.stats.sharpe_ratio.toFixed(3)}
              </td>
              <td className="py-1.5 pr-3 text-right text-white/60 text-xs font-mono">
                {v.stats.total_fees_pct.toFixed(2)}%
              </td>
              <td className="py-1.5 text-right text-white/60 text-xs font-mono">
                {v.stats.total_trades}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
