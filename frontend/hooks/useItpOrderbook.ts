'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { DATA_NODE_URL } from '@/lib/config'

export interface OrderbookLevel {
  price: number
  quantity: number
  usd_value: number
}

export interface AssetOrderbookSummary {
  symbol: string
  weight_bps: number
  mid_price: number
  spread_bps: number
  bid_depth_usd: number
  ask_depth_usd: number
}

export interface OrderbookData {
  bids: OrderbookLevel[]
  asks: OrderbookLevel[]
  mid_price: number
  spread_bps: number
  total_bid_depth_usd: number
  total_ask_depth_usd: number
  assets_included: number
  assets_failed: string[]
  per_asset: AssetOrderbookSummary[]
}

interface CacheEntry {
  data: OrderbookData
  timestamp: number
}

// Aggressive poll until depth arrives, then slow refresh
const FAST_POLL_MS = 800
const SLOW_POLL_MS = 5_000
const CACHE_TTL_MS = 4_000

// Module-level cache shared across hook instances
const cache = new Map<string, CacheEntry>()

function hasDepth(d: OrderbookData | null): boolean {
  return !!d && d.bids.length > 0 && d.asks.length > 0
}

export function useItpOrderbook(
  itpId: string | undefined,
  enabled: boolean,
  levels: number = 15,
): {
  data: OrderbookData | null
  isLoading: boolean
  error: string | null
  aggregationBps: number
  setAggregationBps: (bps: number) => void
  fetch: () => void
  cancel: () => void
} {
  const [data, setData] = useState<OrderbookData | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [aggregationBps, setAggregationBps] = useState(0)

  const abortRef = useRef<AbortController | null>(null)
  const hasDepthRef = useRef(false)

  const cancel = useCallback(() => {
    if (abortRef.current) {
      abortRef.current.abort()
      abortRef.current = null
    }
  }, [])

  const doFetch = useCallback(() => {
    if (!itpId) return

    const cacheKey = `${itpId}:${levels}:${aggregationBps}`
    const cached = cache.get(cacheKey)
    if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
      setData(cached.data)
      hasDepthRef.current = hasDepth(cached.data)
      setIsLoading(false)
      setError(null)
      return
    }

    // Cancel any in-flight request
    if (abortRef.current) {
      abortRef.current.abort()
    }

    const controller = new AbortController()
    abortRef.current = controller
    setIsLoading(true)

    const params = new URLSearchParams({
      itp_id: itpId,
      levels: String(levels),
      aggregation_bps: String(aggregationBps),
    })

    fetch(`${DATA_NODE_URL}/itp-orderbook?${params}`, {
      signal: controller.signal,
    })
      .then(res => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        return res.json()
      })
      .then((result: OrderbookData) => {
        cache.set(cacheKey, { data: result, timestamp: Date.now() })
        // Evict stale entries
        const now = Date.now()
        cache.forEach((v, k) => { if (now - v.timestamp > CACHE_TTL_MS * 3) cache.delete(k) })
        setData(result)
        hasDepthRef.current = hasDepth(result)
        setError(null)
      })
      .catch(err => {
        if (err.name === 'AbortError') return
        setError(err.message || 'Failed to fetch orderbook')
      })
      .finally(() => {
        if (!controller.signal.aborted) {
          setIsLoading(false)
        }
      })
  }, [itpId, levels, aggregationBps])

  // Fetch immediately on enable, then poll: fast until depth arrives, slow after
  useEffect(() => {
    if (!enabled || !itpId) {
      cancel()
      setData(null)
      setIsLoading(false)
      setError(null)
      hasDepthRef.current = false
      return
    }

    // Check cache immediately — show whatever we have
    const cacheKey = `${itpId}:${levels}:${aggregationBps}`
    const cached = cache.get(cacheKey)
    if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
      setData(cached.data)
      hasDepthRef.current = hasDepth(cached.data)
      setIsLoading(false)
      setError(null)
    } else {
      setIsLoading(true)
    }

    // Fire first fetch immediately (no debounce)
    doFetch()

    // Adaptive polling via setTimeout chain:
    // 800ms until real depth arrives, then 5s for live refresh
    let timer: ReturnType<typeof setTimeout> | null = null
    let stopped = false

    function tick() {
      if (stopped) return
      const delay = hasDepthRef.current ? SLOW_POLL_MS : FAST_POLL_MS
      timer = setTimeout(() => {
        if (stopped) return
        cache.delete(cacheKey)
        doFetch()
        tick()
      }, delay)
    }
    tick()

    return () => {
      stopped = true
      if (timer) clearTimeout(timer)
      cancel()
    }
  }, [enabled, itpId, levels, aggregationBps, doFetch, cancel])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      cancel()
    }
  }, [cancel])

  return {
    data,
    isLoading,
    error,
    aggregationBps,
    setAggregationBps,
    fetch: doFetch,
    cancel,
  }
}
