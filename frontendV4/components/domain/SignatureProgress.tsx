'use client'

import { useMemo } from 'react'
import { useResolutionSignatures } from '@/hooks/useResolutionSignatures'
import {
  calculateSignatureProgress,
  isThresholdMet,
  type SignatureStatus,
} from '@/lib/types/resolution'

/**
 * Props for SignatureProgress component
 */
export interface SignatureProgressProps {
  /** Bet ID to show signature progress for */
  betId: number
  /** Compact mode for list views (default: false) */
  compact?: boolean
  /** Whether to show the component (default: true) */
  enabled?: boolean
}

/**
 * Get status badge configuration
 */
function getStatusBadge(status: SignatureStatus['status']): {
  label: string
  bgColor: string
  textColor: string
} {
  switch (status) {
    case 'collecting':
      return {
        label: 'Collecting',
        bgColor: 'bg-yellow-800/30',
        textColor: 'text-yellow-300',
      }
    case 'ready':
      return {
        label: 'Ready',
        bgColor: 'bg-green-800/30',
        textColor: 'text-green-300',
      }
    case 'submitted':
      return {
        label: 'Submitted',
        bgColor: 'bg-cyan-800/30',
        textColor: 'text-cyan-300',
      }
    case 'expired':
      return {
        label: 'Expired',
        bgColor: 'bg-red-800/30',
        textColor: 'text-red-300',
      }
    default:
      return {
        label: 'Unknown',
        bgColor: 'bg-gray-800/30',
        textColor: 'text-gray-300',
      }
  }
}

/**
 * Get progress bar color based on percentage
 */
function getProgressColor(percentage: number, thresholdMet: boolean): string {
  if (thresholdMet) {
    return 'bg-green-500'
  }
  if (percentage >= 75) {
    return 'bg-yellow-500'
  }
  if (percentage >= 50) {
    return 'bg-orange-500'
  }
  return 'bg-red-500'
}

/**
 * SignatureProgress component
 *
 * Story 14.3, Task 9: Signature progress display
 *
 * Features:
 * - Progress bar showing collected/required signatures
 * - Threshold indicator
 * - Color coding based on progress
 * - Animated progress updates
 * - Compact mode for list views
 *
 * @param props - Component props
 */
export function SignatureProgress({
  betId,
  compact = false,
  enabled = true,
}: SignatureProgressProps) {
  const { data, isLoading, error } = useResolutionSignatures(betId, enabled)

  // Calculate progress values
  const progress = useMemo(() => {
    if (!data) {
      return {
        percentage: 0,
        thresholdMet: false,
        signedCount: 0,
        requiredCount: 0,
        totalKeepers: 0,
      }
    }

    const percentage = calculateSignatureProgress(data.signedCount, data.requiredCount)
    const thresholdMet = isThresholdMet(data.signedCount, data.requiredCount)

    return {
      percentage,
      thresholdMet,
      signedCount: data.signedCount,
      requiredCount: data.requiredCount,
      totalKeepers: data.totalKeepers,
    }
  }, [data])

  // Don't render if no data or loading
  if (!enabled) {
    return null
  }

  // Loading state
  if (isLoading && !data) {
    return (
      <div className={`font-mono ${compact ? 'text-xs' : 'text-sm'}`}>
        <span className="text-gray-500">Loading signatures...</span>
      </div>
    )
  }

  // Error state
  if (error) {
    return null // Silently fail - signature tracking may not be available
  }

  // No data - no signature collection in progress
  if (!data) {
    return (
      <div className={`font-mono ${compact ? 'text-xs' : 'text-sm'}`}>
        <span className="text-gray-500">Awaiting resolution...</span>
      </div>
    )
  }

  const statusBadge = getStatusBadge(data.status)
  const progressColor = getProgressColor(progress.percentage, progress.thresholdMet)

  // Compact mode - single line
  if (compact) {
    return (
      <div className="flex items-center gap-2 font-mono text-xs">
        <span className={`px-1.5 py-0.5 rounded ${statusBadge.bgColor} ${statusBadge.textColor}`}>
          {statusBadge.label}
        </span>
        <span className="text-white/60">
          {progress.signedCount}/{progress.requiredCount}
        </span>
        {data.status === 'collecting' && (
          <div className="w-16 h-1.5 bg-gray-700 rounded-full overflow-hidden">
            <div
              className={`h-full ${progressColor} transition-all duration-500 ease-out`}
              style={{ width: `${progress.percentage}%` }}
            />
          </div>
        )}
      </div>
    )
  }

  // Full mode
  return (
    <div className="border border-gray-700 rounded-lg p-3 bg-black/50 font-mono">
      {/* Header with status badge */}
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs text-gray-400 uppercase">Resolution Signatures</span>
        <span className={`px-2 py-1 rounded text-xs ${statusBadge.bgColor} ${statusBadge.textColor}`}>
          {statusBadge.label}
        </span>
      </div>

      {/* Progress bar */}
      <div className="mb-2">
        <div className="w-full h-2 bg-gray-700 rounded-full overflow-hidden">
          <div
            className={`h-full ${progressColor} transition-all duration-500 ease-out`}
            style={{ width: `${progress.percentage}%` }}
          />
        </div>
      </div>

      {/* Progress text */}
      <div className="flex items-center justify-between text-xs">
        <span className="text-white">
          {progress.signedCount}/{progress.totalKeepers} keepers signed
        </span>
        <span className={progress.thresholdMet ? 'text-green-400' : 'text-gray-400'}>
          Need {progress.requiredCount} (51%)
        </span>
      </div>

      {/* Submitted transaction link */}
      {data.status === 'submitted' && data.txHash && (
        <div className="mt-2 pt-2 border-t border-gray-700">
          <span className="text-xs text-gray-400">Tx: </span>
          <span className="text-xs text-cyan-400">
            {data.txHash.slice(0, 10)}...{data.txHash.slice(-8)}
          </span>
        </div>
      )}
    </div>
  )
}
