'use client'

import Link from 'next/link'
import { useTranslations } from 'next-intl'
import type { BilateralBet } from '@/lib/types/bilateral-bet'
import {
  getStatusDisplay,
  getStatusColor,
  getStatusBgColor,
  formatUSDCAmount,
  truncateAddress,
  isBetTerminal,
  canRequestArbitration,
  getResolutionTypeDisplay,
} from '@/lib/types/bilateral-bet'
import { ArbitrationBadge } from './ArbitrationBadge'
import { useArbitrationStatus } from '@/hooks/useBilateralBets'
import { getTxUrl } from '@/lib/utils/basescan'

interface BilateralBetCardProps {
  /** The bilateral bet to display */
  bet: BilateralBet
  /** Optional className for container */
  className?: string
  /** Current user's address for role display */
  currentUserAddress?: string
}

/**
 * Format deadline for display
 */
function formatDeadline(deadline: string): string {
  const date = new Date(deadline)
  const now = new Date()
  const diff = date.getTime() - now.getTime()

  if (diff < 0) return 'Expired'

  const days = Math.floor(diff / (1000 * 60 * 60 * 24))
  const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60))

  if (days > 0) return `${days}d ${hours}h`
  if (hours > 0) return `${hours}h`
  return 'Soon'
}

/**
 * Determine user's role in the bet
 */
function getUserRole(bet: BilateralBet, userAddress?: string): 'creator' | 'filler' | null {
  if (!userAddress) return null
  const lowerAddress = userAddress.toLowerCase()
  if (bet.creator.toLowerCase() === lowerAddress) return 'creator'
  if (bet.filler.toLowerCase() === lowerAddress) return 'filler'
  return null
}

/**
 * BilateralBetCard component
 * Displays a bilateral bet from the CollateralVault contract
 * Story 4-2: Frontend display for bilateral custody bets
 */
export function BilateralBetCard({
  bet,
  className = '',
  currentUserAddress,
}: BilateralBetCardProps) {
  const t = useTranslations('p2pool')
  const userRole = getUserRole(bet, currentUserAddress)
  const isTerminal = isBetTerminal(bet.status)
  const canDispute = canRequestArbitration(bet)

  // Fetch arbitration status if bet is in arbitration
  const { data: arbitration } = useArbitrationStatus(
    bet.betId,
    bet.status === 'in_arbitration'
  )

  return (
    <div className={`border border-border-light rounded-xl p-4 bg-white shadow-card ${className}`}>
      {/* Header with bet ID and status */}
      <div className="flex justify-between items-center mb-4">
        <div className="flex items-center gap-2">
          <span className="text-sm font-mono text-text-primary">{t('bilateral.bet_id', { id: bet.betId })}</span>
          {userRole && (
            <span
              className={`px-2 py-0.5 rounded text-xs font-mono ${
                userRole === 'creator'
                  ? 'bg-blue-100 text-blue-700'
                  : 'bg-purple-100 text-purple-700'
              }`}
            >
              {userRole === 'creator' ? t('bilateral.creator') : t('bilateral.filler')}
            </span>
          )}
        </div>
        <span
          className={`px-2 py-1 rounded text-xs font-mono border ${getStatusColor(bet.status)} ${getStatusBgColor(bet.status)}`}
        >
          {getStatusDisplay(bet.status)}
        </span>
      </div>

      {/* Parties */}
      <div className="grid grid-cols-2 gap-4 text-sm mb-4">
        <div>
          <div className="text-text-muted text-xs uppercase font-mono mb-1">{t('bilateral.creator')}</div>
          <div className="font-mono text-text-primary">{truncateAddress(bet.creator, 6)}</div>
          <div className="text-xs text-green-600 font-mono mt-0.5">
            {formatUSDCAmount(bet.creatorAmount)} USDC
          </div>
        </div>
        <div>
          <div className="text-text-muted text-xs uppercase font-mono mb-1">{t('bilateral.filler')}</div>
          <div className="font-mono text-text-primary">{truncateAddress(bet.filler, 6)}</div>
          <div className="text-xs text-green-600 font-mono mt-0.5">
            {formatUSDCAmount(bet.fillerAmount)} USDC
          </div>
        </div>
      </div>

      {/* Total pot and deadline */}
      <div className="grid grid-cols-2 gap-4 text-sm mb-4">
        <div>
          <div className="text-text-muted text-xs uppercase font-mono mb-1">{t('bilateral.total_locked')}</div>
          <div className="font-mono text-text-primary font-bold">
            {formatUSDCAmount(bet.totalAmount)} USDC
          </div>
        </div>
        <div>
          <div className="text-text-muted text-xs uppercase font-mono mb-1">{t('bilateral.deadline')}</div>
          <div className="font-mono text-text-primary">{formatDeadline(bet.deadline)}</div>
        </div>
      </div>

      {/* Arbitration status (if in dispute) */}
      {bet.status === 'in_arbitration' && arbitration && (
        <div className="mb-4">
          <ArbitrationBadge arbitration={arbitration} compact={false} />
        </div>
      )}

      {/* Settlement info (if settled) */}
      {isTerminal && (
        <div className="bg-muted p-3 rounded-lg border border-border-light mb-4">
          <div className="text-text-muted text-xs uppercase font-mono mb-2">{t('bilateral.settlement')}</div>
          <div className="space-y-2 text-sm">
            {bet.winner && (
              <div className="flex justify-between font-mono">
                <span className="text-text-muted">{t('bilateral.winner')}</span>
                <span className="text-green-600">{truncateAddress(bet.winner, 6)}</span>
              </div>
            )}
            {bet.resolutionType && (
              <div className="flex justify-between font-mono">
                <span className="text-text-muted">{t('bilateral.resolution')}</span>
                <span className="text-text-primary">{getResolutionTypeDisplay(bet.resolutionType)}</span>
              </div>
            )}
            {bet.status === 'custom_payout' && (
              <>
                {bet.creatorPayout && (
                  <div className="flex justify-between font-mono">
                    <span className="text-text-muted">{t('bilateral.creator_payout')}</span>
                    <span className="text-color-info">{formatUSDCAmount(bet.creatorPayout)} USDC</span>
                  </div>
                )}
                {bet.fillerPayout && (
                  <div className="flex justify-between font-mono">
                    <span className="text-text-muted">{t('bilateral.filler_payout')}</span>
                    <span className="text-color-info">{formatUSDCAmount(bet.fillerPayout)} USDC</span>
                  </div>
                )}
              </>
            )}
            {bet.keeperCount !== undefined && bet.keeperCount > 0 && (
              <div className="flex justify-between font-mono">
                <span className="text-text-muted">{t('bilateral.keeper_votes')}</span>
                <span className="text-text-primary">{bet.keeperCount}</span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Timestamps */}
      <div className="text-xs text-text-muted font-mono mb-3 space-y-1">
        {bet.committedAt && (
          <div>{t('bilateral.committed', { date: new Date(bet.committedAt).toLocaleString() })}</div>
        )}
        {bet.settledAt && <div>{t('bilateral.settled', { date: new Date(bet.settledAt).toLocaleString() })}</div>}
      </div>

      {/* View details link */}
      <div className="flex justify-between items-center">
        <Link
          href={`/bilateral-bet/${bet.betId}`}
          className="text-color-info hover:text-color-info/80 text-xs font-mono transition-colors"
        >
          {t('bet_card.view_details')}
        </Link>

        {/* Status indicators */}
        <div className="flex items-center gap-2">
          {canDispute && (
            <span className="text-[10px] text-orange-600 font-mono">{t('bilateral.can_dispute')}</span>
          )}
          {bet.txHash && (
            <a
              href={getTxUrl(bet.txHash)}
              target="_blank"
              rel="noopener noreferrer"
              className="text-[10px] text-text-muted hover:text-text-primary font-mono"
            >
              Tx \u2197
            </a>
          )}
        </div>
      </div>
    </div>
  )
}
