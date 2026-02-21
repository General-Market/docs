'use client'

import { useSSEOracle } from './useSSE'
import { OracleInfo, MORPHO_CONSTANTS, formatOraclePrice } from '@/lib/types/morpho'

interface UseOraclePriceReturn {
  /** Current oracle price (36 decimals) */
  price: bigint | undefined
  /** Price formatted for display (USD) */
  priceFormatted: number | undefined
  /** Last update timestamp */
  lastUpdated: bigint | undefined
  /** Last cycle number */
  lastCycleNumber: bigint | undefined
  /** Whether the price is stale (> 24 hours) */
  isStale: boolean
  /** Whether data is loading */
  isLoading: boolean
  /** Error if any */
  error: Error | null
  /** Full oracle info */
  oracleInfo: OracleInfo | undefined
  /** Refetch function (no-op — SSE pushes updates) */
  refetch: () => void
}

/**
 * Hook to fetch NAV price from SSE oracle-prices stream.
 *
 * Returns the current BLS-verified NAV price for ITP tokens.
 * Price is in 36 decimals (Morpho oracle standard).
 *
 * @param _oracle - Ignored. Kept for call-site compatibility.
 */
export function useOraclePrice(_oracle?: `0x${string}`): UseOraclePriceReturn {
  const oracle = useSSEOracle()

  const price = oracle ? BigInt(oracle.price) : undefined
  const lastUpdated = oracle ? BigInt(oracle.last_updated) : undefined
  const lastCycleNumber = oracle ? BigInt(oracle.last_cycle) : undefined

  // Calculate if price is stale (> 24 hours)
  const now = BigInt(Math.floor(Date.now() / 1000))
  const isStale = lastUpdated !== undefined
    ? now - lastUpdated > MORPHO_CONSTANTS.MAX_STALENESS
    : false

  // Format price for display
  const priceFormatted = price !== undefined ? formatOraclePrice(price) : undefined

  // Build oracle info
  const oracleInfo: OracleInfo | undefined =
    price !== undefined && lastUpdated !== undefined && lastCycleNumber !== undefined
      ? { price, lastUpdated, lastCycleNumber, isStale }
      : undefined

  return {
    price,
    priceFormatted,
    lastUpdated,
    lastCycleNumber,
    isStale,
    isLoading: !oracle,
    error: null,
    oracleInfo,
    refetch: () => {},
  }
}
