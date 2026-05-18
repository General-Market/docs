'use client'

import { useEffect, useMemo, useState } from 'react'
import { useReadContracts } from 'wagmi'
import { useSSEMorphoMarkets, type MorphoMarketSSE } from './useSSE'
import { mergeSSEMarket } from '@/lib/contracts/morpho-markets-registry'
import { MORPHO_ADDRESSES } from '@/lib/contracts/morpho-addresses'
import { METAMORPHO_VAULT_ABI } from '@/lib/contracts/morpho-abi'
import { indexL3 } from '@/lib/wagmi'

const SECONDS_PER_YEAR = 365.25 * 86400

export interface AllMarketData {
  totalSupplyAssets: bigint
  totalBorrowAssets: bigint
  totalBorrowShares: bigint
  utilization: number
  borrowApy: number
  supplyApy: number
  lltv: bigint
  marketId: string
  /**
   * Vault supply cap for this market (18-dec USDC on L3).
   * Under intent-based liquidity, the vault can route up to this many assets
   * into the market on demand — the displayed "Liquidity" should reflect
   * (cap − totalBorrow), not the literal idle balance.
   */
  cap: bigint
}

export function useAllMorphoMarkets() {
  const sseMarkets = useSSEMorphoMarkets()

  // Stable list of marketIds for the batched cap read
  const marketIds = useMemo(() => {
    const ids = sseMarkets.map(m => m.market_id as `0x${string}`)
    return Array.from(new Set(ids))
  }, [sseMarkets])

  const capCalls = useMemo(() => marketIds.map(id => ({
    address: MORPHO_ADDRESSES.metaMorphoVault,
    abi: METAMORPHO_VAULT_ABI,
    functionName: 'config' as const,
    args: [id] as const,
    chainId: indexL3.id,
  })), [marketIds])

  const { data: capResults } = useReadContracts({
    contracts: capCalls as any,
    allowFailure: true,
    query: { enabled: capCalls.length > 0, refetchInterval: 30000 },
  })

  const capByMarketId = useMemo(() => {
    const m = new Map<string, bigint>()
    if (!capResults) return m
    capResults.forEach((res, i) => {
      if (res.status !== 'success' || !res.result) return
      // config returns [cap, enabled, removableAt]
      const tuple = res.result as readonly [bigint, boolean, bigint]
      m.set(marketIds[i].toLowerCase(), tuple[0])
    })
    return m
  }, [capResults, marketIds])

  const marketsMap = useMemo(() => {
    const map = new Map<string, AllMarketData>()
    if (!sseMarkets || sseMarkets.length === 0) return map

    for (const m of sseMarkets) {
      // Auto-register SSE-discovered markets into the static registry
      mergeSSEMarket(m)
      const totalSupplyAssets = BigInt(m.total_supply_assets || '0')
      const totalBorrowAssets = BigInt(m.total_borrow_assets || '0')
      const totalBorrowShares = BigInt(m.total_borrow_shares || '0')
      const utilization = totalSupplyAssets > 0n
        ? Number((totalBorrowAssets * 10000n) / totalSupplyAssets) / 100 : 0

      let borrowApy = 0
      const ratePerSec = Number(BigInt(m.borrow_rate_per_second || '0')) / 1e18
      if (ratePerSec > 0) borrowApy = ratePerSec * SECONDS_PER_YEAR * 100

      const supplyApy = utilization > 0 ? (borrowApy * utilization) / 100 : 0
      const lltv = BigInt(m.lltv || '770000000000000000')
      const cap = capByMarketId.get(m.market_id.toLowerCase()) ?? 0n

      map.set(m.collateral_token.toLowerCase(), {
        totalSupplyAssets, totalBorrowAssets, totalBorrowShares, utilization,
        borrowApy, supplyApy, lltv, marketId: m.market_id, cap,
      })
    }
    return map
  }, [sseMarkets, capByMarketId])

  // Stop "loading" after 6 seconds even if SSE has not produced anything yet.
  // Otherwise an empty pool reads as a perpetual skeleton — the user cannot tell
  // whether data is in flight or simply zero.
  const [deadlineHit, setDeadlineHit] = useState(false)
  useEffect(() => {
    if (sseMarkets.length > 0) { setDeadlineHit(false); return }
    const t = setTimeout(() => setDeadlineHit(true), 6000)
    return () => clearTimeout(t)
  }, [sseMarkets.length])

  return { data: marketsMap, isLoading: sseMarkets.length === 0 && !deadlineHit }
}
