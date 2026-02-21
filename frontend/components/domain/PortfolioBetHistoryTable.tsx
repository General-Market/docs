'use client'

import { useState, useMemo, useCallback, useEffect, memo } from 'react'
import { useAccount } from 'wagmi'
import { useBetHistory, BetRecord } from '@/hooks/useBetHistory'
import { BetDetailsExpanded } from '@/components/domain/BetDetailsExpanded'
import { StatusBadge } from '@/components/ui/StatusBadge'
import { useToast } from '@/lib/contexts/ToastContext'
import { formatUSD, formatNumber, toBaseUnits } from '@/lib/utils/formatters'
import { formatRelativeTime } from '@/lib/utils/time'
import { getTxUrl } from '@/lib/utils/basescan'

const ITEMS_PER_PAGE = 20

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
          {(() => {
            const count = bet.tradeCount || bet.portfolioSize || 0
            return count >= 1000
              ? `${(count / 1000).toFixed(1)}K`
              : count
          })()} markets
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
 * Empty state component
 */
function EmptyState() {
  return (
    <tr>
      <td colSpan={6} className="px-4 py-12 text-center">
        <p className="text-text-muted">No bets found</p>
        <p className="text-text-muted text-sm mt-1">
          Place your first bet to see it here
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
  if (totalPages <= 1) return null

  return (
    <div className="flex items-center justify-between px-4 py-3 border-t border-border-light">
      <button
        onClick={onPrev}
        disabled={currentPage === 1}
        className="px-3 py-1 border border-border-medium text-text-muted text-sm font-mono hover:text-text-primary hover:border-zinc-900 disabled:opacity-30 disabled:cursor-not-allowed transition-colors rounded"
      >
        Previous
      </button>
      <span className="text-text-muted text-sm font-mono">
        Page {currentPage} of {totalPages}
      </span>
      <button
        onClick={onNext}
        disabled={currentPage === totalPages}
        className="px-3 py-1 border border-border-medium text-text-muted text-sm font-mono hover:text-text-primary hover:border-zinc-900 disabled:opacity-30 disabled:cursor-not-allowed transition-colors rounded"
      >
        Next
      </button>
    </div>
  )
}

/**
 * Portfolio Bet History Table
 * Displays user's bet history with expandable rows, pagination, and auto-refresh
 */
export function PortfolioBetHistoryTable() {
  const { address, isConnected } = useAccount()
  const { bets, isLoading, isError, error } = useBetHistory({ address })

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
      <div className="border border-border-medium rounded-xl p-6 text-center">
        <p className="text-text-muted">Connect your wallet to view bet history</p>
      </div>
    )
  }

  // Error state
  if (isError) {
    return (
      <div className="border border-color-down/50 rounded-xl p-6 text-center">
        <p className="text-color-down">Error loading bet history</p>
        <p className="text-text-muted text-sm mt-1">{error?.message}</p>
      </div>
    )
  }

  return (
    <div className="border border-border-light rounded-xl shadow-card">
      {/* Table Header */}
      <div className="bg-muted px-4 py-3 border-b border-border-medium rounded-t-xl">
        <h3 className="text-lg font-bold text-text-primary">Bet History</h3>
        <p className="text-sm text-text-muted">
          {isLoading ? 'Loading...' : `${formatNumber(bets.length)} total bets`}
        </p>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="bg-muted text-xs font-medium uppercase tracking-wider text-text-muted border-b border-border-medium">
              <th className="px-4 py-2 text-left">Portfolio Size</th>
              <th className="px-4 py-2 text-left">Amount</th>
              <th className="px-4 py-2 text-left">Status</th>
              <th className="px-4 py-2 text-left">Created</th>
              <th className="px-4 py-2 text-left">Tx Hash</th>
              <th className="px-4 py-2 w-8"></th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <LoadingSkeleton />
            ) : paginatedBets.length === 0 ? (
              <EmptyState />
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
