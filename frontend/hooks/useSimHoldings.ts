'use client'

import { useState, useEffect } from 'react'
import { DATA_NODE_URL } from '@/lib/config'

export interface SimHolding {
  rebalance_date: string
  coin_id: string
  symbol: string
  weight: number
  quantity: number
  price_usd: number
}

interface UseSimHoldingsResult {
  holdings: SimHolding[]
  isLoading: boolean
  error: string | null
}

export function useSimHoldings(
  runId: number | null,
  date?: string | null,
): UseSimHoldingsResult {
  const [holdings, setHoldings] = useState<SimHolding[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!runId) {
      setHoldings([])
      return
    }

    let cancelled = false
    setIsLoading(true)
    setError(null)

    const qs = new URLSearchParams({ run_id: String(runId) })
    if (date) qs.set('date', date)

    fetch(`${DATA_NODE_URL}/sim/holdings?${qs}`, { signal: AbortSignal.timeout(10_000) })
      .then(r => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`)
        return r.json()
      })
      .then(data => {
        if (!cancelled) {
          setHoldings(data.holdings || [])
          setIsLoading(false)
        }
      })
      .catch(e => {
        if (!cancelled) {
          setError(e.message)
          setIsLoading(false)
        }
      })

    return () => { cancelled = true }
  }, [runId, date])

  return { holdings, isLoading, error }
}
