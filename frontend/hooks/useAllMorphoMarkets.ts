'use client'

import { useMemo } from 'react'
import { useSSEMorphoMarkets, type MorphoMarketSSE } from './useSSE'

const SECONDS_PER_YEAR = 365.25 * 86400

export interface AllMarketData {
  totalSupplyAssets: bigint
  totalBorrowAssets: bigint
  utilization: number
  borrowApy: number
  supplyApy: number
  lltv: bigint
  marketId: string
}

export function useAllMorphoMarkets() {
  const sseMarkets = useSSEMorphoMarkets()

  const marketsMap = useMemo(() => {
    const map = new Map<string, AllMarketData>()
    if (!sseMarkets || sseMarkets.length === 0) return map

    for (const m of sseMarkets) {
      const totalSupplyAssets = BigInt(m.total_supply_assets || '0')
      const totalBorrowAssets = BigInt(m.total_borrow_assets || '0')
      const utilization = totalSupplyAssets > 0n
        ? Number((totalBorrowAssets * 10000n) / totalSupplyAssets) / 100 : 0

      let borrowApy = 0
      const ratePerSec = Number(BigInt(m.borrow_rate_per_second || '0')) / 1e18
      if (ratePerSec > 0) borrowApy = ratePerSec * SECONDS_PER_YEAR * 100

      const supplyApy = utilization > 0 ? (borrowApy * utilization) / 100 : 0
      const lltv = BigInt(m.lltv || '770000000000000000')

      map.set(m.collateral_token.toLowerCase(), {
        totalSupplyAssets, totalBorrowAssets, utilization,
        borrowApy, supplyApy, lltv, marketId: m.market_id,
      })
    }
    return map
  }, [sseMarkets])

  return { data: marketsMap, isLoading: sseMarkets.length === 0 }
}
