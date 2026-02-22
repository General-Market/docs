'use client'

import { useState, useMemo } from 'react'
import { useTranslations } from 'next-intl'
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
 * Status filter option values
 */
const STATUS_VALUES: (BilateralBetStatus | 'all')[] = ['all', 'active', 'in_arbitration', 'settled', 'custom_payout']

/**
 * Sort option values
 */
const SORT_VALUES: SortField[] = ['created', 'deadline', 'amount']

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
  const t = useTranslations('p2pool')
  const tc = useTranslations('common')

  // Translation maps for select options
  const statusLabels: Record<string, string> = {
    all: t('bilateral.all_statuses'),
    active: tc('status.active'),
    in_arbitration: t('bilateral.disputed'),
    settled: tc('status.confirmed'),
    custom_payout: t('bilateral.custom_split'),
  }

  const sortLabels: Record<string, string> = {
    created: t('bilateral.created_date'),
    deadline: t('bilateral.deadline'),
    amount: t('bilateral.amount'),
  }

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
          <label className="text-xs font-mono text-text-muted">{t('bets_table.status')}:</label>
          <select
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value as BilateralBetStatus | 'all')
              setPage(1)
            }}
            className="bg-muted border border-border-light rounded-lg px-3 py-1.5 text-sm font-mono text-text-primary focus:border-border-medium focus:outline-none"
          >
            {STATUS_VALUES.map((value) => (
              <option key={value} value={value}>
                {statusLabels[value]}
              </option>
            ))}
          </select>
        </div>

        {/* Sort Controls */}
        <div className="flex items-center gap-2">
          <label className="text-xs font-mono text-text-muted">{t('bilateral.sort_by')}</label>
          <select
            value={sortField}
            onChange={(e) => setSortField(e.target.value as SortField)}
            className="bg-muted border border-border-light rounded-lg px-3 py-1.5 text-sm font-mono text-text-primary focus:border-border-medium focus:outline-none"
          >
            {SORT_VALUES.map((value) => (
              <option key={value} value={value}>
                {sortLabels[value]}
              </option>
            ))}
          </select>
          <button
            onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
            className="px-2 py-1.5 border border-border-light rounded-lg text-sm font-mono text-text-primary hover:border-border-medium transition-colors"
            title={sortOrder === 'asc' ? 'Sort Ascending' : 'Sort Descending'}
          >
            {sortOrder === 'asc' ? '\u2191' : '\u2193'}
          </button>
        </div>

        {/* SSE Status Indicator */}
        <div className="flex items-center gap-2">
          <span
            className={`w-2 h-2 rounded-full ${
              sseConnected ? 'bg-green-500' : 'bg-gray-400'
            }`}
            title={sseConnected ? 'Real-time updates active' : 'Real-time updates disconnected'}
          />
          <span className="text-xs font-mono text-text-muted">
            {sseConnected ? tc('connection.live') : tc('connection.polling')}
          </span>
        </div>
      </div>

      {/* Loading State */}
      {isLoading && (
        <div className="flex items-center justify-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-zinc-900" />
        </div>
      )}

      {/* Error State */}
      {isError && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-center">
          <p className="text-red-600 font-mono text-sm">
            {t('bilateral.failed_to_load', { error: (error as Error)?.message || 'Unknown error' })}
          </p>
          <button
            onClick={() => refetch()}
            className="mt-2 px-4 py-1 bg-red-100 border border-red-200 rounded-lg text-sm font-mono text-red-700 hover:bg-red-200 transition-colors"
          >
            {tc('retry')}
          </button>
        </div>
      )}

      {/* Empty State */}
      {!isLoading && !isError && sortedBets.length === 0 && (
        <div className="bg-muted border border-border-light rounded-xl p-8 text-center">
          <p className="text-text-muted font-mono text-sm">{tc('empty.no_bilateral_bets')}</p>
          {statusFilter !== 'all' && (
            <p className="text-text-muted text-xs mt-2">
              {tc('empty.no_bilateral_bets_hint')}{' '}
              <button
                onClick={() => {
                  setStatusFilter('all')
                  setPage(1)
                }}
                className="text-color-info hover:text-color-info/80"
              >
                {t('bilateral.view_all_statuses')}
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
            className="px-3 py-1.5 border border-border-light rounded-lg text-sm font-mono text-text-primary hover:border-border-medium disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {tc('pagination.previous')}
          </button>
          <span className="text-sm font-mono text-text-muted px-4">
            {tc('pagination.page_of', { current: page, total: totalPages })}
          </span>
          <button
            onClick={() => handlePageChange(page + 1)}
            disabled={page >= totalPages}
            className="px-3 py-1.5 border border-border-light rounded-lg text-sm font-mono text-text-primary hover:border-border-medium disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {tc('pagination.next')}
          </button>
        </div>
      )}

      {/* Total count */}
      {data && (
        <div className="text-center text-xs font-mono text-text-muted">
          {tc('showing_of', { shown: sortedBets.length, total: data.total })}
        </div>
      )}
    </div>
  )
}
