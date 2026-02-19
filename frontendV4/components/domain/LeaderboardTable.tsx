'use client'

import { useState, useCallback, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { AnimatePresence } from 'framer-motion'
import { useLeaderboard } from '@/hooks/useLeaderboard'
import { useLeaderboardSSE } from '@/hooks/useLeaderboardSSE'
import { usePrefersReducedMotion, useIsMobile } from '@/hooks/useMediaQueries'
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
import { AnimatedLeaderboardRow } from '@/components/domain/AnimatedLeaderboardRow'
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
            <div className="h-4 w-8 bg-white/10 animate-pulse rounded" />
          </TableCell>
          <TableCell>
            <div className="h-4 w-24 bg-white/10 animate-pulse rounded" />
          </TableCell>
          <TableCell>
            <div className="h-4 w-20 bg-white/10 animate-pulse rounded" />
          </TableCell>
          {/* Performance sparkline skeleton (AC4) */}
          <TableCell className="hidden lg:table-cell">
            <div className="h-10 w-24 bg-white/10 animate-pulse rounded" />
          </TableCell>
          <TableCell className="hidden md:table-cell">
            <div className="h-4 w-12 bg-white/10 animate-pulse rounded" />
          </TableCell>
          <TableCell className="hidden md:table-cell">
            <div className="h-4 w-16 bg-white/10 animate-pulse rounded" />
          </TableCell>
          <TableCell>
            <div className="h-4 w-16 bg-white/10 animate-pulse rounded" />
          </TableCell>
          <TableCell className="hidden md:table-cell">
            <div className="h-4 w-12 bg-white/10 animate-pulse rounded" />
          </TableCell>
          <TableCell className="hidden md:table-cell">
            <div className="h-4 w-12 bg-white/10 animate-pulse rounded" />
          </TableCell>
          <TableCell className="hidden md:table-cell">
            <div className="h-4 w-20 bg-white/10 animate-pulse rounded" />
          </TableCell>
          <TableCell className="hidden md:table-cell">
            <div className="h-4 w-16 bg-white/10 animate-pulse rounded" />
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
      <TableCell colSpan={11} className="py-12 text-center">
        <p className="text-white/60 font-mono">No agents found</p>
        <p className="text-white/40 text-sm mt-1">
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
 * LeaderboardTable component
 * Displays agent rankings with Dev Arena-style design
 * Auto-refreshes every 30 seconds via SSE
 * Uses Shadcn/ui Table components (AC7)
 * Supports highlight prop for search functionality (Story 5.8)
 * Story 6.5: Animated row reorder and number count animations
 */
export function LeaderboardTable({ highlightedAddress }: LeaderboardTableProps = {}) {
  const router = useRouter()
  const { leaderboard, isLoading, isError, error, updatedAt } = useLeaderboard()

  // Enable SSE for real-time updates
  const { state: sseState, reconnectAttempt } = useLeaderboardSSE()

  // AC7: Detect reduced motion preference and mobile viewport
  const prefersReducedMotion = usePrefersReducedMotion()
  const isMobile = useIsMobile()

  // Track last click time to debounce rapid clicks
  const [lastClickTime, setLastClickTime] = useState(0)

  // Sort leaderboard by P&L descending (AC5) - ensures correct order even if backend returns unsorted
  const sortedLeaderboard = useMemo(() => {
    return [...leaderboard].sort((a, b) => b.pnl - a.pnl)
  }, [leaderboard])

  // Navigate to agent detail page with debounce
  const handleAgentClick = useCallback((walletAddress: string) => {
    const now = Date.now()
    if (now - lastClickTime < 300) return // Debounce 300ms
    setLastClickTime(now)
    router.push(`/agent/${walletAddress}`)
  }, [router, lastClickTime])

  // Error state
  if (isError) {
    return (
      <div className="border border-accent/50 p-6 text-center" role="alert">
        <p className="text-accent font-mono">Error loading leaderboard</p>
        <p className="text-white/40 text-sm mt-1">{error?.message}</p>
      </div>
    )
  }

  return (
    <div className="border border-white/20 bg-terminal">
      {/* Table Header */}
      <div className="bg-black px-4 py-3 border-b border-white/20 flex justify-between items-center">
        <div>
          <h3 className="text-lg font-bold text-white font-mono">Agent Leaderboard</h3>
          <p className="text-sm text-white/60 font-mono">
            {isLoading ? 'Loading...' : `${sortedLeaderboard.length} agents ranked by P&L`}
          </p>
        </div>
        <div className="text-right flex flex-col items-end gap-1">
          {updatedAt && (
            <p className="text-xs text-white/40 font-mono">
              Updated {formatRelativeTime(updatedAt)}
            </p>
          )}
          <ConnectionStatusIndicator state={sseState} reconnectAttempt={reconnectAttempt} />
        </div>
      </div>

      {/* Table with horizontal scroll on mobile */}
      <div className="overflow-x-auto">
        <Table aria-label="Agent Leaderboard - rankings sorted by P&L">
          <TableHeader>
            <TableRow className="bg-black border-b border-white/20 hover:bg-black">
              <TableHead className="text-center w-16">Rank</TableHead>
              <TableHead>Agent</TableHead>
              <TableHead>P&L</TableHead>
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
                  <span className="text-accent">Max Portfolio</span>
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
              /* AC5: AnimatePresence for smooth row reorder animations */
              <AnimatePresence initial={false} mode="popLayout">
                {sortedLeaderboard.map((agent) => (
                  <AnimatedLeaderboardRow
                    key={agent.walletAddress}
                    agent={agent}
                    onClick={() => handleAgentClick(agent.walletAddress)}
                    isHighlighted={highlightedAddress?.toLowerCase() === agent.walletAddress.toLowerCase()}
                    prefersReducedMotion={prefersReducedMotion}
                    isMobile={isMobile}
                  />
                ))}
              </AnimatePresence>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}
