'use client'

import Link from 'next/link'
import type { BilateralBet } from '@/lib/types/bilateral-bet'
import {
  getStatusDisplay,
  getStatusColor,
  getStatusBgColor,
  formatWINDAmount,
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
  const userRole = getUserRole(bet, currentUserAddress)
  const isTerminal = isBetTerminal(bet.status)
  const canDispute = canRequestArbitration(bet)

  // Fetch arbitration status if bet is in arbitration
  const { data: arbitration } = useArbitrationStatus(
    bet.betId,
    bet.status === 'in_arbitration'
  )

  return (
    <div className={`border border-gray-700 rounded-lg p-4 bg-black/50 ${className}`}>
      {/* Header with bet ID and status */}
      <div className="flex justify-between items-center mb-4">
        <div className="flex items-center gap-2">
          <span className="text-sm font-mono text-white/80">Bet #{bet.betId}</span>
          {userRole && (
            <span
              className={`px-2 py-0.5 rounded text-xs font-mono ${
                userRole === 'creator'
                  ? 'bg-blue-800/30 text-blue-300'
                  : 'bg-purple-800/30 text-purple-300'
              }`}
            >
              {userRole === 'creator' ? 'Creator' : 'Filler'}
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
          <div className="text-gray-400 text-xs uppercase font-mono mb-1">Creator</div>
          <div className="font-mono text-white">{truncateAddress(bet.creator, 6)}</div>
          <div className="text-xs text-green-400 font-mono mt-0.5">
            {formatWINDAmount(bet.creatorAmount)} WIND
          </div>
        </div>
        <div>
          <div className="text-gray-400 text-xs uppercase font-mono mb-1">Filler</div>
          <div className="font-mono text-white">{truncateAddress(bet.filler, 6)}</div>
          <div className="text-xs text-green-400 font-mono mt-0.5">
            {formatWINDAmount(bet.fillerAmount)} WIND
          </div>
        </div>
      </div>

      {/* Total pot and deadline */}
      <div className="grid grid-cols-2 gap-4 text-sm mb-4">
        <div>
          <div className="text-gray-400 text-xs uppercase font-mono mb-1">Total Locked</div>
          <div className="font-mono text-white font-bold">
            {formatWINDAmount(bet.totalAmount)} WIND
          </div>
        </div>
        <div>
          <div className="text-gray-400 text-xs uppercase font-mono mb-1">Deadline</div>
          <div className="font-mono text-white">{formatDeadline(bet.deadline)}</div>
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
        <div className="bg-gray-900/60 p-3 rounded border border-gray-800 mb-4">
          <div className="text-gray-400 text-xs uppercase font-mono mb-2">Settlement</div>
          <div className="space-y-2 text-sm">
            {bet.winner && (
              <div className="flex justify-between font-mono">
                <span className="text-gray-400">Winner:</span>
                <span className="text-green-400">{truncateAddress(bet.winner, 6)}</span>
              </div>
            )}
            {bet.resolutionType && (
              <div className="flex justify-between font-mono">
                <span className="text-gray-400">Resolution:</span>
                <span className="text-white">{getResolutionTypeDisplay(bet.resolutionType)}</span>
              </div>
            )}
            {bet.status === 'custom_payout' && (
              <>
                {bet.creatorPayout && (
                  <div className="flex justify-between font-mono">
                    <span className="text-gray-400">Creator Payout:</span>
                    <span className="text-cyan-400">{formatWINDAmount(bet.creatorPayout)} WIND</span>
                  </div>
                )}
                {bet.fillerPayout && (
                  <div className="flex justify-between font-mono">
                    <span className="text-gray-400">Filler Payout:</span>
                    <span className="text-cyan-400">{formatWINDAmount(bet.fillerPayout)} WIND</span>
                  </div>
                )}
              </>
            )}
            {bet.keeperCount !== undefined && bet.keeperCount > 0 && (
              <div className="flex justify-between font-mono">
                <span className="text-gray-400">Keeper Votes:</span>
                <span className="text-white">{bet.keeperCount}</span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Timestamps */}
      <div className="text-xs text-gray-500 font-mono mb-3 space-y-1">
        {bet.committedAt && (
          <div>Committed: {new Date(bet.committedAt).toLocaleString()}</div>
        )}
        {bet.settledAt && <div>Settled: {new Date(bet.settledAt).toLocaleString()}</div>}
      </div>

      {/* View details link */}
      <div className="flex justify-between items-center">
        <Link
          href={`/bilateral-bet/${bet.betId}`}
          className="text-cyan-400 hover:text-cyan-300 text-xs font-mono transition-colors"
        >
          View Details \u2192
        </Link>

        {/* Status indicators */}
        <div className="flex items-center gap-2">
          {canDispute && (
            <span className="text-[10px] text-orange-400 font-mono">Can dispute</span>
          )}
          {bet.txHash && (
            <a
              href={getTxUrl(bet.txHash)}
              target="_blank"
              rel="noopener noreferrer"
              className="text-[10px] text-gray-500 hover:text-gray-300 font-mono"
            >
              Tx \u2197
            </a>
          )}
        </div>
      </div>
    </div>
  )
}
