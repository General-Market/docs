'use client'

import type { ArbitrationInfo } from '@/lib/types/bilateral-bet'
import { truncateAddress } from '@/lib/types/bilateral-bet'

interface ArbitrationBadgeProps {
  /** Arbitration information */
  arbitration: ArbitrationInfo
  /** Use compact display (badge only) */
  compact?: boolean
}

/**
 * ArbitrationBadge component
 * Displays arbitration status for disputed bilateral bets
 * Story 4-2: Visual indicator for bets in keeper arbitration
 *
 * Compact mode: Shows just a status badge
 * Full mode: Shows badge + details (requester, timestamps, outcome)
 */
export function ArbitrationBadge({ arbitration, compact = false }: ArbitrationBadgeProps) {
  const isResolved = !!arbitration.resolvedAt

  if (compact) {
    return (
      <span
        className={`animate-scale-in transition-colors px-2 py-1 rounded text-xs font-mono ${
          isResolved ? 'bg-surface-info text-color-info' : 'bg-surface-warning text-color-warning'
        }`}
      >
        {isResolved ? '\u2696\uFE0F Resolved' : '\u2696\uFE0F In Arbitration'}
      </span>
    )
  }

  return (
    <div className="animate-scale-in bg-surface-warning border border-color-warning/50 rounded-md p-3">
      <div className="flex items-center gap-2 mb-2">
        <span className="text-color-warning text-sm font-mono">\u2696\uFE0F Arbitration</span>
        <span
          className={`transition-colors px-2 py-0.5 rounded text-xs font-mono ${
            isResolved ? 'bg-surface-info text-color-info' : 'bg-surface-warning text-color-warning'
          }`}
        >
          {isResolved ? 'Resolved' : 'Pending'}
        </span>
      </div>

      <div className="space-y-1 text-xs font-mono text-text-muted">
        <div className="flex justify-between">
          <span>Requested By:</span>
          <span className="text-white/80">{truncateAddress(arbitration.requestedBy, 6)}</span>
        </div>
        <div className="flex justify-between">
          <span>Requested At:</span>
          <span className="text-white/80">
            {new Date(arbitration.requestedAt).toLocaleString()}
          </span>
        </div>
        {isResolved && (
          <>
            <div className="flex justify-between">
              <span>Resolved At:</span>
              <span className="text-white/80">
                {new Date(arbitration.resolvedAt!).toLocaleString()}
              </span>
            </div>
            {arbitration.outcomeWinner && (
              <div className="flex justify-between">
                <span>Winner:</span>
                <span className="text-color-up">
                  {truncateAddress(arbitration.outcomeWinner, 6)}
                </span>
              </div>
            )}
            {arbitration.keeperCount !== undefined && (
              <div className="flex justify-between">
                <span>Keeper Votes:</span>
                <span className="text-white/80">{arbitration.keeperCount}</span>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}

/**
 * ArbitrationPendingBadge - Simple badge for pending arbitration
 */
export function ArbitrationPendingBadge() {
  return (
    <span className="animate-scale-in transition-colors px-2 py-1 rounded text-xs font-mono bg-surface-warning text-color-warning">
      \u2696\uFE0F In Arbitration
    </span>
  )
}

/**
 * ArbitrationResolvedBadge - Simple badge for resolved arbitration
 */
export function ArbitrationResolvedBadge() {
  return (
    <span className="animate-scale-in transition-colors px-2 py-1 rounded text-xs font-mono bg-surface-info text-color-info">
      \u2696\uFE0F Resolved
    </span>
  )
}
