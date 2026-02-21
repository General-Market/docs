'use client'

import { useState, useEffect, useRef } from 'react'
import { DATA_NODE_URL } from '@/lib/config'

export type NavTimeframe = '5m' | '15m' | '1h' | '1d'

interface OhlcPoint {
  time: number
  open: number
  high: number
  low: number
  close: number
}

interface NavSeriesResult {
  data: OhlcPoint[]
  isLoading: boolean
  error: string | null
  refresh: () => void
}

function timeframeToParams(tf: NavTimeframe, createdAt?: number): { from: string; to: string; interval: string } {
  const now = new Date()
  const to = now.toISOString()
  let lookbackMs: number

  switch (tf) {
    case '5m':
      lookbackMs = 24 * 60 * 60 * 1000 // 24h
      break
    case '15m':
      lookbackMs = 3 * 24 * 60 * 60 * 1000 // 3d
      break
    case '1h':
      lookbackMs = 7 * 24 * 60 * 60 * 1000 // 7d
      break
    case '1d':
      lookbackMs = 90 * 24 * 60 * 60 * 1000 // 90d
      break
  }

  let fromMs = now.getTime() - lookbackMs
  // If we know creation time, extend window to include it so chart starts from init
  if (createdAt && createdAt > 0) {
    const createdMs = createdAt * 1000
    if (createdMs < fromMs) {
      fromMs = createdMs
    }
  }
  const from = new Date(fromMs).toISOString()
  return { from, to, interval: tf }
}

export function useItpNavSeries(itpId: string | undefined, timeframe: NavTimeframe, createdAt?: number): NavSeriesResult {
  const [data, setData] = useState<OhlcPoint[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [refreshKey, setRefreshKey] = useState(0)

  const itpIdRef = useRef(itpId)
  itpIdRef.current = itpId

  useEffect(() => {
    if (!itpIdRef.current) {
      setIsLoading(false)
      return
    }

    const controller = new AbortController()

    setIsLoading(true)
    setError(null)

    const { from, to, interval } = timeframeToParams(timeframe, createdAt)
    const params = new URLSearchParams({
      itp_id: itpIdRef.current,
      from,
      to,
      interval,
    })

    fetch(`${DATA_NODE_URL}/nav-series?${params}`, {
      signal: controller.signal,
    })
      .then(async (response) => {
        if (!response.ok) {
          const body = await response.text().catch(() => '')
          throw new Error(`HTTP ${response.status}: ${body.slice(0, 200)}`)
        }
        return response.json()
      })
      .then((result) => {
        const points: OhlcPoint[] = (result.points || []).map((p: any) => ({
          time: p.time,
          open: parseFloat(p.open),
          high: parseFloat(p.high),
          low: parseFloat(p.low),
          close: parseFloat(p.close),
        }))
        setData(points)
      })
      .catch((e: any) => {
        if (e.name === 'AbortError') return
        setError(e.message || 'Failed to fetch NAV series')
      })
      .finally(() => {
        if (!controller.signal.aborted) {
          setIsLoading(false)
        }
      })

    return () => controller.abort()
  }, [timeframe, createdAt, refreshKey])

  const refresh = () => setRefreshKey(k => k + 1)

  return { data, isLoading, error, refresh }
}

interface LinePoint {
  time: number
  value: number
}

interface BtcSeriesResult {
  data: LinePoint[]
  isLoading: boolean
}

export function useBtcPriceSeries(
  timeframe: NavTimeframe,
  enabled: boolean,
  createdAt?: number,
): BtcSeriesResult {
  const [data, setData] = useState<LinePoint[]>([])
  const [isLoading, setIsLoading] = useState(false)

  useEffect(() => {
    if (!enabled) {
      setData([])
      return
    }

    const controller = new AbortController()
    setIsLoading(true)

    const { from, to, interval } = timeframeToParams(timeframe, createdAt)
    const params = new URLSearchParams({
      symbols: 'BTCUSDC',
      from,
      to,
      interval,
    })

    fetch(`${DATA_NODE_URL}/prices?${params}`, {
      signal: controller.signal,
    })
      .then(async (response) => {
        if (!response.ok) throw new Error(`HTTP ${response.status}`)
        return response.json()
      })
      .then((result: Record<string, { price: string; at: string }[]>) => {
        const btcPrices = result['BTCUSDC'] || []
        const points: LinePoint[] = btcPrices.map((p) => ({
          time: Math.floor(new Date(p.at).getTime() / 1000),
          value: parseFloat(p.price),
        }))
        // Sort chronologically
        points.sort((a, b) => a.time - b.time)
        setData(points)
      })
      .catch((e: any) => {
        if (e.name !== 'AbortError') {
          console.warn('Failed to fetch BTC prices:', e.message)
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) {
          setIsLoading(false)
        }
      })

    return () => controller.abort()
  }, [timeframe, enabled, createdAt])

  return { data, isLoading }
}
