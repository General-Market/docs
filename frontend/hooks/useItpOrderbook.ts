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

const CACHE_TTL_MS = 5_000
const DEBOUNCE_MS = 200

// Module-level cache shared across hook instances
const cache = new Map<string, CacheEntry>()

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
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const cancel = useCallback(() => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current)
      debounceRef.current = null
    }
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

  // Debounced fetch on enable / parameter change
  useEffect(() => {
    if (!enabled || !itpId) {
      cancel()
      setData(null)
      setIsLoading(false)
      setError(null)
      return
    }

    // Check cache immediately
    const cacheKey = `${itpId}:${levels}:${aggregationBps}`
    const cached = cache.get(cacheKey)
    if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
      setData(cached.data)
      setIsLoading(false)
      setError(null)
      return
    }

    setIsLoading(true)

    debounceRef.current = setTimeout(() => {
      doFetch()
    }, DEBOUNCE_MS)

    return () => {
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
