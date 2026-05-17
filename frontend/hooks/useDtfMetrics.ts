'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import type { TimeRange } from '@/hooks/useExplorerHealth'

export interface FillsBucket {
  bucket: string
  buy_count: number
  sell_count: number
  buy_amount: string
  sell_amount: string
  borrow_count: number
  repay_count: number
  supply_count: number
  withdraw_count: number
  borrow_amount: string
  repay_amount: string
  supply_amount: string
  withdraw_amount: string
}

export interface LifecycleBucket {
  bucket: string
  placed: number
  filled: number
  cancelled: number
}

export interface TvlPoint {
  snapshot_ts: string
  total_aum_usd: number
  itp_count: number
  supply_count: number
}

export interface HourlyBucket {
  bucket: string
  count: number
}

export interface DtfMetrics {
  fills: FillsBucket[]
  lifecycle: LifecycleBucket[]
  tvl: TvlPoint[]
  ordersPerHour: HourlyBucket[]
  loading: boolean
  error: string | null
}

const POLL_INTERVAL_MS = 60_000

async function fetchSeries<T>(endpoint: string, range: TimeRange): Promise<T[]> {
  const res = await fetch(`/api/explorer/dtf?endpoint=${endpoint}&range=${range}`, {
    signal: AbortSignal.timeout(15_000),
  })
  if (!res.ok) throw new Error(`${endpoint}: HTTP ${res.status}`)
  const data = await res.json()
  return data.series ?? []
}

export function useDtfMetrics(range: TimeRange): DtfMetrics {
  const [fills, setFills] = useState<FillsBucket[]>([])
  const [lifecycle, setLifecycle] = useState<LifecycleBucket[]>([])
  const [tvl, setTvl] = useState<TvlPoint[]>([])
  const [ordersPerHour, setOrdersPerHour] = useState<HourlyBucket[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const refresh = useCallback(async () => {
    try {
      const [f, l, t, o] = await Promise.all([
        fetchSeries<FillsBucket>('fills', range),
        fetchSeries<LifecycleBucket>('order-lifecycle', range),
        fetchSeries<TvlPoint>('tvl', range),
        fetchSeries<HourlyBucket>('orders-per-hour', range),
      ])
      setFills(f)
      setLifecycle(l)
      setTvl(t)
      setOrdersPerHour(o)
      setError(null)
    } catch (e) {
      console.error('[useDtfMetrics] fetch failed:', e)
      setError(e instanceof Error ? e.message : 'Failed to fetch DTF metrics')
    } finally {
      setLoading(false)
    }
  }, [range])

  useEffect(() => {
    setLoading(true)
    refresh()
    intervalRef.current = setInterval(refresh, POLL_INTERVAL_MS)
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current)
    }
  }, [refresh])

  return { fills, lifecycle, tvl, ordersPerHour, loading, error }
}
