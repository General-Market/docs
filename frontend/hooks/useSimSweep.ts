'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import type { SimRunResult, SimStats, SimNavPoint } from './useSimulation'
import { DATA_NODE_URL } from '@/lib/config'

export interface SweepProgress {
  variant: string
  variant_index: number
  total_variants: number
  pct: number
  current_date: string
}

export interface SweepVariantResult {
  variant: string
  run_id: number
  stats: SimStats
  nav_series: SimNavPoint[]
  cached: boolean
}

interface UseSimSweepParams {
  category_id: string
  sweep: string  // 'top_n' | 'weighting' | 'rebalance' | 'threshold' | 'category' | 'defi_weight' | 'fng_regime' | 'dom_regime'
  weighting: string
  rebalance_days: number
  top_n: number
  base_fee_pct: number
  spread_multiplier: number
  categories?: string[]  // for category sweep
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

interface UseSimSweepResult {
  status: 'idle' | 'loading' | 'done' | 'error'
  progress: SweepProgress | null
  completedVariants: SweepVariantResult[]
  error: string | null
  run: () => void
  cancel: () => void
}

export function useSimSweep(params: UseSimSweepParams | null): UseSimSweepResult {
  const [status, setStatus] = useState<'idle' | 'loading' | 'done' | 'error'>('idle')
  const statusRef = useRef(status)
  statusRef.current = status
  const [progress, setProgress] = useState<SweepProgress | null>(null)
  const [completedVariants, setCompletedVariants] = useState<SweepVariantResult[]>([])
  const [error, setError] = useState<string | null>(null)
  const eventSourceRef = useRef<EventSource | null>(null)

  const cleanup = useCallback(() => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close()
      eventSourceRef.current = null
    }
  }, [])

  const run = useCallback(() => {
    if (!params || !params.sweep) return
    // For category sweep, need categories array; for others, need category_id
    if (params.sweep === 'category') {
      if (!params.categories || params.categories.length < 2) return
    } else {
      if (!params.category_id) return
    }

    cleanup()
    setStatus('loading')
    setProgress(null)
    setCompletedVariants([])
    setError(null)

    const qs = new URLSearchParams({
      sweep: params.sweep,
      weighting: params.weighting,
      rebalance_days: String(params.rebalance_days),
      top_n: String(params.top_n),
      base_fee_pct: String(params.base_fee_pct),
      spread_multiplier: String(params.spread_multiplier),
    })
    if (params.category_id) qs.set('category_id', params.category_id)
    if (params.categories?.length) qs.set('categories', params.categories.join(','))
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

    const es = new EventSource(`${DATA_NODE_URL}/sim/sweep-stream?${qs}`)
    eventSourceRef.current = es

    es.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data)
        if (data.type === 'progress') {
          setProgress({
            variant: data.variant,
            variant_index: data.variant_index,
            total_variants: data.total_variants,
            pct: data.pct,
            current_date: data.current_date,
          })
        } else if (data.type === 'variant_done') {
          setCompletedVariants(prev => [...prev, {
            variant: data.variant,
            run_id: data.run_id,
            stats: data.stats,
            nav_series: data.nav_series || [],
            cached: data.cached,
          }])
        } else if (data.type === 'variant_error') {
          // Continue sweep, just note the error
          console.warn(`Sweep variant ${data.variant} failed: ${data.error}`)
        } else if (data.type === 'sweep_done') {
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
      if (statusRef.current === 'loading') {
        setError('Connection lost')
        setStatus('error')
      }
      cleanup()
    }
  }, [params, cleanup])

  useEffect(() => cleanup, [cleanup])

  const cancel = useCallback(() => {
    cleanup()
    setStatus('idle')
  }, [cleanup])

  return { status, progress, completedVariants, error, run, cancel }
}
