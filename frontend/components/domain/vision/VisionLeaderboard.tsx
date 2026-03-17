'use client'

import { useVisionLeaderboard } from '@/hooks/vision/useVisionLeaderboard'
import { AnimatedNumber } from '@/components/ui/AnimatedNumber'
import { Link } from '@/i18n/routing'

/**
 * Vision leaderboard showing player rankings by PnL.
 * Uses the /vision/leaderboard endpoint from the oracle API.
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
            <tr className="border-b border-border-medium text-micro font-mono text-text-muted uppercase tracking-[0.08em]">
              <th className="pb-3 pr-4">#</th>
              <th className="pb-3 pr-4">Player</th>
              <th className="pb-3 pr-4 text-right">PnL (USDC)</th>
              <th className="pb-3 pr-4 text-right">ROI</th>
              <th className="pb-3 pr-4 text-right">Volume</th>
              <th className="pb-3 text-right">Batches</th>
            </tr>
          </thead>
          <tbody>
            {leaderboard.map((entry, index) => {
              const pnlPositive = entry.pnl >= 0
              const isTop3 = entry.rank <= 3
              return (
                <tr
                  key={entry.walletAddress}
                  className={`border-b border-border-light hover:bg-surface hover:shadow-[inset_3px_0_0_#000] transition-all animate-row-in ${isTop3 ? 'bg-surface' : ''}`}
                  style={{ '--row-i': index } as React.CSSProperties}
                >
                  <td className={`py-3 pr-4 font-mono text-xs ${isTop3 ? 'text-text-primary font-black text-sm' : 'text-text-muted'}`}>
                    <AnimatedNumber value={entry.rank} decimals={0} duration={500} />
                  </td>
                  <td className="py-3 pr-4 font-mono text-xs">
                    <Link
                      href={`/profile/${entry.walletAddress}`}
                      className="hover:underline hover:text-black transition-colors"
                    >
                      {entry.walletAddress.slice(0, 6)}...{entry.walletAddress.slice(-4)}
                    </Link>
                  </td>
                  <td className={`py-3 pr-4 font-mono text-xs text-right font-bold ${pnlPositive ? 'text-color-up' : 'text-color-down'}`}>
                    <AnimatedNumber
                      value={entry.pnl}
                      duration={800}
                      formatFn={(v) => `${v >= 0 ? '+' : '-'}$${Math.abs(v).toFixed(2)}`}
                    />
                  </td>
                  <td className={`py-3 pr-4 font-mono text-xs text-right ${entry.roi >= 0 ? 'text-color-up' : 'text-color-down'}`}>
                    <AnimatedNumber
                      value={entry.roi}
                      duration={800}
                      formatFn={(v) => `${v >= 0 ? '+' : ''}${v.toFixed(1)}%`}
                    />
                  </td>
                  <td className="py-3 pr-4 font-mono text-xs text-right text-text-secondary">
                    <AnimatedNumber
                      value={entry.totalVolume}
                      duration={800}
                      formatFn={(v) => `$${v.toFixed(2)}`}
                    />
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
