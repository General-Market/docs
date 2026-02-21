'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { MORPHO_ADDRESSES, getDefaultMarketParams } from '@/lib/contracts/morpho-addresses'
import { useSSEOracle } from './useSSE'
import { fetchMorphoPosition } from '@/lib/api/backend'
import {
  MarketInfo,
  MORPHO_CONSTANTS,
  calculateUtilization,
} from '@/lib/types/morpho'
import type { MorphoMarketEntry } from '@/lib/contracts/morpho-markets-registry'

interface UseMorphoMarketsReturn {
  /** List of available markets */
  markets: MarketInfo[]
  /** Whether data is loading */
  isLoading: boolean
  /** Error if any */
  error: Error | null
  /** Refetch function */
  refetch: () => void
}

/**
 * Hook to fetch available Morpho markets.
 *
 * Oracle price: from SSE oracle-prices stream (instant push).
 * Market state (totalSupplyAssets, totalBorrowAssets): from REST /morpho-position
 * endpoint which returns market-level data alongside per-user data.
 *
 * TODO: When market-level SSE topic is added, switch market state to SSE.
 *
 * @param market - Optional MorphoMarketEntry. Falls back to default singleton.
 */
export function useMorphoMarkets(market?: MorphoMarketEntry): UseMorphoMarketsReturn {
  const marketId = market?.marketId ?? MORPHO_ADDRESSES.marketId
  const lltv = market?.lltv ?? getDefaultMarketParams().lltv
  const marketParams = market
    ? { loanToken: market.loanToken, collateralToken: market.collateralToken, oracle: market.oracle, irm: market.irm, lltv: market.lltv }
    : getDefaultMarketParams()

  // Oracle price from SSE (instant)
  const sseOracle = useSSEOracle()
  const oraclePrice = sseOracle ? BigInt(sseOracle.price) : undefined

  // Market state from REST /morpho-position (uses a zero-address query to get market data)
  const [marketState, setMarketState] = useState<{
    totalSupplyAssets: bigint
    totalBorrowAssets: bigint
  } | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)

  const fetchMarketData = useCallback(async () => {
    try {
      // Fetch with zero address — the endpoint returns market state regardless
      const result = await fetchMorphoPosition('0x0000000000000000000000000000000000000000')
      if (result?.market) {
        setMarketState({
          totalSupplyAssets: BigInt(result.market.total_supply_assets),
          totalBorrowAssets: BigInt(result.market.total_borrow_assets),
        })
        setError(null)
      }
    } catch (e: any) {
      if (!marketState) setError(new Error(e.message || 'Failed to fetch market data'))
    } finally {
      setIsLoading(false)
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    fetchMarketData()
  }, [fetchMarketData])

  // Poll market data every 30s (market state changes slowly)
  useEffect(() => {
    const interval = setInterval(fetchMarketData, 30_000)
    return () => clearInterval(interval)
  }, [fetchMarketData])

  // Calculate market info
  const markets: MarketInfo[] = []

  if (marketState && oraclePrice !== undefined) {
    const utilization = calculateUtilization(
      marketState.totalBorrowAssets,
      marketState.totalSupplyAssets
    )

    // Compute APY from CuratorRateIRM rate (1-ray = 1e27 per second)
    const borrowApy = sseOracle?.borrow_rate_ray && sseOracle.borrow_rate_ray !== '0'
      ? (() => {
          const ratePerSec = Number(BigInt(sseOracle.borrow_rate_ray)) / 1e27
          // APY = (1 + ratePerSec)^(365.25*86400) - 1, approximated for small rates
          return ratePerSec * 365.25 * 86400
        })()
      : utilization * 0.15 // fallback if rate not available

    markets.push({
      params: marketParams,
      marketId,
      navPrice: oraclePrice,
      lltvPercent: Number(lltv) / 1e16,
      utilization,
      borrowApy,
      totalBorrowed: marketState.totalBorrowAssets,
      totalCollateral: 0n,
    })
  }

  const refetch = () => {
    fetchMarketData()
  }

  return {
    markets,
    isLoading: isLoading && !sseOracle,
    error,
    refetch,
  }
}
