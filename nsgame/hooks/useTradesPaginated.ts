'use client'

import { useState, useCallback, useRef, useEffect } from 'react'
import { getBackendUrl } from '@/lib/contracts/addresses'

/**
 * Trade record for virtual scroll display
 */
export interface VirtualTrade {
  tradeId: string
  ticker: string
  source: string
  method: string
  position: string
  entryPrice: string
  exitPrice?: string
  won?: boolean
  cancelled: boolean
  rank: number // computed from index
}

/**
 * Paginated trades response from backend
 */
interface TradesResponse {
  betId: string
  tradeCount: number
  trades: VirtualTrade[]
  pagination: {
    page: number
    limit: number
    total: number
    hasMore: boolean
  }
}

/**
 * Page cache entry
 */
interface PageCache {
  trades: VirtualTrade[]
  fetchedAt: number
}

/**
 * Configuration for paginated trades hook
 */
interface UseTradesPaginatedConfig {
  betId: string | number | undefined
  pageSize?: number
  maxCachedPages?: number
  enabled?: boolean
  maxRetries?: number
}

/**
 * Return type for paginated trades hook
 */
interface UseTradesPaginatedReturn {
  /** Get trade at specific index (returns placeholder if loading) */
  getTrade: (index: number) => VirtualTrade | null
  /** Total number of trades */
  total: number
  /** Check if initial load is complete */
  isInitialLoading: boolean
  /** Check if a specific index is loaded */
  isLoaded: (index: number) => boolean
  /** Trigger prefetch for a range */
  prefetchRange: (startIndex: number, endIndex: number) => void
  /** Clear cache (call on bet change) */
  clearCache: () => void
  /** Error state */
  error: Error | null
  /** Loading pages set */
  loadingPages: Set<number>
  /** Currently visible range (for LRU protection) */
  setVisibleRange: (start: number, end: number) => void
}

const PAGE_SIZE = 500
const MAX_CACHED_PAGES = 4 // Keep ~2000 trades max
const MAX_RETRIES = 3
const RETRY_DELAY_MS = 1000

/**
 * Hook for fetching trades with pagination and LRU cache
 * Implements virtual scroll data layer with prefetch support
 *
 * AC #2: Pagination API Integration
 * AC #3: Prefetch Strategy
 * AC #4: Memory Management
 */
export function useTradesPaginated({
  betId,
  pageSize = PAGE_SIZE,
  maxCachedPages = MAX_CACHED_PAGES,
  enabled = true,
  maxRetries = MAX_RETRIES
}: UseTradesPaginatedConfig): UseTradesPaginatedReturn {
  const [total, setTotal] = useState(0)
  const [isInitialLoading, setIsInitialLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)
  const [loadingPages, setLoadingPages] = useState<Set<number>>(new Set())

  // Page cache with LRU tracking
  const cacheRef = useRef<Map<number, PageCache>>(new Map())
  const pageAccessOrderRef = useRef<number[]>([])

  // Use ref for loading pages to avoid stale closures (FIX #3)
  const loadingPagesRef = useRef<Set<number>>(new Set())

  // Track visible range to protect from eviction (FIX #6)
  const visibleRangeRef = useRef<{ start: number; end: number }>({ start: 0, end: 0 })

  // AbortController for cleanup (FIX #4)
  const abortControllerRef = useRef<AbortController | null>(null)

  // Retry counts per page (FIX #7)
  const retryCountsRef = useRef<Map<number, number>>(new Map())

  const betIdStr = betId?.toString()

  /**
   * Fetch a single page from the API with abort support and retry logic
   */
  const fetchPage = useCallback(async (
    pageNum: number,
    signal?: AbortSignal,
    retryCount = 0
  ): Promise<VirtualTrade[]> => {
    if (!betIdStr) return []

    const backendUrl = getBackendUrl()

    try {
      const response = await fetch(
        `${backendUrl}/api/bets/${betIdStr}/trades?page=${pageNum}&limit=${pageSize}`,
        { signal }
      )

      if (!response.ok) {
        if (response.status === 404) {
          return []
        }
        throw new Error(`Failed to fetch trades: ${response.statusText}`)
      }

      const data: TradesResponse = await response.json()

      // Update total on first fetch
      if (pageNum === 1) {
        setTotal(data.pagination.total)
      }

      // Reset retry count on success
      retryCountsRef.current.delete(pageNum)

      // Add rank (computed from page + index)
      return (data.trades || []).map((trade, idx) => ({
        ...trade,
        rank: (pageNum - 1) * pageSize + idx + 1
      }))
    } catch (err) {
      // Don't retry if aborted
      if (signal?.aborted) {
        throw err
      }

      // Retry logic (FIX #7)
      if (retryCount < maxRetries) {
        const delay = RETRY_DELAY_MS * Math.pow(2, retryCount) // Exponential backoff
        await new Promise(resolve => setTimeout(resolve, delay))
        return fetchPage(pageNum, signal, retryCount + 1)
      }

      throw err
    }
  }, [betIdStr, pageSize, maxRetries])

  /**
   * LRU eviction - remove oldest accessed pages
   * AC #4: Max memory ~2000 trades
   * FIX #6: Protect pages in visible range from eviction
   */
  const evictOldPages = useCallback((currentPage: number) => {
    const cache = cacheRef.current
    const accessOrder = pageAccessOrderRef.current
    const { start, end } = visibleRangeRef.current

    // Calculate which pages are currently visible
    const visibleStartPage = Math.floor(start / pageSize) + 1
    const visibleEndPage = Math.floor(end / pageSize) + 1

    while (cache.size > maxCachedPages) {
      // Find oldest page that's not in visible range and not adjacent to current
      let evicted = false
      for (let i = 0; i < accessOrder.length; i++) {
        const pageToEvict = accessOrder[i]
        const distance = Math.abs(pageToEvict - currentPage)

        // Don't evict pages in visible range (FIX #6)
        const isVisible = pageToEvict >= visibleStartPage && pageToEvict <= visibleEndPage

        if (distance > 2 && !isVisible) {
          cache.delete(pageToEvict)
          accessOrder.splice(i, 1)
          evicted = true
          break
        }
      }

      // If all pages are protected, evict oldest non-visible anyway
      if (!evicted && cache.size > maxCachedPages && accessOrder.length > 0) {
        for (let i = 0; i < accessOrder.length; i++) {
          const pageToEvict = accessOrder[i]
          const isVisible = pageToEvict >= visibleStartPage && pageToEvict <= visibleEndPage
          if (!isVisible) {
            cache.delete(pageToEvict)
            accessOrder.splice(i, 1)
            break
          }
        }
      }

      // Safety: break if we can't evict anything (all pages visible)
      if (cache.size > maxCachedPages && accessOrder.every(p =>
        p >= visibleStartPage && p <= visibleEndPage
      )) {
        break
      }
    }
  }, [maxCachedPages, pageSize])

  /**
   * Mark page as accessed (LRU tracking)
   */
  const markPageAccessed = useCallback((pageNum: number) => {
    const accessOrder = pageAccessOrderRef.current
    const existingIdx = accessOrder.indexOf(pageNum)

    if (existingIdx !== -1) {
      accessOrder.splice(existingIdx, 1)
    }
    accessOrder.push(pageNum)
  }, [])

  /**
   * Load page if not cached
   * FIX #3: Use ref for loading check to avoid stale closure
   * FIX #4: Support abort signal for cleanup
   */
  const loadPage = useCallback(async (pageNum: number, signal?: AbortSignal) => {
    const cache = cacheRef.current

    // Already cached or loading (use ref to avoid stale closure - FIX #3)
    if (cache.has(pageNum) || loadingPagesRef.current.has(pageNum)) {
      return
    }

    // Mark as loading in both ref and state
    loadingPagesRef.current.add(pageNum)
    setLoadingPages(prev => new Set(prev).add(pageNum))

    try {
      const trades = await fetchPage(pageNum, signal)

      // Check if aborted before updating state
      if (signal?.aborted) {
        return
      }

      cache.set(pageNum, {
        trades,
        fetchedAt: Date.now()
      })

      markPageAccessed(pageNum)
      evictOldPages(pageNum)

    } catch (err) {
      // Don't set error if aborted (FIX #4)
      if (signal?.aborted) {
        return
      }
      setError(err instanceof Error ? err : new Error('Failed to fetch trades'))
    } finally {
      // Remove from loading in both ref and state
      loadingPagesRef.current.delete(pageNum)
      setLoadingPages(prev => {
        const next = new Set(prev)
        next.delete(pageNum)
        return next
      })
    }
  }, [fetchPage, markPageAccessed, evictOldPages])

  /**
   * Get trade at index
   * Returns null if not loaded (triggers fetch)
   */
  const getTrade = useCallback((index: number): VirtualTrade | null => {
    const pageNum = Math.floor(index / pageSize) + 1
    const pageOffset = index % pageSize

    const cache = cacheRef.current
    const pageData = cache.get(pageNum)

    if (pageData) {
      markPageAccessed(pageNum)
      return pageData.trades[pageOffset] ?? null
    }

    // Trigger fetch for missing page
    loadPage(pageNum)
    return null
  }, [pageSize, loadPage, markPageAccessed])

  /**
   * Check if index is loaded
   */
  const isLoaded = useCallback((index: number): boolean => {
    const pageNum = Math.floor(index / pageSize) + 1
    return cacheRef.current.has(pageNum)
  }, [pageSize])

  /**
   * Prefetch a range of indices
   * AC #3: Prefetch next page when user scrolls past 50%
   * FIX #3: Use ref for loading check
   */
  const prefetchRange = useCallback((startIndex: number, endIndex: number) => {
    const startPage = Math.floor(startIndex / pageSize) + 1
    const endPage = Math.floor(endIndex / pageSize) + 1

    for (let page = startPage; page <= endPage; page++) {
      // Use ref for loading check to avoid stale closure (FIX #3)
      if (page > 0 && !cacheRef.current.has(page) && !loadingPagesRef.current.has(page)) {
        loadPage(page, abortControllerRef.current?.signal)
      }
    }
  }, [pageSize, loadPage])

  /**
   * Set visible range for LRU protection (FIX #6)
   */
  const setVisibleRange = useCallback((start: number, end: number) => {
    visibleRangeRef.current = { start, end }
  }, [])

  /**
   * Clear cache (call on bet change)
   * AC #4: Clear cache on bet change
   * FIX #4: Abort in-flight requests
   */
  const clearCache = useCallback(() => {
    // Abort any in-flight requests (FIX #4)
    abortControllerRef.current?.abort()
    abortControllerRef.current = new AbortController()

    cacheRef.current.clear()
    pageAccessOrderRef.current = []
    loadingPagesRef.current.clear()
    retryCountsRef.current.clear()
    visibleRangeRef.current = { start: 0, end: 0 }
    setTotal(0)
    setError(null)
    setLoadingPages(new Set())
  }, [])

  // Initial fetch on mount or bet change
  useEffect(() => {
    if (!enabled || !betIdStr) return

    // Create new AbortController for this bet (FIX #4)
    abortControllerRef.current = new AbortController()
    const signal = abortControllerRef.current.signal

    clearCache()
    setIsInitialLoading(true)

    loadPage(1, signal).finally(() => {
      if (!signal.aborted) {
        setIsInitialLoading(false)
      }
    })

    // Cleanup: abort on unmount or bet change (FIX #4)
    return () => {
      abortControllerRef.current?.abort()
    }
  }, [betIdStr, enabled, clearCache, loadPage])

  return {
    getTrade,
    total,
    isInitialLoading,
    isLoaded,
    prefetchRange,
    clearCache,
    error,
    loadingPages,
    setVisibleRange
  }
}
