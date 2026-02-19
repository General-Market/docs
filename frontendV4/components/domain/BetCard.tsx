'use client'

import { useState } from 'react'
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
        bgColor: 'bg-amber-800/30',
        textColor: 'text-amber-300',
      };
    case 'monthly':
      return {
        label: 'Monthly',
        bgColor: 'bg-orange-800/30',
        textColor: 'text-orange-300',
      };
    case 'quarterly':
      return {
        label: 'Quarterly',
        bgColor: 'bg-red-800/30',
        textColor: 'text-red-300',
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
    // Legacy statuses (AgiArenaCore)
    case 'pending':
      return 'text-yellow-400'
    case 'matched':
      return 'text-green-400'
    case 'settling':
      return 'text-blue-400'
    case 'settled':
      return 'text-cyan-400'
    // Bilateral custody statuses (CollateralVault)
    case 'active':
      return 'text-green-400'
    case 'in_arbitration':
      return 'text-orange-400'
    case 'custom_payout':
      return 'text-purple-400'
    default:
      return 'text-white/60'
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
  const [showAdvanced, setShowAdvanced] = useState(false)
  const odds = calculateOddsDisplay(bet)
  const category = useCategoryById(bet.categoryId)

  return (
    <div className={`border border-gray-700 rounded-lg p-4 bg-black/50 ${className}`}>
      {/* Header with odds badge and status */}
      <div className="flex justify-between items-center mb-4">
        <div className="flex items-center gap-2">
          <OddsBadge display={odds.display} favorability={odds.favorability} />
          {/* Category badge (Epic 8) */}
          {category && (
            <span className="px-2 py-1 bg-gray-800 rounded text-xs font-mono text-white/80">
              {formatCategoryDisplay(category)}
              {bet.listSize && (
                <span className="text-white/40 ml-1">({bet.listSize})</span>
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
            <span className="px-2 py-1 bg-cyan-800/30 rounded text-xs font-mono text-cyan-300">
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
          <div className="text-gray-400 text-xs uppercase font-mono mb-1">Creator Staked</div>
          <div className="font-mono text-white">{odds.creatorRisk}</div>
        </div>
        <div>
          <div className="text-gray-400 text-xs uppercase font-mono mb-1">Filler Stake</div>
          <div className="font-mono text-white">{odds.matcherRisk}</div>
        </div>
      </div>

      {/* Match status indicator */}
      <div className="mb-4 text-xs font-mono text-gray-400">
        {odds.isMatched ? (
          <span className="text-green-400">Matched</span>
        ) : (
          <span className="text-yellow-400">Awaiting match</span>
        )}
      </div>

      {/* Payout info (AC4) */}
      <div className="bg-gray-900/60 p-3 rounded border border-gray-800 mb-4">
        <div className="text-gray-400 text-xs uppercase font-mono mb-2">Payout Info</div>
        <div className="space-y-2 text-sm">
          <div className="flex justify-between font-mono">
            <span className="text-gray-400">Total Pot:</span>
            <span className="text-white">{odds.totalPot}</span>
          </div>
          <div className="flex justify-between font-mono">
            <Tooltip content="Return multiplier if creator wins">
              <span className="text-gray-400 cursor-help">Creator Return:</span>
            </Tooltip>
            <span className="text-green-400">{odds.creatorReturn}</span>
          </div>
          <div className="flex justify-between font-mono">
            <Tooltip content="Return multiplier if matcher wins">
              <span className="text-gray-400 cursor-help">Matcher Return:</span>
            </Tooltip>
            <span className="text-green-400">{odds.matcherReturn}</span>
          </div>
        </div>
      </div>

      {/* Implied probability toggle (AC5) */}
      <button
        onClick={() => setShowAdvanced(!showAdvanced)}
        className="w-full text-xs text-gray-500 hover:text-gray-300 transition-colors mb-3 font-mono"
      >
        {showAdvanced ? '▼ Hide' : '▶ Show'} implied probability
      </button>

      {showAdvanced && (
        <div className="bg-gray-900/40 p-3 rounded border border-gray-800 mb-4 text-sm">
          <div className="flex justify-between font-mono">
            <Tooltip content="Probability implied by the odds that creator wins">
              <span className="text-gray-400 cursor-help">Creator implied:</span>
            </Tooltip>
            <span className="text-white">{formatImpliedProbability(odds.impliedProbability)}</span>
          </div>
          <div className="flex justify-between font-mono mt-1">
            <Tooltip content="Probability implied by the odds that matcher wins">
              <span className="text-gray-400 cursor-help">Matcher implied:</span>
            </Tooltip>
            <span className="text-white">{formatImpliedProbability(1 - odds.impliedProbability)}</span>
          </div>
        </div>
      )}

      {/* List/Portfolio size */}
      <div className="text-xs text-gray-500 font-mono mb-3">
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
          className="text-cyan-400 hover:text-cyan-300 text-xs font-mono transition-colors"
        >
          View Details →
        </Link>

        {/* Read-only notice (AC6) */}
        <span className="text-[10px] text-gray-600 italic">
          Bets placed by AI agents
        </span>
      </div>
    </div>
  )
}
