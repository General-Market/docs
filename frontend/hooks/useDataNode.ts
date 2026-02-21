'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { DATA_NODE_URL } from '@/lib/config'

// ---- Types ----

interface PriceAtTimeResult {
  symbol: string
  price: string
  fetched_at: string
  delta_seconds: number
  isLoading: boolean
  error: string | null
}

interface PricePoint {
  price: string
  at: string
}

interface PriceHistoryResult {
  data: Record<string, PricePoint[]>
  isLoading: boolean
  error: string | null
  refresh: () => Promise<void>
}

// ---- Point-in-time lookup ----

export function usePriceAtTime(
  symbol: string | undefined,
  at: string | undefined,
): PriceAtTimeResult {
  const [result, setResult] = useState<PriceAtTimeResult>({
    symbol: '',
    price: '',
    fetched_at: '',
    delta_seconds: 0,
    isLoading: true,
    error: null,
  })

  useEffect(() => {
    if (!symbol || !at) {
      setResult(prev => ({ ...prev, isLoading: false }))
      return
    }

    let cancelled = false
    setResult(prev => ({ ...prev, isLoading: true, error: null }))

    fetch(`${DATA_NODE_URL}/price?symbol=${encodeURIComponent(symbol)}&at=${encodeURIComponent(at)}`, {
      signal: AbortSignal.timeout(10_000),
    })
      .then(r => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`)
        return r.json()
      })
      .then(data => {
        if (!cancelled) {
          setResult({
            symbol: data.symbol,
            price: data.price,
            fetched_at: data.fetched_at,
            delta_seconds: data.delta_seconds,
            isLoading: false,
            error: null,
          })
        }
      })
      .catch(e => {
        if (!cancelled) {
          setResult(prev => ({ ...prev, isLoading: false, error: e.message }))
        }
      })

    return () => { cancelled = true }
  }, [symbol, at])

  return result
}

// ---- Time-series for charts ----

export function usePriceHistory(
  symbols: string[],
  from: string,
  to: string,
  interval?: '1m' | '5m' | '15m' | '1h' | '1d',
): PriceHistoryResult {
  const [data, setData] = useState<Record<string, PricePoint[]>>({})
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const symbolsKey = symbols.join(',')
  const symbolsRef = useRef(symbolsKey)
  symbolsRef.current = symbolsKey

  const refresh = useCallback(async () => {
    if (!symbolsRef.current || !from || !to) {
      setIsLoading(false)
      return
    }

    setIsLoading(true)
    setError(null)

    try {
      const params = new URLSearchParams({
        symbols: symbolsRef.current,
        from,
        to,
      })
      if (interval) params.set('interval', interval)

      const response = await fetch(`${DATA_NODE_URL}/prices?${params}`, {
        signal: AbortSignal.timeout(30_000),
      })

      if (!response.ok) throw new Error(`HTTP ${response.status}`)

      const result = await response.json()
      setData(result)
    } catch (e: any) {
      setError(e.message || 'Failed to fetch price history')
    } finally {
      setIsLoading(false)
    }
  }, [from, to, interval, symbolsKey])

  useEffect(() => {
    refresh()
  }, [refresh])

  return { data, isLoading, error, refresh }
}
