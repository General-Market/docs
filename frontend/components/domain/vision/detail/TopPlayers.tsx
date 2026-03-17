'use client'

import { useVisionLeaderboard } from '@/hooks/vision/useVisionLeaderboard'

function truncateAddress(address: string): string {
  if (!address || address.length < 12) return address || '--'
  return `${address.slice(0, 6)}...${address.slice(-4)}`
}

function formatPnl(pnl: number): { text: string; color: string } {
  const safePnl = Number.isFinite(pnl) ? pnl : 0
  if (safePnl === 0) return { text: '$0.00', color: 'text-text-muted' }
  const sign = safePnl > 0 ? '+' : ''
  const color = safePnl > 0 ? 'text-color-up' : 'text-color-down'
  return { text: `${sign}$${Math.abs(safePnl).toFixed(2)}`, color }
}

function formatVolume(vol: number): string {
  const safeVol = Number.isFinite(vol) ? vol : 0
  if (safeVol === 0) return '$0'
  if (safeVol >= 1000) return `$${(safeVol / 1000).toFixed(1)}K`
  return `$${safeVol.toFixed(0)}`
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
      <div className="bg-white border border-t-0 border-border-light overflow-hidden stagger">
        {/* Header */}
        <div className="grid grid-cols-[36px_1fr_60px_70px_80px_90px] items-center px-4 py-2 border-b border-border-light text-micro font-bold uppercase tracking-[0.08em] text-text-muted">
          <div>#</div>
          <div>Player</div>
          <div className="text-right">Batches</div>
          <div className="text-right">Volume</div>
          <div className="text-right">Profitable</div>
          <div className="text-right">P&L</div>
        </div>

        {isLoading && (
          <div className="px-4 py-4 space-y-1.5">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="h-8 bg-surface animate-pulse rounded" />
            ))}
          </div>
        )}

        {!isLoading && top5.length === 0 && (
          <div className="px-4 py-6 text-center text-caption text-text-muted font-mono">
            No one has played. The market waits.
          </div>
        )}

        {top5.map((player, i) => {
          const pnl = formatPnl(player.pnl)
          return (
            <div
              key={player.walletAddress}
              className={`grid grid-cols-[36px_1fr_60px_70px_80px_90px] items-center px-4 py-2.5 border-b border-border-light text-caption animate-fade-up ${
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
                {(Number.isFinite(player.winRate) ? player.winRate : 0).toFixed(1)}%
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
