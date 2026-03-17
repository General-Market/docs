'use client'

import { useVisionLeaderboard } from '@/hooks/vision/useVisionLeaderboard'

function truncateAddress(address: string): string {
  if (!address || address.length < 12) return address || '--'
  return `${address.slice(0, 6)}...${address.slice(-4)}`
}

function formatPnl(pnl: number): { text: string; color: string } {
  if (pnl === 0) return { text: '$0.00', color: 'text-text-muted' }
  const sign = pnl > 0 ? '+' : ''
  const color = pnl > 0 ? 'text-green-600' : 'text-red-600'
  return { text: `${sign}$${Math.abs(pnl).toFixed(2)}`, color }
}

function formatVolume(vol: number): string {
  if (vol === 0) return '$0'
  if (vol >= 1000) return `$${(vol / 1000).toFixed(1)}K`
  return `$${vol.toFixed(0)}`
}

export function TopPlayers({ batchId, sourceId }: { batchId?: number; sourceId?: string }) {
  const { leaderboard, isLoading } = useVisionLeaderboard(batchId, sourceId)
  const top5 = leaderboard.slice(0, 5)

  return (
    <div className="mt-6">
      {/* Section bar */}
      <div className="section-bar">
        <div>
          <div className="section-bar-title">Top Players</div>
          <div className="section-bar-value">Leaderboard</div>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white border border-t-0 border-border-light overflow-hidden">
        {/* Header */}
        <div className="grid grid-cols-[36px_1fr_72px_72px_80px_80px] gap-x-3 items-center px-4 py-2 border-b border-border-light text-micro font-bold uppercase tracking-[0.08em] text-text-muted">
          <div>#</div>
          <div>Player</div>
          <div className="text-right">Batches</div>
          <div className="text-right">Volume</div>
          <div className="text-right">Win %</div>
          <div className="text-right">P&L</div>
        </div>

        {isLoading && (
          <div className="px-4 py-6 text-center text-caption text-text-muted">
            Loading leaderboard...
          </div>
        )}

        {!isLoading && top5.length === 0 && (
          <div className="px-4 py-6 text-center text-caption text-text-muted">
            No players yet
          </div>
        )}

        {top5.map((player, i) => {
          const pnl = formatPnl(player.pnl)
          return (
            <div
              key={player.walletAddress}
              className={`grid grid-cols-[36px_1fr_72px_72px_80px_80px] gap-x-3 items-center px-4 py-2.5 border-b border-border-light text-caption ${
                i % 2 === 1 ? 'bg-surface/40' : ''
              }`}
            >
              <div className="font-bold text-text-muted">
                {player.rank || i + 1}
              </div>
              <div className="font-mono text-caption text-black font-medium truncate">
                {truncateAddress(player.walletAddress)}
              </div>
              <div className="text-right font-mono tabular-nums text-caption text-text-muted">
                {player.totalBets || 0}
              </div>
              <div className="text-right font-mono tabular-nums text-caption text-text-muted">
                {formatVolume(player.volume || 0)}
              </div>
              <div className="text-right font-mono tabular-nums font-semibold text-black">
                {player.winRate.toFixed(1)}%
              </div>
              <div className={`text-right font-mono tabular-nums font-semibold ${pnl.color}`}>
                {pnl.text}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
