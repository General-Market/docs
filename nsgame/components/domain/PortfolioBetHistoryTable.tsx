'use client'

import { useState, useMemo, useCallback, useEffect, memo } from 'react'
import { useTranslations } from 'next-intl'
import { useAccount } from 'wagmi'
import { useBetHistory, BetRecord } from '@/hooks/useBetHistory'
import { BetDetailsExpanded } from '@/components/domain/BetDetailsExpanded'
import { StatusBadge } from '@/components/ui/StatusBadge'
import { useIsMobile } from '@/hooks/useMediaQueries'
import { formatUSD, formatNumber, toBaseUnits } from '@/lib/utils/formatters'
import { formatRelativeTime } from '@/lib/utils/time'
import { getTxUrl } from '@/lib/utils/explorer'

const ITEMS_PER_PAGE = 20

function formatTradeCount(bet: BetRecord): string {
  const count = bet.tradeCount || bet.portfolioSize || 0
  return count >= 1000 ? `${(count / 1000).toFixed(1)}K` : String(count)
}

interface BetRowProps {
  bet: BetRecord
  isExpanded: boolean
  onToggle: () => void
}

/**
 * Single bet row component - memoized to prevent unnecessary re-renders
 */
const BetRow = memo(function BetRow({ bet, isExpanded, onToggle }: BetRowProps) {
  const amount = toBaseUnits(bet.amount)

  return (
    <>
      <tr
        onClick={onToggle}
        className="cursor-pointer hover:bg-card-hover border-b border-border-light transition-colors"
      >
        {/* Portfolio Size - use tradeCount from backend (Epic 8) */}
        <td className="px-4 py-3 font-mono font-bold text-text-primary">
          {formatTradeCount(bet)} markets
        </td>

        {/* Amount */}
        <td className="px-4 py-3 font-mono text-text-primary">
          {formatUSD(amount)}
        </td>

        {/* Status */}
        <td className="px-4 py-3">
          <StatusBadge status={bet.status} />
        </td>

        {/* Created */}
        <td className="px-4 py-3 text-text-muted text-sm">
          {formatRelativeTime(bet.createdAt)}
        </td>

        {/* Tx Link */}
        <td className="px-4 py-3">
          {bet.txHash ? (
            <a
              href={getTxUrl(bet.txHash)}
              target="_blank"
              rel="noopener noreferrer"
              className="text-text-muted hover:text-text-primary text-sm font-mono transition-colors"
              onClick={(e) => e.stopPropagation()}
            >
              {bet.txHash.slice(0, 8)}...
            </a>
          ) : (
            <span className="text-text-muted text-sm font-mono">-</span>
          )}
        </td>

        {/* Expand Indicator */}
        <td className="px-4 py-3 text-text-muted">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className={`transition-transform ${isExpanded ? 'rotate-180' : ''}`}
          >
            <polyline points="6 9 12 15 18 9" />
          </svg>
        </td>
      </tr>

      {/* Expanded Details */}
      {isExpanded && (
        <tr>
          <td colSpan={6} className="bg-muted px-4 py-4 border-b border-border-light">
            <BetDetailsExpanded bet={bet} />
          </td>
        </tr>
      )}
    </>
  )
})

/**
 * Mobile card for a single bet, replaces table row below 768px
 */
const MobileBetCard = memo(function MobileBetCard({ bet, isExpanded, onToggle }: BetRowProps) {
  const amount = toBaseUnits(bet.amount)

  return (
    <div className="border-b border-border-light">
      <button
        onClick={onToggle}
        className="w-full text-left px-4 py-3 hover:bg-card-hover transition-colors"
      >
        {/* Row 1: Markets + Amount */}
        <div className="flex items-center justify-between gap-2">
          <span className="font-mono font-bold text-sm text-text-primary">
            {formatTradeCount(bet)} markets
          </span>
          <span className="font-mono text-sm text-text-primary tabular-nums">
            {formatUSD(amount)}
          </span>
        </div>
        {/* Row 2: Status + Time + Tx + Chevron */}
        <div className="flex items-center gap-3 mt-1.5">
          <StatusBadge status={bet.status} />
          <span className="text-xs text-text-muted">
            {formatRelativeTime(bet.createdAt)}
          </span>
          {bet.txHash && (
            <a
              href={getTxUrl(bet.txHash)}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-text-muted hover:text-text-primary font-mono transition-colors"
              onClick={(e) => e.stopPropagation()}
            >
              {bet.txHash.slice(0, 8)}...
            </a>
          )}
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className={`ml-auto text-text-muted transition-transform shrink-0 ${isExpanded ? 'rotate-180' : ''}`}
          >
            <polyline points="6 9 12 15 18 9" />
          </svg>
        </div>
      </button>
      {/* Expanded Details */}
      {isExpanded && (
        <div className="bg-muted px-4 py-4 border-t border-border-light">
          <BetDetailsExpanded bet={bet} />
        </div>
      )}
    </div>
  )
})

/**
 * Loading skeleton for table rows
 */
function LoadingSkeleton() {
  return (
    <>
      {Array.from({ length: 5 }).map((_, i) => (
        <tr key={i} className="border-b border-border-light">
          <td className="px-4 py-3">
            <div className="h-4 w-24 bg-muted animate-pulse rounded" />
          </td>
          <td className="px-4 py-3">
            <div className="h-4 w-20 bg-muted animate-pulse rounded" />
          </td>
          <td className="px-4 py-3">
            <div className="h-4 w-16 bg-muted animate-pulse rounded" />
          </td>
          <td className="px-4 py-3">
            <div className="h-4 w-16 bg-muted animate-pulse rounded" />
          </td>
          <td className="px-4 py-3">
            <div className="h-4 w-20 bg-muted animate-pulse rounded" />
          </td>
          <td className="px-4 py-3">
            <div className="h-4 w-4 bg-muted animate-pulse rounded" />
          </td>
        </tr>
      ))}
    </>
  )
}

/**
 * Mobile loading skeleton
 */
function MobileLoadingSkeleton() {
  return (
    <>
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="px-4 py-3 border-b border-border-light">
          <div className="flex items-center justify-between">
            <div className="h-4 w-24 bg-muted animate-pulse rounded" />
            <div className="h-4 w-16 bg-muted animate-pulse rounded" />
          </div>
          <div className="flex gap-3 mt-2">
            <div className="h-3 w-14 bg-muted animate-pulse rounded" />
            <div className="h-3 w-12 bg-muted animate-pulse rounded" />
          </div>
        </div>
      ))}
    </>
  )
}

/**
 * Empty state component
 */
function EmptyState({ isMobile }: { isMobile: boolean }) {
  const t = useTranslations('common')
  if (isMobile) {
    return (
      <div className="px-4 py-12 text-center">
        <p className="text-text-muted">{t('empty.no_bets_found')}</p>
        <p className="text-text-muted text-sm mt-1">{t('empty.no_bets_found_hint')}</p>
      </div>
    )
  }
  return (
    <tr>
      <td colSpan={6} className="px-4 py-12 text-center">
        <p className="text-text-muted">{t('empty.no_bets_found')}</p>
        <p className="text-text-muted text-sm mt-1">
          {t('empty.no_bets_found_hint')}
        </p>
      </td>
    </tr>
  )
}

/**
 * Pagination controls component
 */
interface PaginationProps {
  currentPage: number
  totalPages: number
  onPrev: () => void
  onNext: () => void
}

function Pagination({ currentPage, totalPages, onPrev, onNext }: PaginationProps) {
  const tc = useTranslations('common')
  if (totalPages <= 1) return null

  return (
    <div className="flex items-center justify-between px-4 py-3 border-t border-border-light">
      <button
        onClick={onPrev}
        disabled={currentPage === 1}
        className="px-3 py-1.5 border border-border-medium text-text-muted text-sm font-mono hover:text-text-primary hover:border-brand disabled:opacity-30 disabled:cursor-not-allowed transition-colors rounded"
      >
        {tc('pagination.previous')}
      </button>
      <span className="text-text-muted text-sm font-mono">
        {tc('pagination.page_of', { current: currentPage, total: totalPages })}
      </span>
      <button
        onClick={onNext}
        disabled={currentPage === totalPages}
        className="px-3 py-1.5 border border-border-medium text-text-muted text-sm font-mono hover:text-text-primary hover:border-brand disabled:opacity-30 disabled:cursor-not-allowed transition-colors rounded"
      >
        {tc('pagination.next')}
      </button>
    </div>
  )
}

/**
 * Portfolio Bet History Table
 * Displays user's bet history with expandable rows, pagination, and auto-refresh
 * Mobile: card layout below 768px
 */
export function PortfolioBetHistoryTable() {
  const t = useTranslations('portfolio')
  const tc = useTranslations('common')
  const { address, isConnected } = useAccount()
  const { bets, isLoading, isError, error } = useBetHistory({ address })
  const isMobile = useIsMobile()

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1)

  // Expanded row state
  const [expandedBetId, setExpandedBetId] = useState<string | null>(null)

  // Paginated bets
  const { paginatedBets, totalPages } = useMemo(() => {
    const total = Math.ceil(bets.length / ITEMS_PER_PAGE)
    const start = (currentPage - 1) * ITEMS_PER_PAGE
    const end = start + ITEMS_PER_PAGE
    return {
      paginatedBets: bets.slice(start, end),
      totalPages: total || 1
    }
  }, [bets, currentPage])

  // Reset to page 1 when current page exceeds total pages
  useEffect(() => {
    if (currentPage > totalPages && totalPages > 0) {
      setCurrentPage(1)
    }
  }, [currentPage, totalPages])

  // Toggle row expansion
  const toggleExpanded = useCallback((betId: string) => {
    setExpandedBetId((prev) => (prev === betId ? null : betId))
  }, [])

  // Not connected state
  if (!isConnected) {
    return (
      <div className="border border-border-medium rounded-card p-6 text-center">
        <p className="text-text-muted">{t('bet_history.connect_to_view')}</p>
      </div>
    )
  }

  // Error state
  if (isError) {
    return (
      <div className="border border-color-down/50 rounded-card p-6 text-center">
        <p className="text-color-down">{t('bet_history.error_loading')}</p>
        <p className="text-text-muted text-sm mt-1">{error?.message}</p>
      </div>
    )
  }

  return (
    <div className="border border-border-light rounded-card shadow-card">
      {/* Table Header */}
      <div className="bg-muted px-4 py-3 border-b border-border-medium rounded-t-xl">
        <h3 className="text-lg font-bold text-text-primary">{t('bet_history.title')}</h3>
        <p className="text-sm text-text-muted">
          {isLoading ? tc('actions.loading') : t('bet_history.total_bets', { count: formatNumber(bets.length) })}
        </p>
      </div>

      {/* Mobile: card layout */}
      {isMobile ? (
        <div>
          {isLoading ? (
            <MobileLoadingSkeleton />
          ) : paginatedBets.length === 0 ? (
            <EmptyState isMobile />
          ) : (
            paginatedBets.map((bet) => (
              <MobileBetCard
                key={bet.betId}
                bet={bet}
                isExpanded={expandedBetId === bet.betId}
                onToggle={() => toggleExpanded(bet.betId)}
              />
            ))
          )}
        </div>
      ) : (
        /* Desktop: table */
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-muted text-xs font-medium uppercase tracking-[0.08em] text-text-muted border-b border-border-medium">
                <th className="px-4 py-2 text-left">{t('bet_history.portfolio_size')}</th>
                <th className="px-4 py-2 text-left">{t('bet_history.amount')}</th>
                <th className="px-4 py-2 text-left">{t('bet_history.status')}</th>
                <th className="px-4 py-2 text-left">{t('bet_history.created')}</th>
                <th className="px-4 py-2 text-left">{t('bet_history.tx_hash')}</th>
                <th className="px-4 py-2 w-8"></th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <LoadingSkeleton />
              ) : paginatedBets.length === 0 ? (
                <EmptyState isMobile={false} />
              ) : (
                paginatedBets.map((bet) => (
                  <BetRow
                    key={bet.betId}
                    bet={bet}
                    isExpanded={expandedBetId === bet.betId}
                    onToggle={() => toggleExpanded(bet.betId)}
                  />
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Pagination */}
      {!isLoading && bets.length > 0 && (
        <Pagination
          currentPage={currentPage}
          totalPages={totalPages}
          onPrev={() => setCurrentPage((p) => Math.max(p - 1, 1))}
          onNext={() => setCurrentPage((p) => Math.min(p + 1, totalPages))}
        />
      )}
    </div>
  )
}
