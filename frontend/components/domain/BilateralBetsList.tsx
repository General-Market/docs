'use client'

import { useState, useMemo } from 'react'
import { useBilateralBets, useUserBilateralBets } from '@/hooks/useBilateralBets'
import { useBilateralBetsSSE } from '@/hooks/useBilateralBetsSSE'
import { BilateralBetCard } from './BilateralBetCard'
import type { BilateralBetStatus } from '@/lib/types/bilateral-bet'

type SortField = 'deadline' | 'amount' | 'created'
type SortOrder = 'asc' | 'desc'

interface BilateralBetsListProps {
  /** Filter to show only a specific user's bets */
  userAddress?: string
  /** Current user's address for role display in cards */
  currentUserAddress?: string
  /** Initial status filter */
  initialStatus?: BilateralBetStatus | 'all'
  /** Page size for pagination */
  pageSize?: number
  /** Optional className for container */
  className?: string
}

/**
 * Status filter options
 */
const STATUS_OPTIONS: { value: BilateralBetStatus | 'all'; label: string }[] = [
  { value: 'all', label: 'All Statuses' },
  { value: 'active', label: 'Active' },
  { value: 'in_arbitration', label: 'Disputed' },
  { value: 'settled', label: 'Settled' },
  { value: 'custom_payout', label: 'Custom Split' },
]

/**
 * Sort options
 */
const SORT_OPTIONS: { value: SortField; label: string }[] = [
  { value: 'created', label: 'Created Date' },
  { value: 'deadline', label: 'Deadline' },
  { value: 'amount', label: 'Amount' },
]

/**
 * BilateralBetsList component
 * Displays a filterable, sortable, paginated list of bilateral bets
 * Story 4-2, Task 6: Bilateral bet list view
 */
export function BilateralBetsList({
  userAddress,
  currentUserAddress,
  initialStatus = 'all',
  pageSize = 10,
  className = '',
}: BilateralBetsListProps) {
  // Filter and sort state
  const [statusFilter, setStatusFilter] = useState<BilateralBetStatus | 'all'>(initialStatus)
  const [sortField, setSortField] = useState<SortField>('created')
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc')
  const [page, setPage] = useState(1)

  // Connect SSE for real-time updates
  const { isConnected: sseConnected } = useBilateralBetsSSE()

  // Build query options
  const queryStatus = statusFilter === 'all' ? undefined : statusFilter
  const offset = (page - 1) * pageSize

  // Fetch bets - call both hooks unconditionally (React rules of hooks)
  // Only one will be enabled at a time based on userAddress
  const allBetsQuery = useBilateralBets({
    status: queryStatus,
    limit: pageSize,
    offset,
    enabled: !userAddress, // Only fetch all bets when no userAddress
  })

  const userBetsQuery = useUserBilateralBets(userAddress, {
    status: queryStatus,
    limit: pageSize,
    offset,
    enabled: !!userAddress, // Only fetch user bets when userAddress provided
  })

  // Use the appropriate query result based on whether we're filtering by user
  const { data, isLoading, isError, error, refetch } = userAddress
    ? userBetsQuery
    : allBetsQuery

  // Sort bets client-side (API handles pagination, we sort the current page)
  const sortedBets = useMemo(() => {
    if (!data?.bets) return []

    return [...data.bets].sort((a, b) => {
      let comparison = 0

      switch (sortField) {
        case 'deadline':
          comparison = new Date(a.deadline).getTime() - new Date(b.deadline).getTime()
          break
        case 'amount':
          comparison = parseFloat(a.totalAmount) - parseFloat(b.totalAmount)
          break
        case 'created':
        default:
          const aTime = a.committedAt ? new Date(a.committedAt).getTime() : 0
          const bTime = b.committedAt ? new Date(b.committedAt).getTime() : 0
          comparison = aTime - bTime
          break
      }

      return sortOrder === 'asc' ? comparison : -comparison
    })
  }, [data?.bets, sortField, sortOrder])

  // Pagination calculations
  const totalPages = data ? Math.ceil(data.total / pageSize) : 0

  // Handle page change
  const handlePageChange = (newPage: number) => {
    setPage(Math.max(1, Math.min(newPage, totalPages)))
  }

  return (
    <div className={`space-y-4 ${className}`}>
      {/* Filters and Sort Controls */}
      <div className="flex flex-wrap gap-4 items-center justify-between">
        {/* Status Filter */}
        <div className="flex items-center gap-2">
          <label className="text-xs font-mono text-gray-400">Status:</label>
          <select
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value as BilateralBetStatus | 'all')
              setPage(1)
            }}
            className="bg-black border border-gray-700 rounded px-3 py-1.5 text-sm font-mono text-white focus:border-cyan-500 focus:outline-none"
          >
            {STATUS_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>

        {/* Sort Controls */}
        <div className="flex items-center gap-2">
          <label className="text-xs font-mono text-gray-400">Sort by:</label>
          <select
            value={sortField}
            onChange={(e) => setSortField(e.target.value as SortField)}
            className="bg-black border border-gray-700 rounded px-3 py-1.5 text-sm font-mono text-white focus:border-cyan-500 focus:outline-none"
          >
            {SORT_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          <button
            onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
            className="px-2 py-1.5 border border-gray-700 rounded text-sm font-mono text-white hover:border-gray-500 transition-colors"
            title={sortOrder === 'asc' ? 'Sort Ascending' : 'Sort Descending'}
          >
            {sortOrder === 'asc' ? '\u2191' : '\u2193'}
          </button>
        </div>

        {/* SSE Status Indicator */}
        <div className="flex items-center gap-2">
          <span
            className={`w-2 h-2 rounded-full ${
              sseConnected ? 'bg-green-400' : 'bg-gray-500'
            }`}
            title={sseConnected ? 'Real-time updates active' : 'Real-time updates disconnected'}
          />
          <span className="text-xs font-mono text-gray-500">
            {sseConnected ? 'Live' : 'Polling'}
          </span>
        </div>
      </div>

      {/* Loading State */}
      {isLoading && (
        <div className="flex items-center justify-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-cyan-400" />
        </div>
      )}

      {/* Error State */}
      {isError && (
        <div className="bg-red-900/20 border border-red-800/50 rounded-lg p-4 text-center">
          <p className="text-red-400 font-mono text-sm">
            Failed to load bilateral bets: {(error as Error)?.message || 'Unknown error'}
          </p>
          <button
            onClick={() => refetch()}
            className="mt-2 px-4 py-1 bg-red-800/30 border border-red-700/50 rounded text-sm font-mono text-red-300 hover:bg-red-800/50 transition-colors"
          >
            Retry
          </button>
        </div>
      )}

      {/* Empty State */}
      {!isLoading && !isError && sortedBets.length === 0 && (
        <div className="bg-gray-900/30 border border-gray-800 rounded-lg p-8 text-center">
          <p className="text-gray-400 font-mono text-sm">No bilateral bets found</p>
          {statusFilter !== 'all' && (
            <p className="text-gray-500 text-xs mt-2">
              Try changing the status filter or{' '}
              <button
                onClick={() => {
                  setStatusFilter('all')
                  setPage(1)
                }}
                className="text-cyan-400 hover:text-cyan-300"
              >
                view all statuses
              </button>
            </p>
          )}
        </div>
      )}

      {/* Bets Grid */}
      {!isLoading && !isError && sortedBets.length > 0 && (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {sortedBets.map((bet) => (
            <BilateralBetCard
              key={bet.betId}
              bet={bet}
              currentUserAddress={currentUserAddress}
            />
          ))}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 pt-4">
          <button
            onClick={() => handlePageChange(page - 1)}
            disabled={page <= 1}
            className="px-3 py-1.5 border border-gray-700 rounded text-sm font-mono text-white hover:border-gray-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            Previous
          </button>
          <span className="text-sm font-mono text-gray-400 px-4">
            Page {page} of {totalPages}
          </span>
          <button
            onClick={() => handlePageChange(page + 1)}
            disabled={page >= totalPages}
            className="px-3 py-1.5 border border-gray-700 rounded text-sm font-mono text-white hover:border-gray-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            Next
          </button>
        </div>
      )}

      {/* Total count */}
      {data && (
        <div className="text-center text-xs font-mono text-gray-500">
          Showing {sortedBets.length} of {data.total} bilateral bet{data.total !== 1 ? 's' : ''}
        </div>
      )}
    </div>
  )
}
