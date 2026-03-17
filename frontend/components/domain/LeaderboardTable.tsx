'use client'

import { useCallback, useMemo, useRef } from 'react'
import { useTranslations } from 'next-intl'
import { useRouter } from 'next/navigation'
import { AnimatePresence } from 'framer-motion'
import { useLeaderboard, AgentRanking } from '@/hooks/useLeaderboard'
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
import {
  formatWalletAddress,
  formatROI,
  formatPortfolioSize,
  formatVolume,
} from '@/lib/utils/formatters'

/**
 * Mobile card for a single leaderboard agent
 */
function MobileAgentCard({ agent, onClick, isHighlighted }: {
  agent: AgentRanking
  onClick: () => void
  isHighlighted: boolean
}) {
  const roiColor = agent.roi >= 0 ? 'text-color-up' : 'text-color-down'
  const rankDisplay = agent.rank <= 3
    ? ['', '\u{1F947}', '\u{1F948}', '\u{1F949}'][agent.rank]
    : `#${agent.rank}`

  return (
    <button
      onClick={onClick}
      className={`w-full text-left px-4 py-3 border-b border-border-light hover:bg-surface transition-colors hover-lift ${
        isHighlighted ? 'bg-muted shadow-[0_0_15px_rgba(196,0,0,0.5)]' : ''
      } ${agent.rank <= 3 ? 'bg-muted/40 border-l-2 border-l-brand font-semibold' : ''}`}
    >
      {/* Row 1: Rank + Wallet + ROI */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-sm font-bold tabular-nums shrink-0 w-8">
            {rankDisplay}
          </span>
          <span className="font-mono text-sm text-text-primary truncate">
            {formatWalletAddress(agent.walletAddress)}
          </span>
        </div>
        <span className={`font-mono text-sm font-bold tabular-nums shrink-0 ${roiColor}`}>
          {formatROI(agent.roi)}
        </span>
      </div>
      {/* Row 2: Secondary stats */}
      <div className="flex items-center gap-4 mt-1.5 text-xs text-text-muted">
        <span className="font-mono">
          {formatPortfolioSize(agent.maxPortfolioSize)} max
        </span>
        <span className="font-mono">
          {(agent.totalBets ?? 0).toLocaleString()} bets
        </span>
        <span className="font-mono">
          {formatVolume(agent.volume)}
        </span>
        {agent.lastActiveAt && (
          <span className="ml-auto">
            {formatRelativeTime(agent.lastActiveAt)}
          </span>
        )}
      </div>
    </button>
  )
}

/**
 * Mobile loading skeleton
 */
function MobileSkeleton() {
  return (
    <>
      {Array.from({ length: 8 }).map((_, i) => (
        <div key={i} className="px-4 py-3 border-b border-border-light">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="h-4 w-6 bg-muted animate-pulse rounded" />
              <div className="h-4 w-24 bg-muted animate-pulse rounded" />
            </div>
            <div className="h-4 w-16 bg-muted animate-pulse rounded" />
          </div>
          <div className="flex gap-4 mt-2">
            <div className="h-3 w-14 bg-muted animate-pulse rounded" />
            <div className="h-3 w-14 bg-muted animate-pulse rounded" />
            <div className="h-3 w-14 bg-muted animate-pulse rounded" />
          </div>
        </div>
      ))}
    </>
  )
}

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
function EmptyState({ isMobile }: { isMobile: boolean }) {
  const t = useTranslations('common')
  if (isMobile) {
    return (
      <div className="py-12 text-center">
        <p className="text-text-muted">{t('empty.no_agents')}</p>
        <p className="text-text-muted text-sm mt-1">{t('empty.no_agents_hint')}</p>
      </div>
    )
  }
  return (
    <TableRow>
      <TableCell colSpan={9} className="py-12 text-center">
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
 * Mobile: card layout below 768px
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

  // Track last click time to debounce rapid clicks (ref to avoid re-creating callback)
  const lastClickTime = useRef(0)

  // Sort leaderboard by ROI descending - ensures correct order even if backend returns unsorted
  const sortedLeaderboard = useMemo(() => {
    return [...leaderboard].sort((a, b) => b.roi - a.roi)
  }, [leaderboard])

  // Navigate to agent detail page with debounce
  const handleAgentClick = useCallback((walletAddress: string) => {
    const now = Date.now()
    if (now - lastClickTime.current < 300) return // Debounce 300ms
    lastClickTime.current = now
    router.push(`/agent/${walletAddress}`)
  }, [router])

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
    <div className="border border-border-light overflow-hidden" data-fade-in>
      {/* Black section bar */}
      <div className="section-bar">
        <div className="flex items-center gap-2 sm:gap-3 min-w-0">
          <div className="flex items-center gap-2">
            <div className="section-bar-title">{t('leaderboard.title')}</div>
            <div className={`w-2 h-2 rounded-full ${sseState === 'connected' ? 'bg-color-up animate-pulse' : sseState === 'connecting' ? 'bg-color-warning animate-pulse' : 'bg-color-down'}`} />
          </div>
          <div className="section-bar-value truncate">
            {isLoading ? t('actions.loading') : t('leaderboard.agents_ranked', { count: sortedLeaderboard.length })}
          </div>
        </div>
        <div className="flex items-center gap-2 sm:gap-3 shrink-0">
          {updatedAt && (
            <span className="hidden sm:inline text-white/50 text-xs font-mono">
              {t('leaderboard.updated', { time: formatRelativeTime(updatedAt) })}
            </span>
          )}
          <ConnectionStatusIndicator state={sseState} reconnectAttempt={reconnectAttempt} />
        </div>
      </div>

      {/* Mobile: card layout */}
      {isMobile ? (
        <div>
          {isLoading ? (
            <MobileSkeleton />
          ) : sortedLeaderboard.length === 0 ? (
            <EmptyState isMobile />
          ) : (
            sortedLeaderboard.map((agent) => (
              <MobileAgentCard
                key={agent.walletAddress}
                agent={agent}
                onClick={() => handleAgentClick(agent.walletAddress)}
                isHighlighted={highlightedAddress?.toLowerCase() === agent.walletAddress.toLowerCase()}
              />
            ))
          )}
        </div>
      ) : (
        /* Desktop: table with horizontal scroll */
        <div className="overflow-x-auto">
          <Table aria-label="Agent Leaderboard - rankings sorted by ROI">
            <TableHeader>
              <TableRow>
                <TableHead className="text-center w-16">{t('leaderboard.rank')}</TableHead>
                <TableHead>{t('leaderboard.agent')}</TableHead>
                <TableHead>{t('leaderboard.roi')}</TableHead>
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
                    <span className="text-text-primary">{t('leaderboard.max_portfolio')}</span>
                  </Tooltip>
                </TableHead>
                <TableHead className="hidden md:table-cell">{t('leaderboard.volume')}</TableHead>
                <TableHead className="hidden md:table-cell">{t('leaderboard.last_active')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <LeaderboardSkeleton />
              ) : sortedLeaderboard.length === 0 ? (
                <EmptyState isMobile={false} />
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
      )}
    </div>
  )
}
