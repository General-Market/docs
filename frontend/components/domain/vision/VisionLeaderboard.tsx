'use client'

import { useVisionLeaderboard } from '@/hooks/vision/useVisionLeaderboard'

/**
 * Vision leaderboard showing player rankings by PnL.
 * Uses the /vision/leaderboard endpoint from the issuer API.
 */
export function VisionLeaderboard() {
  const { leaderboard, isLoading, isError } = useVisionLeaderboard()

  if (isLoading) {
    return (
      <div className="py-8">
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-12 bg-surface rounded-card animate-pulse" />
          ))}
        </div>
      </div>
    )
  }

  if (isError || leaderboard.length === 0) {
    return (
      <div className="py-8 text-center">
        <p className="text-text-muted font-mono text-sm">
          {isError ? 'Failed to load leaderboard' : 'No players yet — join a batch to compete'}
        </p>
      </div>
    )
  }

  return (
    <div className="py-6">
      <div className="overflow-x-auto">
        <table className="w-full text-left">
          <thead>
            <tr className="border-b border-border-medium text-[10px] font-mono text-text-muted uppercase tracking-wider">
              <th className="pb-3 pr-4">#</th>
              <th className="pb-3 pr-4">Player</th>
              <th className="pb-3 pr-4 text-right">PnL (USDC)</th>
              <th className="pb-3 pr-4 text-right">ROI</th>
              <th className="pb-3 pr-4 text-right">Volume</th>
              <th className="pb-3 text-right">Batches</th>
            </tr>
          </thead>
          <tbody>
            {leaderboard.map((entry) => {
              const pnlPositive = entry.pnl >= 0
              return (
                <tr
                  key={entry.walletAddress}
                  className="border-b border-border-light hover:bg-surface transition-colors"
                >
                  <td className="py-3 pr-4 font-mono text-xs text-text-muted">
                    {entry.rank}
                  </td>
                  <td className="py-3 pr-4 font-mono text-xs">
                    {entry.walletAddress.slice(0, 6)}...{entry.walletAddress.slice(-4)}
                  </td>
                  <td className={`py-3 pr-4 font-mono text-xs text-right font-bold ${pnlPositive ? 'text-color-up' : 'text-color-down'}`}>
                    {pnlPositive ? '+' : '-'}${Math.abs(entry.pnl).toFixed(2)}
                  </td>
                  <td className={`py-3 pr-4 font-mono text-xs text-right ${entry.roi >= 0 ? 'text-color-up' : 'text-color-down'}`}>
                    {entry.roi >= 0 ? '+' : ''}{entry.roi.toFixed(1)}%
                  </td>
                  <td className="py-3 pr-4 font-mono text-xs text-right text-text-secondary">
                    ${entry.totalVolume.toFixed(2)}
                  </td>
                  <td className="py-3 font-mono text-xs text-right text-text-secondary">
                    {entry.portfolioBets}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
