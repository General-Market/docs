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

// Fast poll for Binance-style live ticking
const POLL_MS = 300
const CACHE_TTL_MS = 1_500

// Module-level cache shared across hook instances
const cache = new Map<string, CacheEntry>()

/** Fire-and-forget prefetch that warms the module-level cache.
 *  Call once per ITP on page load so data is ready before hover. */
export function prefetchOrderbook(itpId: string, levels: number = 15) {
  const cacheKey = `${itpId}:${levels}:0`
  const cached = cache.get(cacheKey)
  if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) return

  const params = new URLSearchParams({
    itp_id: itpId,
    levels: String(levels),
    aggregation_bps: '0',
  })

  fetch(`${DATA_NODE_URL}/itp-orderbook?${params}`)
    .then(res => res.ok ? res.json() : null)
    .then((result: OrderbookData | null) => {
      if (result) {
        cache.set(cacheKey, { data: result, timestamp: Date.now() })
      }
    })
    .catch(() => {})
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

  // Poll every 300ms for Binance-style live ticking.
  // Client cache (1.5s) means most polls are instant no-ops;
  // every ~1.5s a real fetch fires to get fresh depth from backend.
  useEffect(() => {
    if (!enabled || !itpId) {
      cancel()
      setData(null)
      setIsLoading(false)
      setError(null)
      return
    }

    // Show cached data immediately if available
    const cacheKey = `${itpId}:${levels}:${aggregationBps}`
    const cached = cache.get(cacheKey)
    if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
      setData(cached.data)
      setIsLoading(false)
      setError(null)
    } else {
      setIsLoading(true)
    }

    doFetch()

    const interval = setInterval(doFetch, POLL_MS)

    return () => {
      clearInterval(interval)
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
