'use client'

import { useState, useCallback, useMemo } from 'react'
import { useTranslations } from 'next-intl'
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
            <div className="h-4 w-8 bg-muted animate-pulse rounded" />
          </TableCell>
          <TableCell>
            <div className="h-4 w-24 bg-muted animate-pulse rounded" />
          </TableCell>
          <TableCell>
            <div className="h-4 w-20 bg-muted animate-pulse rounded" />
          </TableCell>
          {/* Performance sparkline skeleton (AC4) */}
          <TableCell className="hidden lg:table-cell">
            <div className="h-10 w-24 bg-muted animate-pulse rounded" />
          </TableCell>
          <TableCell className="hidden md:table-cell">
            <div className="h-4 w-12 bg-muted animate-pulse rounded" />
          </TableCell>
          <TableCell className="hidden md:table-cell">
            <div className="h-4 w-16 bg-muted animate-pulse rounded" />
          </TableCell>
          <TableCell>
            <div className="h-4 w-16 bg-muted animate-pulse rounded" />
          </TableCell>
          <TableCell className="hidden md:table-cell">
            <div className="h-4 w-12 bg-muted animate-pulse rounded" />
          </TableCell>
          <TableCell className="hidden md:table-cell">
            <div className="h-4 w-12 bg-muted animate-pulse rounded" />
          </TableCell>
          <TableCell className="hidden md:table-cell">
            <div className="h-4 w-20 bg-muted animate-pulse rounded" />
          </TableCell>
          <TableCell className="hidden md:table-cell">
            <div className="h-4 w-16 bg-muted animate-pulse rounded" />
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
  const t = useTranslations('common')
  return (
    <TableRow>
      <TableCell colSpan={11} className="py-12 text-center">
        <p className="text-text-muted">{t('empty.no_agents')}</p>
        <p className="text-text-muted text-sm mt-1">
          {t('empty.no_agents_hint')}
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
  const t = useTranslations('common')
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
      <div className="border border-color-down/50 rounded-md p-6 text-center" role="alert">
        <p className="text-color-down">{t('leaderboard.error_loading')}</p>
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
            <div className="section-bar-title">{t('leaderboard.title')}</div>
            <div className={`w-2 h-2 rounded-full ${sseState === 'connected' ? 'bg-green-400 animate-pulse' : sseState === 'connecting' ? 'bg-yellow-400 animate-pulse' : 'bg-red-400'}`} />
          </div>
          <div className="section-bar-value">
            {isLoading ? t('actions.loading') : t('leaderboard.agents_ranked', { count: sortedLeaderboard.length })}
          </div>
        </div>
        <div className="flex items-center gap-3">
          {updatedAt && (
            <span className="text-white/50 text-xs font-mono">
              {t('leaderboard.updated', { time: formatRelativeTime(updatedAt) })}
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
              <TableHead className="text-center w-16">{t('leaderboard.rank')}</TableHead>
              <TableHead>{t('leaderboard.agent')}</TableHead>
              <TableHead>{t('leaderboard.pnl')}</TableHead>
              <TableHead className="hidden lg:table-cell w-28">
                <Tooltip content={t('leaderboard.trend_tooltip')}>
                  {t('leaderboard.trend')}
                </Tooltip>
              </TableHead>
              <TableHead className="hidden md:table-cell">{t('leaderboard.bets')}</TableHead>
              <TableHead className="hidden md:table-cell">
                <Tooltip content={t('leaderboard.avg_portfolio_tooltip')}>
                  {t('leaderboard.avg_portfolio')}
                </Tooltip>
              </TableHead>
              <TableHead>
                <Tooltip content={t('leaderboard.max_portfolio_tooltip')}>
                  <span className="text-zinc-900">{t('leaderboard.max_portfolio')}</span>
                </Tooltip>
              </TableHead>
              <TableHead className="hidden md:table-cell">{t('leaderboard.win_rate')}</TableHead>
              <TableHead className="hidden md:table-cell">{t('leaderboard.roi')}</TableHead>
              <TableHead className="hidden md:table-cell">{t('leaderboard.volume')}</TableHead>
              <TableHead className="hidden md:table-cell">{t('leaderboard.last_active')}</TableHead>
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
