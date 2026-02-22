'use client'

import { useState, useEffect, useCallback } from 'react'
import { DATA_NODE_URL } from '@/lib/config'

export interface Position {
  itp_id: string
  shares_bought: string
  shares_sold: string
  avg_cost: string
  current_nav: string
  current_value: string
  pnl: string
  pnl_pct: string
}

export interface PortfolioSummary {
  user: string
  positions: Position[]
  total_value: string
  total_invested: string
  total_pnl: string
  total_pnl_pct: string
}

export interface PortfolioHistoryPoint {
  date: string
  value: number
  pnl: number
  pnl_pct: number
}

export interface PortfolioTrade {
  order_id: number
  itp_id: string
  side: string
  amount: string
  fill_price: string | null
  shares: string | null
  status: string
  timestamp: string
}

interface UsePortfolioReturn {
  summary: PortfolioSummary | null
  history: PortfolioHistoryPoint[]
  trades: PortfolioTrade[]
  isLoading: boolean
  error: string | null
  refetch: () => void
}

/**
 * Hook to fetch portfolio data for a user address.
 * Fetches from data-node REST endpoints only. On-chain balance reads
 * (bridged ITP on Arbitrum) are now handled via the SSE stream.
 */
export function usePortfolio(userAddress: string | undefined): UsePortfolioReturn {
  const [summary, setSummary] = useState<PortfolioSummary | null>(null)
  const [history, setHistory] = useState<PortfolioHistoryPoint[]>([])
  const [trades, setTrades] = useState<PortfolioTrade[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchAll = useCallback(async (initial = false) => {
    if (!userAddress) return

    if (initial) setIsLoading(true)
    setError(null)

    try {
      const [summaryRes, historyRes, tradesRes] = await Promise.all([
        fetch(`${DATA_NODE_URL}/portfolio?user=${userAddress}`, { signal: AbortSignal.timeout(10_000) }),
        fetch(`${DATA_NODE_URL}/portfolio/history?user=${userAddress}&days=30`, { signal: AbortSignal.timeout(10_000) }),
        fetch(`${DATA_NODE_URL}/portfolio/trades?user=${userAddress}`, { signal: AbortSignal.timeout(10_000) }),
      ])

      if (summaryRes.ok) {
        const summaryData: PortfolioSummary = await summaryRes.json()
        setSummary(summaryData)
      } else {
        setSummary(null)
      }

      if (historyRes.ok) {
        const data = await historyRes.json()
        setHistory(data.points || [])
      }
      if (tradesRes.ok) {
        const data = await tradesRes.json()
        setTrades(data.trades || [])
      }
    } catch (e: any) {
      // Only show error on initial load — on refresh failures, keep existing data
      if (initial) {
        setError(e.message || 'Failed to fetch portfolio data')
      }
    } finally {
      setIsLoading(false)
    }
  }, [userAddress])

  useEffect(() => {
    if (!userAddress) {
      setSummary(null)
      setHistory([])
      setTrades([])
      setIsLoading(false)
      return
    }

    fetchAll(true)
    const interval = setInterval(() => fetchAll(false), 30000)
    return () => clearInterval(interval)
  }, [userAddress, fetchAll])

  return { summary, history, trades, isLoading, error, refetch: fetchAll }
}
