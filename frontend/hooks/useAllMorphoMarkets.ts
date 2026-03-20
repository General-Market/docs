'use client'

import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'

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

interface MarketResponse {
  market_id: string
  collateral_token: string
  total_supply_assets: string
  total_borrow_assets: string
  borrow_rate_per_second: string
  lltv: string
  last_update: number
}

export function useAllMorphoMarkets() {
  const { data: rawMarkets, isLoading } = useQuery<MarketResponse[]>({
    queryKey: ['morpho-markets'],
    queryFn: async () => {
      const res = await fetch('/api/dn/morpho-markets')
      if (!res.ok) return []
      const data = await res.json()
      return data.markets ?? []
    },
    refetchInterval: 30_000,
    staleTime: 15_000,
  })

  const marketsMap = useMemo(() => {
    const map = new Map<string, AllMarketData>()
    if (!rawMarkets) return map

    for (const m of rawMarkets) {
      const totalSupplyAssets = BigInt(m.total_supply_assets || '0')
      const totalBorrowAssets = BigInt(m.total_borrow_assets || '0')
      const utilization = totalSupplyAssets > 0n
        ? Number((totalBorrowAssets * 10000n) / totalSupplyAssets) / 100 : 0

      let borrowApy = 0
      const ratePerSec = Number(BigInt(m.borrow_rate_per_second || '0')) / 1e18
      if (ratePerSec > 0) borrowApy = ratePerSec * SECONDS_PER_YEAR * 100
      if (borrowApy === 0 && utilization > 0) borrowApy = 2 + utilization * 0.15

      const supplyApy = utilization > 0 ? (borrowApy * utilization) / 100 : 0
      const lltv = BigInt(m.lltv || '770000000000000000')

      map.set(m.collateral_token.toLowerCase(), {
        totalSupplyAssets, totalBorrowAssets, utilization,
        borrowApy, supplyApy, lltv, marketId: m.market_id,
      })
    }
    return map
  }, [rawMarkets])

  return { data: marketsMap, isLoading }
}
