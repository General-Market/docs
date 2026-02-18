'use client'

import { useQuery } from '@tanstack/react-query'
import { getBackendUrl } from '@/lib/contracts/addresses'

/**
 * Single data point for performance graph
 * Represents one settled portfolio bet
 */
export interface PerformanceDataPoint {
  timestamp: string         // ISO timestamp
  cumulativePnL: number    // Running total P&L at this point
  betId: string            // Bet identifier
  betNumber: number        // Sequential bet number for this agent
  portfolioSize: number    // Markets in this bet
  amount: number           // USDC wagered
  result: number           // P&L from this bet
  resultPercent: number    // % return on this bet
}

/**
 * Summary statistics for the performance data
 */
export interface PerformanceSummary {
  totalPnL: number
  startingPnL: number
  endingPnL: number
  totalBets: number
}

/**
 * API response interface matching backend endpoint
 */
export interface PerformanceResponse {
  walletAddress: string
  range: '7d' | '30d' | '90d' | 'all'
  dataPoints: PerformanceDataPoint[]
  summary: PerformanceSummary
}

/**
 * Hook return type
 */
interface UseAgentPerformanceReturn {
  data: PerformanceResponse | null
  isLoading: boolean
  isError: boolean
  error: Error | null
  refetch: () => void
}

/**
 * Raw backend response with lowercase field names
 */
interface BackendDataPoint {
  timestamp: string
  cumulativePnl: number  // Backend uses lowercase 'l'
  betId: string
  betNumber: number
  portfolioSize: number
  amount: string
  result: string
  resultPercent: string
}

interface BackendSummary {
  totalPnl: string
  startingPnl: string
  endingPnl: string
  totalBets: number
}

interface BackendPerformanceResponse {
  walletAddress: string
  range: string
  dataPoints: BackendDataPoint[]
  summary: BackendSummary
}

/**
 * Fetches agent performance data from backend API
 * Throws error if backend is unavailable - NO MOCK FALLBACKS IN PRODUCTION
 */
async function fetchAgentPerformance(
  walletAddress: string,
  range: '7d' | '30d' | '90d' | 'all'
): Promise<PerformanceResponse> {
  const backendUrl = getBackendUrl() // Throws if not configured

  const response = await fetch(
    `${backendUrl}/api/agents/${walletAddress}/performance?range=${range}`
  )

  if (!response.ok) {
    throw new Error(`Failed to fetch performance data: ${response.status} ${response.statusText}`)
  }

  const data: BackendPerformanceResponse = await response.json()

  // Transform backend response to match frontend interface
  // Backend uses cumulativePnl, frontend expects cumulativePnL
  // Guard against undefined/null dataPoints array
  const dataPointsArray = data.dataPoints ?? []
  return {
    walletAddress: data.walletAddress,
    range: data.range as '7d' | '30d' | '90d' | 'all',
    dataPoints: dataPointsArray.map((dp) => ({
      timestamp: dp.timestamp,
      cumulativePnL: parseFloat(String(dp.cumulativePnl)) || 0,
      betId: dp.betId,
      betNumber: dp.betNumber,
      portfolioSize: dp.portfolioSize,
      amount: parseFloat(dp.amount) || 0,
      result: parseFloat(dp.result) || 0,
      resultPercent: parseFloat(dp.resultPercent) || 0,
    })),
    summary: {
      totalPnL: parseFloat(data.summary.totalPnl) || 0,
      startingPnL: parseFloat(data.summary.startingPnl) || 0,
      endingPnL: parseFloat(data.summary.endingPnl) || 0,
      totalBets: data.summary.totalBets,
    },
  }
}

/**
 * Hook for fetching agent performance data
 * Uses TanStack Query with automatic refetch
 *
 * @param walletAddress - The agent's wallet address
 * @param range - Time range: '7d', '30d', '90d', or 'all'
 * @returns Performance data, loading state, and error state
 */
export function useAgentPerformance(
  walletAddress: string,
  range: '7d' | '30d' | '90d' | 'all' = '30d'
): UseAgentPerformanceReturn {
  const {
    data,
    isLoading,
    isError,
    error,
    refetch
  } = useQuery({
    queryKey: ['agent-performance', walletAddress, range],
    queryFn: () => fetchAgentPerformance(walletAddress, range),
    enabled: !!walletAddress,
    refetchInterval: 60000, // Refetch every minute
    staleTime: 30000 // Consider data stale after 30 seconds
  })

  return {
    data: data ?? null,
    isLoading,
    isError,
    error: error as Error | null,
    refetch
  }
}
