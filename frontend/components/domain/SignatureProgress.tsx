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
        bgColor: 'bg-yellow-100',
        textColor: 'text-yellow-700',
      }
    case 'ready':
      return {
        label: 'Ready',
        bgColor: 'bg-green-100',
        textColor: 'text-green-700',
      }
    case 'submitted':
      return {
        label: 'Submitted',
        bgColor: 'bg-cyan-100',
        textColor: 'text-cyan-700',
      }
    case 'expired':
      return {
        label: 'Expired',
        bgColor: 'bg-red-100',
        textColor: 'text-red-700',
      }
    default:
      return {
        label: 'Unknown',
        bgColor: 'bg-gray-100',
        textColor: 'text-gray-600',
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
        <span className="text-text-muted">Loading signatures...</span>
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
        <span className="text-text-muted">Awaiting resolution...</span>
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
        <span className="text-text-muted">
          {progress.signedCount}/{progress.requiredCount}
        </span>
        {data.status === 'collecting' && (
          <div className="w-16 h-1.5 bg-border-light rounded-full overflow-hidden">
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
    <div className="border border-border-light rounded-xl p-3 bg-white shadow-card font-mono">
      {/* Header with status badge */}
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs text-text-muted uppercase">Resolution Signatures</span>
        <span className={`px-2 py-1 rounded text-xs ${statusBadge.bgColor} ${statusBadge.textColor}`}>
          {statusBadge.label}
        </span>
      </div>

      {/* Progress bar */}
      <div className="mb-2">
        <div className="w-full h-2 bg-border-light rounded-full overflow-hidden">
          <div
            className={`h-full ${progressColor} transition-all duration-500 ease-out`}
            style={{ width: `${progress.percentage}%` }}
          />
        </div>
      </div>

      {/* Progress text */}
      <div className="flex items-center justify-between text-xs">
        <span className="text-text-primary">
          {progress.signedCount}/{progress.totalKeepers} keepers signed
        </span>
        <span className={progress.thresholdMet ? 'text-green-600' : 'text-text-muted'}>
          Need {progress.requiredCount} (51%)
        </span>
      </div>

      {/* Submitted transaction link */}
      {data.status === 'submitted' && data.txHash && (
        <div className="mt-2 pt-2 border-t border-border-light">
          <span className="text-xs text-text-muted">Tx: </span>
          <span className="text-xs text-color-info">
            {data.txHash.slice(0, 10)}...{data.txHash.slice(-8)}
          </span>
        </div>
      )}
    </div>
  )
}
