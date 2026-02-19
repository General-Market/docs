'use client'

import { useReadContract } from 'wagmi'
import { MORPHO_ADDRESSES } from '@/lib/contracts/morpho-addresses'
import { ITP_NAV_ORACLE_ABI } from '@/lib/contracts/morpho-abi'
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
  /** Refetch function */
  refetch: () => void
}

/**
 * Hook to fetch NAV price from ITPNAVOracle
 *
 * Returns the current BLS-verified NAV price for ITP tokens.
 * Price is in 36 decimals (Morpho oracle standard).
 *
 * @param oracle - Optional oracle address. Falls back to MORPHO_ADDRESSES.itpOracle.
 */
export function useOraclePrice(oracle?: `0x${string}`): UseOraclePriceReturn {
  const oracleAddress = oracle ?? MORPHO_ADDRESSES.itpOracle

  // Fetch current price
  const {
    data: price,
    isLoading: isPriceLoading,
    error: priceError,
    refetch: refetchPrice,
  } = useReadContract({
    address: oracleAddress,
    abi: ITP_NAV_ORACLE_ABI,
    functionName: 'currentPrice',
    query: {
      retry: false,
      refetchInterval: 15000,
    },
  })

  // Fetch last updated timestamp
  const {
    data: lastUpdated,
    isLoading: isLastUpdatedLoading,
    refetch: refetchLastUpdated,
  } = useReadContract({
    address: oracleAddress,
    abi: ITP_NAV_ORACLE_ABI,
    functionName: 'lastUpdated',
    query: {
      retry: false,
      refetchInterval: 15000,
    },
  })

  // Fetch last cycle number
  const {
    data: lastCycleNumber,
    isLoading: isCycleLoading,
    refetch: refetchCycle,
  } = useReadContract({
    address: oracleAddress,
    abi: ITP_NAV_ORACLE_ABI,
    functionName: 'lastCycleNumber',
    query: {
      retry: false,
      refetchInterval: 15000,
    },
  })

  // Calculate if price is stale (> 24 hours)
  const now = BigInt(Math.floor(Date.now() / 1000))
  const isStale = lastUpdated !== undefined
    ? now - lastUpdated > MORPHO_CONSTANTS.MAX_STALENESS
    : false

  // Format price for display
  const priceFormatted = price !== undefined ? formatOraclePrice(price) : undefined

  // Build oracle info
  const oracleInfo: OracleInfo | undefined = price !== undefined && lastUpdated !== undefined && lastCycleNumber !== undefined
    ? {
        price,
        lastUpdated,
        lastCycleNumber,
        isStale,
      }
    : undefined

  const refetch = () => {
    refetchPrice()
    refetchLastUpdated()
    refetchCycle()
  }

  return {
    price,
    priceFormatted,
    lastUpdated,
    lastCycleNumber,
    isStale,
    isLoading: isPriceLoading || isLastUpdatedLoading || isCycleLoading,
    error: priceError as Error | null,
    oracleInfo,
    refetch,
  }
}
