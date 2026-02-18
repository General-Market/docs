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
  pending: { icon: '○', label: 'Awaiting match', color: 'text-white/60' },
  matched: { icon: '●', label: 'Position active', color: 'text-white' },
  settling: { icon: '◐', label: 'Keepers voting', color: 'text-yellow-400' },
  settled: { icon: '●', label: 'Settled', color: 'text-white/60' },
  // Story 14-1: Early exit status
  early_exit: { icon: '⊗', label: 'Early exit', color: 'text-cyan-400' },
  // Resolution statuses (Epic 8: majority-wins)
  resolved: { icon: '✓', label: 'Resolved', color: 'text-green-400' },
  resolving: { icon: '◐', label: 'Keepers voting', color: 'text-yellow-400' },
  tie: { icon: '≈', label: 'Tie', color: 'text-yellow-400' },
  // Agent bet outcomes (AC6) - include P&L inline when available
  won: { icon: '✓', label: 'Won', color: 'text-green-400' },
  lost: { icon: '✗', label: 'Lost', color: 'text-red-400' },
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
 * Uses black/white/red color scheme
 * Supports both bet statuses and resolution statuses
 *
 * Story 11-1, AC6: Status System Upgrade
 * - Shows action-oriented labels (not just state names)
 * - Consistent icon + text pattern across all states
 * - Won/Lost includes P&L inline when provided
 */
export function StatusBadge({ status, pnl, size = 'md' }: StatusBadgeProps) {
  const config = STATUS_CONFIG[status] || { icon: '?', label: status, color: 'text-white/60' }

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
      className={`inline-flex items-center gap-1 font-mono font-medium ${config.color} ${sizeClasses}`}
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
        return 'bg-white/30 text-white'
      case 'matched':
        return 'bg-white text-black'
      case 'settling':
      case 'settled':
        return 'bg-white/30 text-white'
      case 'resolved':
        return 'bg-green-600 text-white'
      case 'tie':
        return 'bg-yellow-600 text-white'
      case 'won':
        return 'bg-green-600 text-white'
      case 'lost':
        return 'bg-accent text-white'
      default:
        return 'bg-white/30 text-white'
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
      className={`px-2 py-1 text-xs font-bold font-mono ${getStatusStyles()}`}
    >
      {getStatusLabel()}
    </span>
  )
}
