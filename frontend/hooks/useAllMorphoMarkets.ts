'use client'

import { useMemo } from 'react'
import { useReadContracts } from 'wagmi'
import { getAllMorphoMarkets } from '@/lib/contracts/morpho-markets-registry'
import { MORPHO_ABI } from '@/lib/contracts/morpho-abi'
import { CURATOR_RATE_IRM_ABI } from '@/lib/contracts/curator-rate-irm-abi'
import { MORPHO_ADDRESSES } from '@/lib/contracts/morpho-addresses'
import { indexL3 } from '@/lib/wagmi'

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

const allMarkets = getAllMorphoMarkets()

export function useAllMorphoMarkets() {
  const contracts = useMemo(() => {
    const calls: {
      address: `0x${string}`
      abi: typeof MORPHO_ABI | typeof CURATOR_RATE_IRM_ABI
      functionName: string
      args: readonly [`0x${string}`]
      chainId: number
    }[] = []

    for (const m of allMarkets) {
      // Morpho.market(marketId)
      calls.push({
        address: MORPHO_ADDRESSES.morpho,
        abi: MORPHO_ABI,
        functionName: 'market',
        args: [m.marketId],
        chainId: indexL3.id,
      })
      // CuratorRateIRM.rates(marketId)
      calls.push({
        address: MORPHO_ADDRESSES.curatorRateIrm,
        abi: CURATOR_RATE_IRM_ABI,
        functionName: 'rates',
        args: [m.marketId],
        chainId: indexL3.id,
      })
    }

    return calls
  }, [])

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: rawData, isLoading } = useReadContracts({
    contracts: contracts as any,
    query: {
      enabled: allMarkets.length > 0,
      refetchInterval: 30_000,
    },
  })

  const marketsMap = useMemo(() => {
    const map = new Map<string, AllMarketData>()
    const data = rawData as { status: string; result?: unknown }[] | undefined
    if (!data) return map

    for (let i = 0; i < allMarkets.length; i++) {
      const marketRes = data[i * 2]
      const rateRes = data[i * 2 + 1]
      const entry = allMarkets[i]

      if (!marketRes || marketRes.status !== 'success' || !marketRes.result) continue

      const marketResult = marketRes.result as [bigint, bigint, bigint, bigint, bigint, bigint]
      const totalSupplyAssets = marketResult[0]
      const totalBorrowAssets = marketResult[2]

      const utilization = totalSupplyAssets > 0n
        ? Number((totalBorrowAssets * 10000n) / totalSupplyAssets) / 100
        : 0

      let borrowApy = 0
      if (rateRes && rateRes.status === 'success' && rateRes.result) {
        const ratePerSec = Number(rateRes.result as bigint) / 1e18
        borrowApy = ratePerSec * SECONDS_PER_YEAR * 100
      }

      const supplyApy = utilization > 0 ? (borrowApy * utilization) / 100 : 0

      map.set(entry.collateralToken.toLowerCase(), {
        totalSupplyAssets,
        totalBorrowAssets,
        utilization,
        borrowApy,
        supplyApy,
        lltv: entry.lltv,
        marketId: entry.marketId,
      })
    }

    return map
  }, [rawData])

  return { data: marketsMap, isLoading }
}
