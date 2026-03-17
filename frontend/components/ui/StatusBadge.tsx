'use client'

import { useTranslations } from 'next-intl'
import type { BetStatus } from '@/hooks/useBetHistory'
import type { ResolutionStatus } from '@/hooks/useResolution'

/**
 * Agent bet status types (from useAgentBets)
 */
export type AgentBetStatus = 'pending' | 'matched' | 'settled'

/**
 * Agent bet outcome types (from useAgentBets)
 */
export type AgentBetOutcome = 'won' | 'lost'

/**
 * Combined status type for all status badges
 */
export type BadgeStatus = BetStatus | ResolutionStatus | AgentBetStatus | AgentBetOutcome

/**
 * Status icon and color configuration (no i18n needed for these)
 */
const STATUS_STYLE: Record<string, { icon: string; color: string }> = {
  pending: { icon: '○', color: 'text-text-muted' },
  matched: { icon: '●', color: 'text-text-primary' },
  settling: { icon: '◐', color: 'text-color-warning' },
  settled: { icon: '●', color: 'text-text-muted' },
  early_exit: { icon: '⊗', color: 'text-color-info' },
  resolved: { icon: '✓', color: 'text-color-up' },
  resolving: { icon: '◐', color: 'text-color-warning' },
  tie: { icon: '≈', color: 'text-color-warning' },
  won: { icon: '✓', color: 'text-color-up' },
  lost: { icon: '✗', color: 'text-color-down' },
}

/**
 * Status label translation keys
 */
const STATUS_LABEL_KEYS: Record<string, string> = {
  pending: 'status_badge.awaiting_match',
  matched: 'status_badge.position_active',
  settling: 'status_badge.keepers_voting',
  settled: 'status_badge.settled',
  early_exit: 'status_badge.early_exit',
  resolved: 'status_badge.resolved',
  resolving: 'status_badge.keepers_voting',
  tie: 'status_badge.tie',
  won: 'status_badge.won',
  lost: 'status_badge.lost',
}

interface StatusBadgeProps {
  status: BadgeStatus
  /** Optional P&L to display inline for won/lost statuses */
  pnl?: number
  /** Size variant */
  size?: 'sm' | 'md'
}

/**
 * Status badge component with action-oriented labels
 * Institutional style: semantic colors for up/down/warning
 * Supports both bet statuses and resolution statuses
 *
 * Story 11-1, AC6: Status System Upgrade
 * - Shows action-oriented labels (not just state names)
 * - Consistent icon + text pattern across all states
 * - Won/Lost includes P&L inline when provided
 */
export function StatusBadge({ status, pnl, size = 'md' }: StatusBadgeProps) {
  const t = useTranslations('common')
  const style = STATUS_STYLE[status] || { icon: '?', color: 'text-text-muted' }
  const labelKey = STATUS_LABEL_KEYS[status]
  const label = labelKey ? t(labelKey) : status

  // Format P&L for won/lost statuses
  const formatPnL = (amount: number): string => {
    const sign = amount >= 0 ? '+' : ''
    return `${sign}$${Math.abs(amount).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
  }

  // Include P&L inline for won/lost
  let displayLabel = label
  if (pnl !== undefined && (status === 'won' || status === 'lost')) {
    displayLabel = `${label} ${formatPnL(pnl)}`
  }

  const sizeClasses = size === 'sm'
    ? 'text-[10px] px-1.5 py-0.5'
    : 'text-xs px-2 py-1'

  return (
    <span
      className={`inline-flex items-center gap-1 font-medium ${style.color} ${sizeClasses}`}
    >
      <span aria-hidden="true">{style.icon}</span>
      <span>{displayLabel}</span>
    </span>
  )
}

/**
 * StatusBadgeOld - Legacy badge style with background colors
 * Kept for backward compatibility
 */
export function StatusBadgeOld({ status }: { status: BadgeStatus }) {
  const t = useTranslations('common')

  const getStatusStyles = (): string => {
    switch (status) {
      case 'pending':
        return 'bg-muted text-text-secondary'
      case 'matched':
        return 'bg-zinc-900 text-white'
      case 'settling':
      case 'settled':
        return 'bg-muted text-text-secondary'
      case 'resolved':
        return 'bg-surface-up text-color-up'
      case 'tie':
        return 'bg-surface-warning text-color-warning'
      case 'won':
        return 'bg-surface-up text-color-up'
      case 'lost':
        return 'bg-surface-down text-color-down'
      default:
        return 'bg-muted text-text-secondary'
    }
  }

  const labelKey = STATUS_LABEL_KEYS[status]
  const label = labelKey ? t(labelKey) : status

  return (
    <span
      className={`px-2 py-1 text-xs font-bold rounded ${getStatusStyles()}`}
    >
      {label}
    </span>
  )
}
