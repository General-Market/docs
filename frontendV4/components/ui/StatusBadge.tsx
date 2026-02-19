'use client'

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
 * Status configuration for action-oriented labels (Story 11-1, AC6)
 */
const STATUS_CONFIG: Record<string, { icon: string; label: string; color: string }> = {
  // Bet statuses - action-oriented labels (Story 14-1: single-filler model)
  pending: { icon: '○', label: 'Awaiting match', color: 'text-text-muted' },
  matched: { icon: '●', label: 'Position active', color: 'text-text-primary' },
  settling: { icon: '◐', label: 'Keepers voting', color: 'text-color-warning' },
  settled: { icon: '●', label: 'Settled', color: 'text-text-muted' },
  // Story 14-1: Early exit status
  early_exit: { icon: '⊗', label: 'Early exit', color: 'text-color-info' },
  // Resolution statuses (Epic 8: majority-wins)
  resolved: { icon: '✓', label: 'Resolved', color: 'text-color-up' },
  resolving: { icon: '◐', label: 'Keepers voting', color: 'text-color-warning' },
  tie: { icon: '≈', label: 'Tie', color: 'text-color-warning' },
  // Agent bet outcomes (AC6) - include P&L inline when available
  won: { icon: '✓', label: 'Won', color: 'text-color-up' },
  lost: { icon: '✗', label: 'Lost', color: 'text-color-down' },
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
  const config = STATUS_CONFIG[status] || { icon: '?', label: status, color: 'text-text-muted' }

  // Format P&L for won/lost statuses
  const formatPnL = (amount: number): string => {
    const sign = amount >= 0 ? '+' : ''
    return `${sign}$${Math.abs(amount).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
  }

  // Include P&L inline for won/lost
  let displayLabel = config.label
  if (pnl !== undefined && (status === 'won' || status === 'lost')) {
    displayLabel = `${config.label} ${formatPnL(pnl)}`
  }

  const sizeClasses = size === 'sm'
    ? 'text-[10px] px-1.5 py-0.5'
    : 'text-xs px-2 py-1'

  return (
    <span
      className={`inline-flex items-center gap-1 font-medium ${config.color} ${sizeClasses}`}
    >
      <span aria-hidden="true">{config.icon}</span>
      <span>{displayLabel}</span>
    </span>
  )
}

/**
 * StatusBadgeOld - Legacy badge style with background colors
 * Kept for backward compatibility
 */
export function StatusBadgeOld({ status }: { status: BadgeStatus }) {
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

  const getStatusLabel = (): string => {
    switch (status) {
      case 'pending':
        return 'Pending'
      case 'matched':
        return 'Matched'
      case 'settling':
        return 'Settling'
      case 'settled':
        return 'Settled'
      case 'resolved':
        return 'Resolved'
      case 'tie':
        return 'Tie'
      case 'won':
        return 'Won'
      case 'lost':
        return 'Lost'
      default:
        return status
    }
  }

  return (
    <span
      className={`px-2 py-1 text-xs font-bold rounded ${getStatusStyles()}`}
    >
      {getStatusLabel()}
    </span>
  )
}
