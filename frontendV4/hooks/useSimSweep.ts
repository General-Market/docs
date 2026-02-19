'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import type { SimRunResult, SimStats, SimNavPoint } from './useSimulation'

const DATA_NODE_URL = process.env.NEXT_PUBLIC_DATA_NODE_URL || 'http://localhost:8200'

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
  sweep: string  // 'top_n' | 'weighting' | 'rebalance' | 'threshold' | 'category'
  weighting: string
  rebalance_days: number
  top_n: number
  base_fee_pct: number
  spread_multiplier: number
  categories?: string[]  // for category sweep
  threshold_pct?: number | null
  start_date?: string
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
      if (status === 'loading') {
        setError('Connection lost')
        setStatus('error')
      }
      cleanup()
    }
  }, [params, cleanup, status])

  useEffect(() => cleanup, [cleanup])

  const cancel = useCallback(() => {
    cleanup()
    setStatus('idle')
  }, [cleanup])

  return { status, progress, completedVariants, error, run, cancel }
}
