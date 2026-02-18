'use client'

import { useReadContract } from 'wagmi'
import { MORPHO_ADDRESSES, getDefaultMarketParams } from '@/lib/contracts/morpho-addresses'
import { MORPHO_ABI } from '@/lib/contracts/morpho-abi'
import { CURATOR_RATE_IRM_ABI } from '@/lib/contracts/curator-rate-irm-abi'
import { useOraclePrice } from './useOraclePrice'
import {
  MarketInfo,
  MarketState,
  MORPHO_CONSTANTS,
  calculateUtilization,
  borrowRateToApy,
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
 * Hook to fetch available Morpho markets
 *
 * Returns market info including NAV price, LLTV, utilization, and borrow APY.
 *
 * @param market - Optional MorphoMarketEntry. Falls back to default singleton.
 */
export function useMorphoMarkets(market?: MorphoMarketEntry): UseMorphoMarketsReturn {
  const morphoAddress = market?.morpho ?? MORPHO_ADDRESSES.morpho
  const marketId = market?.marketId ?? MORPHO_ADDRESSES.marketId
  const lltv = market?.lltv ?? getDefaultMarketParams().lltv
  const oracleAddress = market?.oracle
  const marketParams = market
    ? { loanToken: market.loanToken, collateralToken: market.collateralToken, oracle: market.oracle, irm: market.irm, lltv: market.lltv }
    : getDefaultMarketParams()

  // Fetch market state
  const {
    data: marketData,
    isLoading: isMarketLoading,
    error: marketError,
    refetch: refetchMarket,
  } = useReadContract({
    address: morphoAddress,
    abi: MORPHO_ABI,
    functionName: 'market',
    args: [marketId],
    query: {
      retry: false,
      refetchInterval: 15000,
    },
  })

  // Fetch oracle price
  const {
    price: oraclePrice,
    isLoading: isOracleLoading,
    error: oracleError,
    refetch: refetchOracle,
  } = useOraclePrice(oracleAddress)

  // Fetch CuratorRateIRM rate (per-second WAD)
  const curatorIrmAddress = market?.irm ?? MORPHO_ADDRESSES.curatorRateIrm
  const {
    data: irmRate,
    refetch: refetchIrmRate,
  } = useReadContract({
    address: curatorIrmAddress,
    abi: CURATOR_RATE_IRM_ABI,
    functionName: 'rates',
    args: [marketId],
    query: {
      retry: false,
      refetchInterval: 30000,
    },
  })

  // Parse market data
  const marketState: MarketState | undefined = marketData
    ? {
        totalSupplyAssets: BigInt(marketData[0]),
        totalSupplyShares: BigInt(marketData[1]),
        totalBorrowAssets: BigInt(marketData[2]),
        totalBorrowShares: BigInt(marketData[3]),
        lastUpdate: BigInt(marketData[4]),
        fee: BigInt(marketData[5]),
      }
    : undefined

  // Calculate market info
  const markets: MarketInfo[] = []

  if (marketState && oraclePrice !== undefined) {
    const utilization = calculateUtilization(
      marketState.totalBorrowAssets,
      marketState.totalSupplyAssets
    )

    // Use CuratorRateIRM rate if available, else estimate from utilization
    let borrowApy: number
    if (irmRate) {
      // irmRate is per-second WAD. APR = rate * 31536000 / 1e18
      const ratePerSec = Number(irmRate)
      borrowApy = (ratePerSec * 31_536_000) / 1e18
    } else {
      // Fallback: estimate from utilization
      borrowApy = utilization * 0.15
    }

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
    refetchMarket()
    refetchOracle()
    refetchIrmRate()
  }

  return {
    markets,
    isLoading: isMarketLoading || isOracleLoading,
    error: (marketError || oracleError) as Error | null,
    refetch,
  }
}
