'use client'

import { useQuery } from '@tanstack/react-query'
import { getBackendUrl } from '@/lib/contracts/addresses'

/**
 * Trade record for a bet
 * Used to display individual trade outcomes in resolution view
 */
export interface BetTrade {
  tradeId: string
  ticker: string
  source: string           // 'coingecko' | 'polymarket' | 'gamma'
  method: string           // 'price' | 'outcome'
  position: 'LONG' | 'SHORT' | 'YES' | 'NO'
  entryPrice: string
  exitPrice?: string
  won?: boolean
  cancelled?: boolean
}

/**
 * Response from GET /api/bets/:betId/trades
 */
interface BetTradesResponse {
  trades: BetTrade[]
  winsCount?: number
  validTrades?: number
}

/**
 * Fetches trades for a specific bet
 */
async function fetchBetTrades(betId: string): Promise<BetTrade[]> {
  const backendUrl = getBackendUrl()
  const response = await fetch(`${backendUrl}/api/bets/${betId}/trades`)

  if (!response.ok) {
    if (response.status === 404) {
      return [] // No trades found
    }
    throw new Error(`Failed to fetch bet trades: ${response.statusText}`)
  }

  const data: BetTradesResponse = await response.json()
  return data.trades || []
}

interface UseBetTradesOptions {
  betId: number | string | undefined
  enabled?: boolean
}

interface UseBetTradesReturn {
  trades: BetTrade[]
  isLoading: boolean
  isError: boolean
  error: Error | null
  refetch: () => void
}

/**
 * Hook for fetching trades associated with a bet
 * @param options - Configuration including betId
 * @returns Trades array, loading state, and error state
 */
export function useBetTrades({ betId, enabled = true }: UseBetTradesOptions): UseBetTradesReturn {
  const betIdStr = betId?.toString()

  const {
    data,
    isLoading,
    isError,
    error,
    refetch
  } = useQuery({
    queryKey: ['bet-trades', betIdStr],
    queryFn: () => fetchBetTrades(betIdStr!),
    enabled: enabled && !!betIdStr,
    staleTime: 30000, // Cache for 30 seconds
  })

  return {
    trades: data ?? [],
    isLoading,
    isError,
    error: error as Error | null,
    refetch
  }
}

/**
 * Format position for display
 * @param position - LONG/SHORT/YES/NO
 * @param source - Data source (coingecko uses LONG/SHORT, others use YES/NO)
 * @returns Display string
 */
export function formatTradePosition(position: BetTrade['position'], source: string): string {
  if (source === 'coingecko') {
    return position === 'LONG' ? '📈 LONG' : '📉 SHORT'
  }
  return position === 'YES' ? '✓ YES' : '✗ NO'
}

/**
 * Format price for display based on source
 * @param price - Price string
 * @param source - Data source
 * @returns Formatted price
 */
export function formatTradePrice(price: string | undefined, source: string): string {
  if (!price) return '--'
  const numPrice = parseFloat(price)
  if (source === 'coingecko') {
    // Crypto prices
    if (numPrice >= 1000) {
      return `$${numPrice.toLocaleString(undefined, { maximumFractionDigits: 0 })}`
    }
    return `$${numPrice.toFixed(2)}`
  }
  // Prediction market prices (0-1 probability)
  return `${(numPrice * 100).toFixed(1)}%`
}
