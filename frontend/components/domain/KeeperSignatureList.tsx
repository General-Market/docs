'use client'

import { useMemo } from 'react'
import { truncateAddress } from '@/lib/utils/address'
import { getAddressUrl } from '@/lib/utils/basescan'
import {
  formatSignedTimeAgo,
  type KeeperSignature,
  type KeeperSignatureStatus,
} from '@/lib/types/resolution'

/**
 * Props for KeeperSignatureList component
 */
export interface KeeperSignatureListProps {
  /** Array of keeper signature statuses */
  keepers: KeeperSignature[]
  /** Optional className for container */
  className?: string
}

/**
 * Get status icon for keeper
 */
function getStatusIcon(status: KeeperSignatureStatus): {
  icon: string
  color: string
} {
  switch (status) {
    case 'signed':
      return { icon: '✓', color: 'text-green-400' }
    case 'pending':
      return { icon: '⏳', color: 'text-yellow-400' }
    case 'failed':
      return { icon: '✗', color: 'text-red-400' }
    case 'timeout':
      return { icon: '⏱', color: 'text-orange-400' }
    default:
      return { icon: '?', color: 'text-gray-400' }
  }
}

/**
 * Get status text for keeper
 */
function getStatusText(keeper: KeeperSignature): string {
  switch (keeper.status) {
    case 'signed':
      return keeper.signedAt ? `Signed ${formatSignedTimeAgo(keeper.signedAt)}` : 'Signed'
    case 'pending':
      return 'Pending...'
    case 'failed':
      return keeper.error || 'Failed'
    case 'timeout':
      return 'Timeout'
    default:
      return 'Unknown'
  }
}

/**
 * KeeperSignatureList component
 *
 * Story 14.3, Task 10: Keeper status panel
 *
 * Features:
 * - Shows each keeper with status icon and timestamp
 * - Truncated keeper addresses (0x1234...5678)
 * - "Signed at: X seconds ago" for signed keepers
 * - Color-coded status indicators
 *
 * @param props - Component props
 */
export function KeeperSignatureList({
  keepers,
  className = '',
}: KeeperSignatureListProps) {
  // Sort keepers: signed first, then pending, then failed/timeout
  const sortedKeepers = useMemo(() => {
    const statusOrder: Record<KeeperSignatureStatus, number> = {
      signed: 0,
      pending: 1,
      failed: 2,
      timeout: 3,
    }

    return [...keepers].sort((a, b) => {
      const orderDiff = statusOrder[a.status] - statusOrder[b.status]
      if (orderDiff !== 0) return orderDiff

      // Within same status, sort by signedAt (most recent first)
      if (a.signedAt && b.signedAt) {
        return new Date(b.signedAt).getTime() - new Date(a.signedAt).getTime()
      }

      return 0
    })
  }, [keepers])

  // Count by status
  const statusCounts = useMemo(() => {
    const counts = {
      signed: 0,
      pending: 0,
      failed: 0,
      timeout: 0,
    }

    for (const keeper of keepers) {
      counts[keeper.status]++
    }

    return counts
  }, [keepers])

  if (keepers.length === 0) {
    return (
      <div className={`font-mono text-sm text-gray-500 ${className}`}>
        No keepers registered
      </div>
    )
  }

  return (
    <div className={`font-mono ${className}`}>
      {/* Header with counts */}
      <div className="flex items-center justify-between mb-3 text-xs text-gray-400">
        <span>Resolution Signatures ({statusCounts.signed}/{keepers.length})</span>
        <div className="flex gap-2">
          {statusCounts.signed > 0 && (
            <span className="text-green-400">{statusCounts.signed} signed</span>
          )}
          {statusCounts.pending > 0 && (
            <span className="text-yellow-400">{statusCounts.pending} pending</span>
          )}
          {(statusCounts.failed + statusCounts.timeout) > 0 && (
            <span className="text-red-400">{statusCounts.failed + statusCounts.timeout} failed</span>
          )}
        </div>
      </div>

      {/* Keeper list */}
      <div className="space-y-2">
        {sortedKeepers.map((keeper) => {
          const { icon, color } = getStatusIcon(keeper.status)
          const statusText = getStatusText(keeper)

          return (
            <div
              key={keeper.address}
              className="flex items-center justify-between py-2 px-3 bg-gray-900/50 rounded border border-gray-800"
            >
              <div className="flex items-center gap-2">
                <span className={`text-base ${color}`}>{icon}</span>
                <a
                  href={getAddressUrl(keeper.address)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-white hover:text-cyan-400 transition-colors"
                >
                  {truncateAddress(keeper.address)}
                </a>
              </div>
              <span className={`text-xs ${color}`}>
                {statusText}
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

/**
 * Compact version for inline display
 */
export function KeeperSignatureListCompact({
  keepers,
  className = '',
}: KeeperSignatureListProps) {
  const signedCount = keepers.filter(k => k.status === 'signed').length

  return (
    <div className={`flex items-center gap-1 font-mono text-xs ${className}`}>
      {keepers.slice(0, 5).map((keeper) => (
        <span
          key={keeper.address}
          className={`w-2 h-2 rounded-full ${
            keeper.status === 'signed' ? 'bg-green-500' :
            keeper.status === 'pending' ? 'bg-yellow-500' :
            'bg-red-500'
          }`}
          title={`${truncateAddress(keeper.address)}: ${keeper.status}`}
        />
      ))}
      {keepers.length > 5 && (
        <span className="text-gray-500">+{keepers.length - 5}</span>
      )}
      <span className="text-gray-400 ml-1">
        {signedCount}/{keepers.length}
      </span>
    </div>
  )
}
