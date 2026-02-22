'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import Link from 'next/link'
import { OddsBadge } from './OddsBadge'
import { SignatureProgress } from './SignatureProgress'
import { Tooltip } from '@/components/ui/Tooltip'
import { type Bet, calculateOddsDisplay, formatImpliedProbability, type TradeHorizon } from '@/lib/types/bet'
import { useCategoryById, formatCategoryDisplay } from '@/hooks/useCategories'

/**
 * Get horizon badge display info
 * Only shows badge for monthly/quarterly horizons (economic data)
 */
function getHorizonBadge(horizon?: TradeHorizon): { label: string; bgColor: string; textColor: string } | null {
  if (!horizon || horizon === 'short' || horizon === 'daily') {
    return null; // Don't show badge for short-term trades
  }

  switch (horizon) {
    case 'weekly':
      return {
        label: 'Weekly',
        bgColor: 'bg-amber-100',
        textColor: 'text-amber-700',
      };
    case 'monthly':
      return {
        label: 'Monthly',
        bgColor: 'bg-orange-100',
        textColor: 'text-orange-700',
      };
    case 'quarterly':
      return {
        label: 'Quarterly',
        bgColor: 'bg-red-100',
        textColor: 'text-red-700',
      };
    default:
      return null;
  }
}

interface BetCardProps {
  /** The bet to display */
  bet: Bet
  /** Optional className for container */
  className?: string
}

/**
 * Format status for display
 * Maps status codes to human-readable strings
 * Story 4-2: Added bilateral bet status mapping
 */
function formatStatus(status: string): string {
  const statusMap: Record<string, string> = {
    // Legacy statuses
    pending: 'Pending',
    matched: 'Matched',
    settling: 'Settling',
    settled: 'Settled',
    // Bilateral custody statuses
    active: 'Active',
    in_arbitration: 'Disputed',
    custom_payout: 'Custom Split',
  }
  return statusMap[status] || status.replace(/_/g, ' ')
}

/**
 * Get status color class
 * Supports both legacy (pending/matched/settling/settled) and
 * bilateral custody statuses (active/in_arbitration/settled/custom_payout)
 * Story 4-2: Added bilateral bet status support
 */
function getStatusColor(status: string): string {
  switch (status) {
    // Legacy statuses (GeneralMarketCore)
    case 'pending':
      return 'text-yellow-600'
    case 'matched':
      return 'text-green-600'
    case 'settling':
      return 'text-blue-600'
    case 'settled':
      return 'text-cyan-600'
    // Bilateral custody statuses (CollateralVault)
    case 'active':
      return 'text-green-600'
    case 'in_arbitration':
      return 'text-orange-600'
    case 'custom_payout':
      return 'text-purple-600'
    default:
      return 'text-text-muted'
  }
}

/**
 * BetCard component
 * Displays a bet with full odds information
 *
 * AC1: Display odds prominently as badge with color coding
 * AC2: Show creator and matcher stakes, remaining for partial fills
 * AC3: Fill progress bar with percentage
 * AC4: Payout information with return multipliers
 * AC5: Implied probability (collapsible)
 * AC6: Read-only notice - no action buttons
 */
export function BetCard({ bet, className = '' }: BetCardProps) {
  const t = useTranslations('p2pool')
  const [showAdvanced, setShowAdvanced] = useState(false)
  const odds = calculateOddsDisplay(bet)
  const category = useCategoryById(bet.categoryId)

  return (
    <div className={`border border-border-light rounded-xl p-4 bg-white shadow-card ${className}`}>
      {/* Header with odds badge and status */}
      <div className="flex justify-between items-center mb-4">
        <div className="flex items-center gap-2">
          <OddsBadge display={odds.display} favorability={odds.favorability} />
          {/* Category badge (Epic 8) */}
          {category && (
            <span className="px-2 py-1 bg-muted rounded text-xs font-mono text-text-secondary">
              {formatCategoryDisplay(category)}
              {bet.listSize && (
                <span className="text-text-muted ml-1">({bet.listSize})</span>
              )}
            </span>
          )}
          {/* Horizon badge (Epic 9) - only for monthly/quarterly */}
          {(() => {
            const horizonBadge = getHorizonBadge(bet.horizon);
            return horizonBadge ? (
              <span className={`px-2 py-1 ${horizonBadge.bgColor} rounded text-xs font-mono ${horizonBadge.textColor}`}>
                {horizonBadge.label}
              </span>
            ) : null;
          })()}
          {/* Story 14-1: Early exit badge */}
          {bet.earlyExit && (
            <span className="px-2 py-1 bg-cyan-100 rounded text-xs font-mono text-cyan-700">
              ⊗ Early Exit
            </span>
          )}
        </div>
        <span className={`text-xs font-mono ${getStatusColor(bet.status)}`}>
          {formatStatus(bet.status)}
        </span>
      </div>

      {/* Stake information (AC2) */}
      <div className="grid grid-cols-2 gap-4 text-sm mb-4">
        <div>
          <div className="text-text-muted text-xs uppercase font-mono mb-1">{t('bet_card.creator_staked')}</div>
          <div className="font-mono text-text-primary">{odds.creatorRisk}</div>
        </div>
        <div>
          <div className="text-text-muted text-xs uppercase font-mono mb-1">{t('bet_card.filler_stake')}</div>
          <div className="font-mono text-text-primary">{odds.matcherRisk}</div>
        </div>
      </div>

      {/* Match status indicator */}
      <div className="mb-4 text-xs font-mono text-text-muted">
        {odds.isMatched ? (
          <span className="text-green-600">{t('bet_card.matched')}</span>
        ) : (
          <span className="text-yellow-600">{t('bet_card.awaiting_match')}</span>
        )}
      </div>

      {/* Payout info (AC4) */}
      <div className="bg-muted p-3 rounded-lg border border-border-light mb-4">
        <div className="text-text-muted text-xs uppercase font-mono mb-2">{t('bet_card.payout_info')}</div>
        <div className="space-y-2 text-sm">
          <div className="flex justify-between font-mono">
            <span className="text-text-muted">{t('bet_card.total_pot')}</span>
            <span className="text-text-primary">{odds.totalPot}</span>
          </div>
          <div className="flex justify-between font-mono">
            <Tooltip content="Return multiplier if creator wins">
              <span className="text-text-muted cursor-help">{t('bet_card.creator_return')}</span>
            </Tooltip>
            <span className="text-green-600">{odds.creatorReturn}</span>
          </div>
          <div className="flex justify-between font-mono">
            <Tooltip content="Return multiplier if matcher wins">
              <span className="text-text-muted cursor-help">{t('bet_card.matcher_return')}</span>
            </Tooltip>
            <span className="text-green-600">{odds.matcherReturn}</span>
          </div>
        </div>
      </div>

      {/* Implied probability toggle (AC5) */}
      <button
        onClick={() => setShowAdvanced(!showAdvanced)}
        className="w-full text-xs text-text-muted hover:text-text-primary transition-colors mb-3 font-mono"
      >
        {showAdvanced ? `▼ ${t('bet_card.hide_probability')}` : `▶ ${t('bet_card.show_probability')}`}
      </button>

      {showAdvanced && (
        <div className="bg-muted p-3 rounded-lg border border-border-light mb-4 text-sm">
          <div className="flex justify-between font-mono">
            <Tooltip content="Probability implied by the odds that creator wins">
              <span className="text-text-muted cursor-help">{t('bet_card.creator_implied')}</span>
            </Tooltip>
            <span className="text-text-primary">{formatImpliedProbability(odds.impliedProbability)}</span>
          </div>
          <div className="flex justify-between font-mono mt-1">
            <Tooltip content="Probability implied by the odds that matcher wins">
              <span className="text-text-muted cursor-help">{t('bet_card.matcher_implied')}</span>
            </Tooltip>
            <span className="text-text-primary">{formatImpliedProbability(1 - odds.impliedProbability)}</span>
          </div>
        </div>
      )}

      {/* List/Portfolio size */}
      <div className="text-xs text-text-muted font-mono mb-3">
        {bet.tradeCount && bet.tradeCount > 0 ? (
          <span>Portfolio: {bet.tradeCount.toLocaleString()} markets</span>
        ) : bet.listSize ? (
          <span>List Size: {bet.listSize} trades</span>
        ) : (
          <span>Portfolio: {(bet.portfolioSize || 0).toLocaleString()} markets</span>
        )}
      </div>

      {/* Story 14.3: Signature progress for bets pending resolution */}
      {(bet.status === 'matched' || bet.status === 'settling') && (
        <div className="mb-3">
          <SignatureProgress
            betId={parseInt(bet.betId, 10)}
            compact={true}
            enabled={bet.status === 'matched' || bet.status === 'settling'}
          />
        </div>
      )}

      {/* View details link */}
      <div className="flex justify-between items-center">
        <Link
          href={`/bet/${bet.betId}`}
          className="text-color-info hover:text-color-info/80 text-xs font-mono transition-colors"
        >
          {t('bet_card.view_details')}
        </Link>

        {/* Read-only notice (AC6) */}
        <span className="text-[10px] text-text-muted italic">
          {t('bet_card.bot_notice')}
        </span>
      </div>
    </div>
  )
}
