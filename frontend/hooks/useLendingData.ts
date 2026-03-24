'use client'

import { useMemo } from 'react'
import { formatUnits } from 'viem'
import { useSSENav, useSSEBalances, useSSEPositions } from './useSSE'
import { useAllMorphoMarkets } from './useAllMorphoMarkets'
import { getMorphoMarketForItp, type MorphoMarketEntry } from '@/lib/contracts/morpho-markets-registry'

// ── Types ──

export interface EnrichedMarket {
  collateralToken: string
  name: string
  symbol: string
  itpId: string
  settlementAddress: string
  borrowApy: number
  /** Available liquidity = totalSupply - totalBorrow (float, 18-dec formatted) */
  available: number
  /** Loan-to-value ratio as percentage (e.g. 77 for 77%) */
  lltv: number
  navPerShare: number
  hasPosition: boolean
  collateralAmount: string
  debtAmount: string
  borrowShares: string
  healthFactor: number
  market: MorphoMarketEntry
}

export interface EligibleCollateral {
  itpId: string
  name: string
  symbol: string
  settlementAddress: string
  /** Raw ITP share balance in wei */
  balance: bigint
  navPerShare: number
  market: MorphoMarketEntry
}

export interface AggregateStats {
  vaultTvl: number
  supplyApy: number
  borrowApy: number
  utilization: number
}

export interface LendingData {
  enrichedMarkets: EnrichedMarket[]
  eligibleCollateral: EligibleCollateral[]
  aggregateStats: AggregateStats
  isLoading: boolean
}

// ── Hook ──

export function useLendingData(): LendingData {
  const navSnapshots = useSSENav()
  const balances = useSSEBalances()
  const positions = useSSEPositions()
  const { data: marketsMap, isLoading: marketsLoading } = useAllMorphoMarkets()

  // Build a lookup from settlement_address → nav snapshot (once)
  const navBySettlement = useMemo(() => {
    const map = new Map<string, typeof navSnapshots[number]>()
    for (const n of navSnapshots) {
      if (n.settlement_address) {
        map.set(n.settlement_address.toLowerCase(), n)
      }
    }
    return map
  }, [navSnapshots])

  // Build a lookup from itp_id → nav snapshot
  const navById = useMemo(() => {
    const map = new Map<string, typeof navSnapshots[number]>()
    for (const n of navSnapshots) {
      map.set(n.itp_id.toLowerCase(), n)
    }
    return map
  }, [navSnapshots])

  const enrichedMarkets = useMemo<EnrichedMarket[]>(() => {
    if (marketsMap.size === 0 || navSnapshots.length === 0) return []

    const result: EnrichedMarket[] = []

    for (const [collateralToken, mktData] of marketsMap) {
      const nav = navBySettlement.get(collateralToken.toLowerCase())
      if (!nav) continue

      const market = getMorphoMarketForItp(collateralToken)
      if (!market) continue

      const available = parseFloat(
        formatUnits(mktData.totalSupplyAssets - mktData.totalBorrowAssets, 18)
      )
      const lltv = Number(mktData.lltv) / 1e16

      const pos = positions?.[mktData.marketId]
      const collateralAmount = pos?.collateral || '0'
      const borrowShares = pos?.borrow_shares || '0'
      // debt_amount not available from SSE positions — store raw borrow_shares,
      // consumers needing debt use useMorphoPosition for the selected market
      const hasPosition = BigInt(collateralAmount) > 0n || BigInt(borrowShares) > 0n

      result.push({
        collateralToken,
        name: nav.name,
        symbol: nav.symbol,
        itpId: nav.itp_id,
        settlementAddress: nav.settlement_address!,
        borrowApy: mktData.borrowApy,
        available,
        lltv,
        navPerShare: nav.nav_per_share,
        hasPosition,
        collateralAmount,
        debtAmount: '0', // requires market-level computation — see useMorphoPosition
        borrowShares,
        healthFactor: Infinity, // requires oracle price — see useMorphoPosition
        market,
      })
    }

    // Position holders first, then by available liquidity descending
    result.sort((a, b) => {
      if (a.hasPosition !== b.hasPosition) return a.hasPosition ? -1 : 1
      return b.available - a.available
    })

    return result
  }, [marketsMap, navSnapshots, navBySettlement, positions])

  const eligibleCollateral = useMemo<EligibleCollateral[]>(() => {
    if (!balances?.itp_shares || navSnapshots.length === 0) return []

    const items: EligibleCollateral[] = []

    for (const [itpId, balStr] of Object.entries(balances.itp_shares)) {
      const bal = BigInt(balStr || '0')
      if (bal === 0n) continue

      const nav = navById.get(itpId.toLowerCase())
      if (!nav?.settlement_address) continue

      const market = getMorphoMarketForItp(nav.settlement_address)
      if (!market) continue

      items.push({
        itpId: nav.itp_id,
        name: nav.name,
        symbol: nav.symbol,
        settlementAddress: nav.settlement_address,
        balance: bal,
        navPerShare: nav.nav_per_share,
        market,
      })
    }

    items.sort((a, b) => (b.balance > a.balance ? 1 : b.balance < a.balance ? -1 : 0))
    return items
  }, [navSnapshots, navById, balances])

  // Placeholder — LendingStatsBanner will compute from vault data separately
  const aggregateStats: AggregateStats = useMemo(() => ({
    vaultTvl: 0,
    supplyApy: 0,
    borrowApy: 0,
    utilization: 0,
  }), [])

  const isLoading = marketsLoading || navSnapshots.length === 0

  return { enrichedMarkets, eligibleCollateral, aggregateStats, isLoading }
}
