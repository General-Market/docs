'use client'

import { useVisionLeaderboard, VisionLeaderboardEntry } from '@/hooks/vision/useVisionLeaderboard'
import { useTranslations } from 'next-intl'
import { useIsMobile } from '@/hooks/useMediaQueries'
import { LeaderboardSkeleton } from '@/components/ui/VisionLoader'

function MobileCard({ entry, t }: { entry: VisionLeaderboardEntry; t: ReturnType<typeof useTranslations<'vision'>> }) {
  const pnlPositive = entry.pnl >= 0
  const rankDisplay = entry.rank <= 3
    ? ['\u{1F947}', '\u{1F948}', '\u{1F949}'][entry.rank - 1]
    : `#${entry.rank}`

  return (
    <div className={`px-4 py-3 border-b border-border-light ${entry.rank <= 3 ? 'bg-muted/40 border-l-2 border-l-brand' : ''}`}>
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-sm font-bold tabular-nums shrink-0 w-8">{rankDisplay}</span>
          <span className="font-mono text-sm text-text-primary truncate">
            {entry.walletAddress.slice(0, 6)}...{entry.walletAddress.slice(-4)}
          </span>
        </div>
        <span className={`font-mono text-sm font-bold tabular-nums shrink-0 ${pnlPositive ? 'text-color-up' : 'text-color-down'}`}>
          {pnlPositive ? '+' : '-'}${Math.abs(entry.pnl).toFixed(2)}
        </span>
      </div>
      <div className="flex items-center gap-3 mt-1.5 text-xs text-text-muted font-mono">
        <span className={entry.roi >= 0 ? 'text-color-up' : 'text-color-down'}>
          {entry.roi >= 0 ? '+' : ''}{entry.roi.toFixed(1)}%
        </span>
        <span>{entry.roundsPlayed} {t('vision_leaderboard.rounds').toLowerCase()}</span>
        <span>${entry.totalVolume.toFixed(2)}</span>
        <span className="ml-auto">{entry.portfolioBets} {t('vision_leaderboard.batches').toLowerCase()}</span>
      </div>
    </div>
  )
}

/**
 * Vision leaderboard showing player rankings by PnL.
 * Uses the /vision/leaderboard endpoint from the issuer API.
 */
export function VisionLeaderboard() {
  const t = useTranslations('vision')
  const { leaderboard, isLoading, isError } = useVisionLeaderboard()
  const isMobile = useIsMobile()

  if (isLoading) {
    return <LeaderboardSkeleton />
  }

  if (isError || leaderboard.length === 0) {
    return (
      <div className="py-8 text-center">
        <p className="text-text-muted font-mono text-sm">
          {isError ? t('vision_leaderboard.failed_to_load') : t('vision_leaderboard.no_players')}
        </p>
      </div>
    )
  }

  if (isMobile) {
    return (
      <div className="py-6">
        {leaderboard.map((entry) => (
          <MobileCard key={entry.walletAddress} entry={entry} t={t} />
        ))}
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
              <th className="pb-3 pr-4">{t('vision_leaderboard.player')}</th>
              <th className="pb-3 pr-4 text-right">{t('vision_leaderboard.pnl_usdc')}</th>
              <th className="pb-3 pr-4 text-right">{t('vision_leaderboard.roi')}</th>
              <th className="pb-3 pr-4 text-right">{t('vision_leaderboard.rounds')}</th>
              <th className="pb-3 pr-4 text-right">{t('vision_leaderboard.volume')}</th>
              <th className="pb-3 text-right">{t('vision_leaderboard.batches')}</th>
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
                    {entry.roundsPlayed}
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
