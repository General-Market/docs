'use client'

import { useState, useEffect, useRef, useCallback } from 'react'

const DATA_NODE_URL = process.env.NEXT_PUBLIC_DATA_NODE_URL || 'http://localhost:8200'

export interface SimNavPoint {
  nav_date: string
  nav: number
  drawdown_pct: number
}

export interface SimStats {
  total_return_pct: number
  annualized_return: number
  max_drawdown_pct: number
  sharpe_ratio: number
  total_fees_pct: number
  total_trades: number
  total_rebalances: number
  total_delistings: number
  start_date: string | null
  end_date: string | null
}

export interface SimRunResult {
  run_id: number
  config: {
    category_id: string
    top_n: number
    weighting: string
    rebalance_days: number
    base_fee_pct: number
    spread_multiplier: number
  }
  stats: SimStats
  nav_series: SimNavPoint[]
  cached: boolean
  computed_in_ms?: number
}

export interface SimProgress {
  current_date: string
  total_dates: number
  pct: number
}

interface UseSimulationParams {
  category_id: string
  top_n: number
  weighting: string
  rebalance_days: number
  base_fee_pct: number
  spread_multiplier: number
}

interface UseSimulationResult {
  status: 'idle' | 'loading' | 'done' | 'error'
  progress: SimProgress | null
  result: SimRunResult | null
  error: string | null
  run: () => void
}

export function useSimulation(params: UseSimulationParams | null): UseSimulationResult {
  const [status, setStatus] = useState<'idle' | 'loading' | 'done' | 'error'>('idle')
  const [progress, setProgress] = useState<SimProgress | null>(null)
  const [result, setResult] = useState<SimRunResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const eventSourceRef = useRef<EventSource | null>(null)

  const cleanup = useCallback(() => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close()
      eventSourceRef.current = null
    }
  }, [])

  const run = useCallback(() => {
    if (!params || !params.category_id) return

    cleanup()
    setStatus('loading')
    setProgress(null)
    setResult(null)
    setError(null)

    const qs = new URLSearchParams({
      category_id: params.category_id,
      top_n: String(params.top_n),
      weighting: params.weighting,
      rebalance_days: String(params.rebalance_days),
      base_fee_pct: String(params.base_fee_pct),
      spread_multiplier: String(params.spread_multiplier),
    })

    const es = new EventSource(`${DATA_NODE_URL}/sim/run-stream?${qs}`)
    eventSourceRef.current = es

    es.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data)
        if (data.type === 'progress') {
          setProgress({
            current_date: data.current_date,
            total_dates: data.total_dates,
            pct: data.pct,
          })
        } else if (data.type === 'result') {
          setResult(data as SimRunResult)
          setStatus('done')
          cleanup()
        } else if (data.type === 'error') {
          setError(data.error)
          setStatus('error')
          cleanup()
        }
      } catch {
        // ignore parse errors
      }
    }

    es.onerror = () => {
      if (status === 'loading') {
        setError('Connection lost')
        setStatus('error')
      }
      cleanup()
    }
  }, [params, cleanup, status])

  // Cleanup on unmount
  useEffect(() => cleanup, [cleanup])

  return { status, progress, result, error, run }
}
