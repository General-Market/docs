'use client'

import { useMemo } from 'react'
import { useTranslations } from 'next-intl'
import { useResolutionSignatures } from '@/hooks/useResolutionSignatures'
import {
  calculateSignatureProgress,
  isThresholdMet,
  type SignatureStatus,
} from '@/lib/types/resolution'
import { getTxUrl } from '@/lib/utils/explorer'

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
 * Get status badge configuration (colors only — labels are translated at render)
 */
function getStatusBadgeStyle(status: SignatureStatus['status']): {
  key: string
  bgColor: string
  textColor: string
} {
  switch (status) {
    case 'collecting':
      return {
        key: 'status_collecting',
        bgColor: 'bg-yellow-100',
        textColor: 'text-yellow-700',
      }
    case 'ready':
      return {
        key: 'status_ready',
        bgColor: 'bg-green-100',
        textColor: 'text-green-700',
      }
    case 'submitted':
      return {
        key: 'status_submitted',
        bgColor: 'bg-cyan-100',
        textColor: 'text-cyan-700',
      }
    case 'expired':
      return {
        key: 'status_expired',
        bgColor: 'bg-red-100',
        textColor: 'text-red-700',
      }
    default:
      return {
        key: 'status_unknown',
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
  const t = useTranslations('system')
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
        <span className="text-text-muted">{t('signature_progress.loading')}</span>
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
        <span className="text-text-muted">{t('signature_progress.awaiting')}</span>
      </div>
    )
  }

  const statusBadge = getStatusBadgeStyle(data.status)
  const statusLabel = t(`signature_progress.${statusBadge.key}`)
  const progressColor = getProgressColor(progress.percentage, progress.thresholdMet)

  // Compact mode - single line
  if (compact) {
    return (
      <div className="flex items-center gap-2 font-mono text-xs">
        <span className={`px-1.5 py-0.5 rounded ${statusBadge.bgColor} ${statusBadge.textColor}`}>
          {statusLabel}
        </span>
        <span className="text-text-muted">
          {progress.signedCount}/{progress.requiredCount}
        </span>
        {data.status === 'collecting' && (
          <div className="w-16 h-1.5 bg-border-light rounded-full overflow-hidden">
            <div
              className={`h-full ${progressColor} origin-left will-change-transform`}
              style={{
                width: '100%',
                transform: `scaleX(${(progress.percentage / 100).toFixed(4)})`,
                transition: 'transform 500ms cubic-bezier(0.25, 0.1, 0.3, 1)',
              }}
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
        <span className="text-xs text-text-muted uppercase">{t('signature_progress.label')}</span>
        <span className={`px-2 py-1 rounded text-xs ${statusBadge.bgColor} ${statusBadge.textColor}`}>
          {statusLabel}
        </span>
      </div>

      {/* Progress bar */}
      <div className="mb-2">
        <div className="w-full h-2 bg-border-light rounded-full overflow-hidden">
          <div
            className={`h-full ${progressColor} origin-left will-change-transform`}
            style={{
              width: '100%',
              transform: `scaleX(${(progress.percentage / 100).toFixed(4)})`,
              transition: 'transform 500ms cubic-bezier(0.25, 0.1, 0.3, 1)',
            }}
          />
        </div>
      </div>

      {/* Progress text */}
      <div className="flex items-center justify-between text-xs">
        <span className="text-text-primary">
          {t('signature_progress.keepers_signed', { signed: progress.signedCount, total: progress.totalKeepers })}
        </span>
        <span className={progress.thresholdMet ? 'text-green-600' : 'text-text-muted'}>
          {t('signature_progress.need_count', { count: progress.requiredCount })}
        </span>
      </div>

      {/* Submitted transaction link */}
      {data.status === 'submitted' && data.txHash && (
        <div className="mt-2 pt-2 border-t border-border-light">
          <a
            href={getTxUrl(data.txHash, 'l3')}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-color-info hover:text-text-primary transition-colors font-mono"
          >
            {t('signature_progress.tx_label', { hash: `${data.txHash.slice(0, 10)}...${data.txHash.slice(-8)}` })} ↗
          </a>
        </div>
      )}
    </div>
  )
}
