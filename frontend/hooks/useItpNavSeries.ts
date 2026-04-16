'use client'

import { useState, useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
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

const LOOKBACK_MS: Record<NavTimeframe, number> = {
  '5m': 24 * 60 * 60 * 1000,
  '15m': 3 * 24 * 60 * 60 * 1000,
  '1h': 7 * 24 * 60 * 60 * 1000,
  '1d': 90 * 24 * 60 * 60 * 1000,
}

// Cache duration per timeframe — short bars stale fast, long bars don't.
const STALE_MS: Record<NavTimeframe, number> = {
  '5m': 30_000,
  '15m': 60_000,
  '1h': 5 * 60_000,
  '1d': 30 * 60_000,
}

// Bucket the `to` timestamp so concurrent callers share the same query key.
// Without this, every render produces a unique cache key and React Query
// can't dedupe.
function bucketedNow(tf: NavTimeframe): number {
  const bucket = STALE_MS[tf]
  return Math.floor(Date.now() / bucket) * bucket
}

async function fetchNavSeries(
  itpId: string,
  timeframe: NavTimeframe,
  createdAt: number | undefined,
  signal: AbortSignal,
): Promise<OhlcPoint[]> {
  const toMs = bucketedNow(timeframe)
  let fromMs = toMs - LOOKBACK_MS[timeframe]
  if (createdAt && createdAt > 0) {
    const createdMs = createdAt * 1000
    if (createdMs < fromMs) fromMs = createdMs
  }

  const params = new URLSearchParams({
    itp_id: itpId,
    from: new Date(fromMs).toISOString(),
    to: new Date(toMs).toISOString(),
    interval: timeframe,
  })

  const res = await fetch(`${DATA_NODE_URL}/nav-series?${params}`, { signal })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`HTTP ${res.status}: ${body.slice(0, 200)}`)
  }
  const result = await res.json()
  return (result.points || []).map((p: any) => ({
    time: p.time,
    open: parseFloat(p.open),
    high: parseFloat(p.high),
    low: parseFloat(p.low),
    close: parseFloat(p.close),
  }))
}

export function useItpNavSeries(
  itpId: string | undefined,
  timeframe: NavTimeframe,
  createdAt?: number,
): NavSeriesResult {
  const query = useQuery({
    queryKey: ['itp-nav-series', itpId, timeframe, createdAt ?? 0, bucketedNow(timeframe)],
    queryFn: ({ signal }) => fetchNavSeries(itpId!, timeframe, createdAt, signal),
    enabled: !!itpId,
    staleTime: STALE_MS[timeframe],
    gcTime: 10 * 60_000,
    refetchOnWindowFocus: false,
    retry: 1,
  })

  return {
    data: query.data ?? [],
    isLoading: query.isLoading,
    error: query.error ? (query.error as Error).message : null,
    refresh: () => query.refetch(),
  }
}

interface LinePoint {
  time: number
  value: number
}

interface BtcSeriesResult {
  data: LinePoint[]
  isLoading: boolean
}

function timeframeToParams(tf: NavTimeframe, createdAt?: number): { from: string; to: string; interval: string } {
  const toMs = bucketedNow(tf)
  let fromMs = toMs - LOOKBACK_MS[tf]
  if (createdAt && createdAt > 0) {
    const createdMs = createdAt * 1000
    if (createdMs < fromMs) fromMs = createdMs
  }
  return { from: new Date(fromMs).toISOString(), to: new Date(toMs).toISOString(), interval: tf }
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
