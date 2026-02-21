'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { DATA_NODE_URL } from '@/lib/config'

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
  threshold_pct?: number | null
  start_date?: string
  // Regime overlays
  fng_mode?: string
  fng_fear?: number
  fng_greed?: number
  fng_cash_pct?: number
  dom_mode?: string
  dom_lookback?: number
  // VC overlay
  vc_mode?: string
  vc_investors?: string
  vc_min_amount_m?: number
  vc_round_types?: string
}

interface UseSimulationResult {
  status: 'idle' | 'loading' | 'done' | 'error'
  progress: SimProgress | null
  result: SimRunResult | null
  error: string | null
  run: () => void
  cancel: () => void
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
    if (params.threshold_pct != null) qs.set('threshold_pct', String(params.threshold_pct))
    if (params.start_date) qs.set('start_date', params.start_date)
    // Regime overlays
    if (params.fng_mode) {
      qs.set('fng_mode', params.fng_mode)
      if (params.fng_fear != null) qs.set('fng_fear_threshold', String(params.fng_fear))
      if (params.fng_greed != null) qs.set('fng_greed_threshold', String(params.fng_greed))
      if (params.fng_cash_pct != null) qs.set('fng_cash_pct', String(params.fng_cash_pct))
    }
    if (params.dom_mode) {
      qs.set('dom_mode', params.dom_mode)
      if (params.dom_lookback != null) qs.set('dom_lookback', String(params.dom_lookback))
    }
    // VC overlay
    if (params.vc_mode) {
      qs.set('vc_mode', params.vc_mode)
      if (params.vc_investors) qs.set('vc_investors', params.vc_investors)
      if (params.vc_min_amount_m) qs.set('vc_min_amount_m', String(params.vc_min_amount_m))
      if (params.vc_round_types) qs.set('vc_round_types', params.vc_round_types)
    }

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

  const cancel = useCallback(() => {
    cleanup()
    setStatus('idle')
  }, [cleanup])

  return { status, progress, result, error, run, cancel }
}
