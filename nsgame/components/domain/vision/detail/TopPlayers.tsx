'use client'

import { useVisionLeaderboard } from '@/hooks/vision/useVisionLeaderboard'
import { SpringRow } from '@/components/ui/spring'
import { useTranslations } from 'next-intl'
import { TopPlayersSkeleton } from '@/components/ui/VisionLoader'

function truncateAddress(address: string): string {
  if (!address || address.length < 12) return address || '--'
  return `${address.slice(0, 6)}...${address.slice(-4)}`
}

function formatPnl(pnl: number): { text: string; color: string } {
  if (pnl === 0) return { text: '$0.00', color: 'text-text-muted' }
  const sign = pnl > 0 ? '+' : ''
  const color = pnl > 0 ? 'text-color-up' : 'text-color-down'
  return { text: `${sign}$${Math.abs(pnl).toFixed(2)}`, color }
}

function formatVolume(vol: number): string {
  if (vol === 0) return '$0'
  if (vol >= 1000) return `$${(vol / 1000).toFixed(1)}K`
  return `$${vol.toFixed(0)}`
}

export function TopPlayers({ sourceId }: { sourceId?: string }) {
  const t = useTranslations('vision')
  // Global leaderboard, per-source PnL not yet tracked (vision_round_players has no source column)
  const { leaderboard, isLoading } = useVisionLeaderboard()
  const top5 = leaderboard.slice(0, 5)

  return (
    <div id="leaderboard" className="mt-6">
      {/* Section bar */}
      <div className="section-bar">
        <div>
          <div className="section-bar-title">{t('top_players.title')}</div>
          <div className="section-bar-value">{t('top_players.subtitle')}</div>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <div role="table" className="bg-white border border-t-0 border-border-light overflow-hidden">
          {/* Header */}
          <div role="row" className="grid grid-cols-[36px_1fr_60px_70px_80px_90px] items-center px-4 py-2 border-b border-border-light text-[10px] font-bold uppercase tracking-[0.1em] text-text-muted">
            <div role="columnheader">{t('top_players.rank')}</div>
            <div role="columnheader">{t('top_players.player')}</div>
            <div role="columnheader" className="text-right">{t('top_players.batches')}</div>
            <div role="columnheader" className="text-right">{t('top_players.volume')}</div>
            <div role="columnheader" className="text-right">{t('top_players.roi')}</div>
            <div role="columnheader" className="text-right">{t('top_players.pnl')}</div>
          </div>

          {isLoading && <TopPlayersSkeleton />}

          {!isLoading && top5.length === 0 && (
            <div className="px-4 py-6 text-center text-[13px] text-text-muted">
              {t('common_labels.no_players_yet')}
            </div>
          )}

          {top5.map((player, i) => {
            const pnl = formatPnl(player.pnl)
            return (
              <SpringRow
                key={player.walletAddress}
                role="row"
                className={`grid grid-cols-[36px_1fr_60px_70px_80px_90px] items-center px-4 py-2.5 border-b border-border-light text-[13px] ${
                  i % 2 === 1 ? 'bg-surface/40' : ''
                }`}
              >
                <div role="cell" className="font-bold text-text-muted">
                  {player.rank || i + 1}
                </div>
                <div role="cell" className="font-mono text-[12px] text-black font-medium truncate">
                  {truncateAddress(player.walletAddress)}
                </div>
                <div role="cell" className="text-right font-mono tabular-nums text-[12px] text-text-muted">
                  {player.portfolioBets || player.totalBets || 0}
                </div>
                <div role="cell" className="text-right font-mono tabular-nums text-[12px] text-text-muted">
                  {formatVolume(player.totalVolume || player.volume || 0)}
                </div>
                <div role="cell" className={`text-right font-mono tabular-nums font-semibold ${player.roi >= 0 ? 'text-color-up' : 'text-color-down'}`}>
                  {player.roi >= 0 ? '+' : ''}{player.roi.toFixed(1)}%
                </div>
                <div role="cell" className={`text-right font-mono tabular-nums font-semibold ${pnl.color}`}>
                  {pnl.text}
                </div>
              </SpringRow>
            )
          })}
        </div>
      </div>
    </div>
  )
}
