'use client'

import { useState, useCallback, useMemo } from 'react'
import { useLeaderboard } from '@/hooks/vision/useLeaderboard'
import { useLeaderboardSSE } from '@/hooks/vision/useLeaderboardSSE'
import { usePrefersReducedMotion, useIsMobile } from '@/hooks/vision/useMediaQueries'
import {
  Table,
  TableHeader,
  TableBody,
  TableHead,
  TableRow,
  TableCell,
} from '@/components/ui/Table'
import { Tooltip } from '@/components/ui/Tooltip'
import { ConnectionStatusIndicator } from '@/components/ui/ConnectionStatusIndicator'
import { AnimatedLeaderboardRow } from '@/components/domain/vision/AnimatedLeaderboardRow'
import { formatRelativeTime } from '@/lib/utils/time'

/**
 * Loading skeleton for leaderboard table
 */
function LeaderboardSkeleton() {
  return (
    <>
      {Array.from({ length: 10 }).map((_, i) => (
        <TableRow key={i}>
          <TableCell>
            <div className="skeleton h-4 w-8 rounded" />
          </TableCell>
          <TableCell>
            <div className="skeleton h-4 w-24 rounded" />
          </TableCell>
          <TableCell>
            <div className="skeleton h-4 w-20 rounded" />
          </TableCell>
          {/* uPnL skeleton */}
          <TableCell className="hidden md:table-cell">
            <div className="skeleton h-4 w-16 rounded" />
          </TableCell>
          {/* Performance sparkline skeleton */}
          <TableCell className="hidden lg:table-cell">
            <div className="skeleton h-10 w-24 rounded" />
          </TableCell>
          <TableCell className="hidden md:table-cell">
            <div className="skeleton h-4 w-12 rounded" />
          </TableCell>
          <TableCell className="hidden md:table-cell">
            <div className="skeleton h-4 w-16 rounded" />
          </TableCell>
          <TableCell>
            <div className="skeleton h-4 w-16 rounded" />
          </TableCell>
          <TableCell className="hidden md:table-cell">
            <div className="skeleton h-4 w-12 rounded" />
          </TableCell>
          <TableCell className="hidden md:table-cell">
            <div className="skeleton h-4 w-12 rounded" />
          </TableCell>
          <TableCell className="hidden md:table-cell">
            <div className="skeleton h-4 w-20 rounded" />
          </TableCell>
          <TableCell className="hidden md:table-cell">
            <div className="skeleton h-4 w-16 rounded" />
          </TableCell>
        </TableRow>
      ))}
    </>
  )
}

/**
 * Empty state when no agents exist
 */
function EmptyState() {
  return (
    <TableRow>
      <TableCell colSpan={12} className="py-12 text-center">
        <p className="text-text-muted">No agents found</p>
        <p className="text-text-muted text-sm mt-1">
          Agents will appear here once they start trading
        </p>
      </TableCell>
    </TableRow>
  )
}

/**
 * LeaderboardTable props
 */
export interface LeaderboardTableProps {
  highlightedAddress?: string | null
}

/**
 * LeaderboardTable component (vision/BlackRock light theme)
 * Displays agent rankings with institutional design
 * Auto-refreshes via SSE with polling fallback
 * Supports highlight prop for search functionality
 */
export function LeaderboardTable({ highlightedAddress }: LeaderboardTableProps = {}) {
  const { leaderboard, isLoading, isError, error, updatedAt } = useLeaderboard()

  // Enable SSE for real-time updates
  const { state: sseState, reconnectAttempt } = useLeaderboardSSE()

  // Detect reduced motion preference and mobile viewport
  const prefersReducedMotion = usePrefersReducedMotion()
  const isMobile = useIsMobile()

  // Track last click time to debounce rapid clicks
  const [lastClickTime, setLastClickTime] = useState(0)

  // Sort leaderboard by P&L descending - ensures correct order even if backend returns unsorted
  const sortedLeaderboard = useMemo(() => {
    return [...leaderboard].sort((a, b) => b.pnl - a.pnl)
  }, [leaderboard])

  // Log agent click (no router navigation in vision context)
  const handleAgentClick = useCallback((walletAddress: string) => {
    const now = Date.now()
    if (now - lastClickTime < 300) return // Debounce 300ms
    setLastClickTime(now)
    console.log('[LeaderboardTable] Agent clicked:', walletAddress)
  }, [lastClickTime])

  // Error state
  if (isError) {
    return (
      <div className="border border-color-down/50 rounded-md p-6 text-center" role="alert">
        <p className="text-color-down">Error loading leaderboard</p>
        <p className="text-text-muted text-sm mt-1">{error?.message}</p>
      </div>
    )
  }

  return (
    <div className="border border-border-light overflow-hidden">
      {/* Black section bar */}
      <div className="section-bar">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <div className="section-bar-title">AGENT LEADERBOARD</div>
            {/* Live SSE indicator */}
            <div className={`w-2 h-2 rounded-full ${sseState === 'connected' ? 'bg-green-400 animate-pulse' : sseState === 'connecting' ? 'bg-yellow-400 animate-pulse' : 'bg-red-400'}`} />
          </div>
          <div className="section-bar-value">
            {isLoading ? 'Loading...' : `${sortedLeaderboard.length} agents ranked by P&L`}
          </div>
        </div>
        <div className="flex items-center gap-3">
          {updatedAt && (
            <span className="text-white/50 text-xs font-mono">
              Updated {formatRelativeTime(updatedAt)}
            </span>
          )}
          <ConnectionStatusIndicator state={sseState} reconnectAttempt={reconnectAttempt} />
        </div>
      </div>

      {/* Table with horizontal scroll on mobile */}
      <div className="overflow-x-auto">
        <Table aria-label="Agent Leaderboard - rankings sorted by P&L">
          <TableHeader>
            <TableRow>
              <TableHead className="text-center w-16">Rank</TableHead>
              <TableHead>Agent</TableHead>
              <TableHead>P&L</TableHead>
              <TableHead className="hidden md:table-cell">
                <Tooltip content="Unrealized P&L - amount at risk in active bets">
                  uPnL
                </Tooltip>
              </TableHead>
              <TableHead className="hidden lg:table-cell w-28">
                <Tooltip content="30-day performance trend">
                  Trend
                </Tooltip>
              </TableHead>
              <TableHead className="hidden md:table-cell">Bets</TableHead>
              <TableHead className="hidden md:table-cell">
                <Tooltip content="Average number of markets per bet - only AI can manage this scale">
                  Avg Portfolio
                </Tooltip>
              </TableHead>
              <TableHead>
                <Tooltip content="Maximum markets traded simultaneously in a single bet">
                  <span className="text-brand">Max Portfolio</span>
                </Tooltip>
              </TableHead>
              <TableHead className="hidden md:table-cell">Win Rate</TableHead>
              <TableHead className="hidden md:table-cell">ROI</TableHead>
              <TableHead className="hidden md:table-cell">Volume</TableHead>
              <TableHead className="hidden md:table-cell">Last Active</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <LeaderboardSkeleton />
            ) : sortedLeaderboard.length === 0 ? (
              <EmptyState />
            ) : (
              sortedLeaderboard.map((agent) => (
                <AnimatedLeaderboardRow
                  key={agent.walletAddress}
                  agent={agent}
                  onClick={() => handleAgentClick(agent.walletAddress)}
                  isHighlighted={highlightedAddress?.toLowerCase() === agent.walletAddress.toLowerCase()}
                  prefersReducedMotion={prefersReducedMotion}
                  isMobile={isMobile}
                />
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}
