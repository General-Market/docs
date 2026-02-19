'use client'

import { useCallback, useEffect, useRef, memo, CSSProperties, useMemo } from 'react'
import { List, ListImperativeAPI, RowComponentProps } from 'react-window'
import { VirtualTrade, useTradesPaginated } from '@/hooks/useTradesPaginated'

/**
 * Row height for each trade item
 * Consistent height required for react-window
 */
const ROW_HEIGHT = 48

/**
 * Number of rows to render outside visible area
 * AC #1: Buffer rows for smooth scrolling
 */
const OVERSCAN_COUNT = 20

/**
 * Prefetch threshold (% of page)
 * AC #3: Prefetch at 50% threshold
 */
const PREFETCH_THRESHOLD = 0.5

/**
 * Page size matching backend
 */
const PAGE_SIZE = 500

/**
 * Debounce delay for scroll handler (FIX #5)
 */
const SCROLL_DEBOUNCE_MS = 100

interface VirtualTradeListProps {
  betId: string | number
  height?: number
  isSettled?: boolean
}

/**
 * Trade row skeleton for loading state
 */
function TradeRowSkeleton({ style }: { style: CSSProperties }) {
  return (
    <div
      style={style}
      className="flex items-center justify-between px-3 py-2 border-b border-white/5"
    >
      <div className="w-10 h-4 bg-white/10 animate-pulse rounded" />
      <div className="w-24 h-4 bg-white/10 animate-pulse rounded" />
      <div className="w-16 h-4 bg-white/10 animate-pulse rounded" />
      <div className="w-12 h-4 bg-white/10 animate-pulse rounded" />
      <div className="w-16 h-4 bg-white/10 animate-pulse rounded" />
      <div className="w-16 h-4 bg-white/10 animate-pulse rounded" />
      <div className="w-10 h-4 bg-white/10 animate-pulse rounded" />
    </div>
  )
}

/**
 * Trade row component - memoized for performance
 */
const TradeRow = memo(function TradeRow({
  trade,
  style,
  isSettled
}: {
  trade: VirtualTrade
  style: CSSProperties
  isSettled: boolean
}) {
  const isCoingecko = trade.source === 'coingecko'

  const formatPrice = (price: string | undefined) => {
    if (!price) return '—'
    const num = parseFloat(price)
    if (isNaN(num)) return '—'
    if (isCoingecko) {
      return num >= 1000
        ? `$${num.toLocaleString(undefined, { maximumFractionDigits: 0 })}`
        : `$${num.toFixed(2)}`
    }
    return `${(num * 100).toFixed(1)}%`
  }

  // Position normalization for display
  const normalizedPosition = trade.position.toUpperCase()
  const isLongOrYes = normalizedPosition === 'LONG' || normalizedPosition === 'YES' || normalizedPosition === '1'
  const displayPosition = normalizedPosition === '1' ? 'YES' : normalizedPosition === '0' ? 'NO' : normalizedPosition

  return (
    <div
      style={style}
      className={`flex items-center justify-between px-3 py-2 border-b border-white/5 text-sm font-mono ${
        trade.cancelled ? 'opacity-40' : ''
      }`}
    >
      {/* Rank */}
      <span className="w-10 text-white/40 text-xs">{trade.rank}</span>

      {/* Ticker */}
      <span className="w-28 text-white truncate" title={trade.ticker}>
        {trade.ticker}
      </span>

      {/* Source */}
      <span className="w-16 text-white/50 text-xs">{trade.source}</span>

      {/* Position */}
      <span
        className={`w-14 text-center font-bold ${
          isLongOrYes ? 'text-green-400' : 'text-red-400'
        }`}
      >
        {displayPosition}
      </span>

      {/* Entry Price */}
      <span className="w-20 text-right text-white/60">
        {formatPrice(trade.entryPrice)}
      </span>

      {/* Exit Price - only for settled bets */}
      {isSettled && (
        <span className="w-20 text-right text-white">
          {formatPrice(trade.exitPrice)}
        </span>
      )}

      {/* Result - only for settled bets */}
      {isSettled && (
        <span
          className={`w-12 text-center font-bold ${
            trade.cancelled
              ? 'text-white/30'
              : trade.won === true
                ? 'text-green-400'
                : trade.won === false
                  ? 'text-red-400'
                  : 'text-white/30'
          }`}
        >
          {trade.cancelled ? 'X' : trade.won === true ? 'W' : trade.won === false ? 'L' : '—'}
        </span>
      )}
    </div>
  )
})

/**
 * Row data passed to row renderer
 * FIX #2: Proper typing for react-window v2 rowProps
 */
interface RowData {
  getTrade: (index: number) => VirtualTrade | null
  isLoaded: (index: number) => boolean
  isSettled: boolean
}

/**
 * Row renderer component for react-window List
 * FIX #2: Properly typed row component using react-window v2 API
 *
 * In react-window v2, rowProps are passed as additional properties
 * on the RowComponentProps object, not spread into the component.
 */
function RowRenderer(props: RowComponentProps<RowData>) {
  const { index, style } = props
  // react-window v2 passes rowProps as a 'data' property or merged into props
  // Access via type assertion that matches actual v2 behavior
  const rowData = (props as RowComponentProps<RowData> & RowData)

  // Fallback: try multiple access patterns for compatibility
  const getTrade = rowData.getTrade ?? (props as unknown as { data?: RowData }).data?.getTrade
  const isLoaded = rowData.isLoaded ?? (props as unknown as { data?: RowData }).data?.isLoaded
  const isSettled = rowData.isSettled ?? (props as unknown as { data?: RowData }).data?.isSettled ?? false

  if (!isLoaded || !isLoaded(index)) {
    return <TradeRowSkeleton style={style} />
  }

  const trade = getTrade?.(index)
  if (!trade) {
    return <TradeRowSkeleton style={style} />
  }

  return <TradeRow trade={trade} style={style} isSettled={isSettled} />
}

/**
 * Virtual scroll trade list component
 *
 * AC #1: Virtual scroll implementation
 * AC #2: Pagination API integration
 * AC #3: Prefetch strategy
 * AC #4: Memory management
 * AC #5: Loading states
 * AC #6: Trade display
 */
export function VirtualTradeList({ betId, height = 400, isSettled = false }: VirtualTradeListProps) {
  const listRef = useRef<ListImperativeAPI>(null)

  // Debounce timer ref (FIX #5)
  const scrollDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const {
    getTrade,
    total,
    isInitialLoading,
    isLoaded,
    prefetchRange,
    error,
    loadingPages,
    setVisibleRange
  } = useTradesPaginated({
    betId,
    pageSize: PAGE_SIZE,
    enabled: !!betId
  })

  /**
   * Handle scroll for prefetch
   * AC #3: Prefetch next page when user scrolls past 50%
   * FIX #5: Debounced to prevent excessive API calls
   */
  const handleRowsRendered = useCallback(
    (visibleRows: { startIndex: number; stopIndex: number }) => {
      const startIndex = visibleRows.startIndex
      const endIndex = visibleRows.stopIndex

      // Update visible range immediately for LRU protection (FIX #6)
      setVisibleRange(startIndex, endIndex)

      // Debounce the prefetch logic (FIX #5)
      if (scrollDebounceRef.current) {
        clearTimeout(scrollDebounceRef.current)
      }

      scrollDebounceRef.current = setTimeout(() => {
        // Calculate current page position
        const currentPage = Math.floor(startIndex / PAGE_SIZE)
        const pageProgress = (startIndex % PAGE_SIZE) / PAGE_SIZE

        // Prefetch next page when past threshold
        if (pageProgress > PREFETCH_THRESHOLD) {
          const nextPageStart = (currentPage + 1) * PAGE_SIZE
          const nextPageEnd = nextPageStart + PAGE_SIZE - 1
          prefetchRange(nextPageStart, Math.min(nextPageEnd, total - 1))
        }

        // Also prefetch previous page if scrolling up
        if (currentPage > 0 && pageProgress < (1 - PREFETCH_THRESHOLD)) {
          const prevPageStart = (currentPage - 1) * PAGE_SIZE
          const prevPageEnd = prevPageStart + PAGE_SIZE - 1
          prefetchRange(prevPageStart, prevPageEnd)
        }

        // Prefetch only adjacent pages, not full buffer (FIX #5)
        const adjacentStart = Math.max(0, (currentPage - 1) * PAGE_SIZE)
        const adjacentEnd = Math.min(total - 1, (currentPage + 2) * PAGE_SIZE - 1)
        prefetchRange(adjacentStart, adjacentEnd)
      }, SCROLL_DEBOUNCE_MS)
    },
    [total, prefetchRange, setVisibleRange]
  )

  // Cleanup debounce timer on unmount
  useEffect(() => {
    return () => {
      if (scrollDebounceRef.current) {
        clearTimeout(scrollDebounceRef.current)
      }
    }
  }, [])

  // Initial prefetch - only first page, second will be prefetched on scroll
  useEffect(() => {
    if (total > 0) {
      // Prefetch first page only (second page loads via scroll prefetch)
      prefetchRange(0, Math.min(PAGE_SIZE - 1, total - 1))
    }
  }, [total, prefetchRange])

  // Initial loading skeleton
  if (isInitialLoading) {
    return (
      <div className="space-y-1">
        {Array.from({ length: 10 }).map((_, i) => (
          <TradeRowSkeleton key={i} style={{}} />
        ))}
      </div>
    )
  }

  // Error state
  if (error) {
    return (
      <div className="p-4 text-center">
        <p className="text-red-400 font-mono text-sm">Failed to load trades</p>
        <p className="text-white/40 font-mono text-xs mt-1">{error.message}</p>
      </div>
    )
  }

  // No trades
  if (total === 0) {
    return (
      <div className="p-8 text-center">
        <p className="text-white/40 font-mono text-sm">No trades found</p>
      </div>
    )
  }

  // Row props for List component
  const rowProps: RowData = {
    getTrade,
    isLoaded,
    isSettled
  }

  return (
    <div className="relative">
      {/* Column headers */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-white/20 text-xs text-white/40 font-mono sticky top-0 bg-terminal z-10">
        <span className="w-10">#</span>
        <span className="w-28">Ticker</span>
        <span className="w-16">Source</span>
        <span className="w-14 text-center">Pos</span>
        <span className="w-20 text-right">Entry</span>
        {isSettled && <span className="w-20 text-right">Exit</span>}
        {isSettled && <span className="w-12 text-center">Result</span>}
      </div>

      {/* Total count */}
      <div className="px-3 py-1 text-xs text-white/30 font-mono border-b border-white/10">
        Total: {total.toLocaleString()} trades
        {loadingPages.size > 0 && (
          <span className="ml-2 text-cyan-400 animate-pulse">
            (loading...)
          </span>
        )}
      </div>

      {/* Virtual list */}
      <List
        listRef={listRef}
        defaultHeight={height}
        rowCount={total}
        rowHeight={ROW_HEIGHT}
        overscanCount={OVERSCAN_COUNT}
        onRowsRendered={handleRowsRendered}
        rowComponent={RowRenderer}
        rowProps={rowProps}
        style={{ width: '100%', height }}
      />
    </div>
  )
}

export default VirtualTradeList
