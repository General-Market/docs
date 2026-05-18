'use client'

import { useMemo } from 'react'
import { formatUnits } from 'viem'
import { useSSENav, useSSEBalances, useSSEPositions } from './useSSE'
import { useAllMorphoMarkets } from './useAllMorphoMarkets'
import { getMorphoMarketForItp, type MorphoMarketEntry } from '@/lib/contracts/morpho-markets-registry'
import { calculateHealthFactor } from '@/lib/types/morpho'

// ── Types ──

export interface EnrichedMarket {
  collateralToken: string
  name: string
  symbol: string
  itpId: string
  settlementAddress: string
  borrowApy: number
  /**
   * Available liquidity under intent-based reallocation: `cap - totalBorrow`.
   * The vault routes idle USDC to whichever market is borrowed against, so the
   * meaningful ceiling is the per-market supply cap, not the current idle
   * balance. Falls back to `totalSupply - totalBorrow` when the cap is zero
   * (market not yet capped on the vault).
   */
  available: number
  /** Loan-to-value ratio as percentage (e.g. 77 for 77%) */
  lltv: number
  navPerShare: number
  hasPosition: boolean
  collateralAmount: string
  debtAmount: string
  borrowShares: string
  healthFactor: number
  /** User's ITP token balance in wei (from SSE balances, matched by itpId) */
  userBalanceWei: string
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

  // Build a lookup from collateral address → nav snapshot
  // Morpho collateral is the settlement BridgedITP address (primary) OR the L3 vault address (fallback)
  const navByCollateral = useMemo(() => {
    const map = new Map<string, typeof navSnapshots[number]>()
    for (const n of navSnapshots) {
      if (n.settlement_address) {
        map.set(n.settlement_address.toLowerCase(), n)
      }
      if (n.vault_address) {
        map.set(n.vault_address.toLowerCase(), n)
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
      const nav = navByCollateral.get(collateralToken.toLowerCase())
      if (!nav) continue

      // Skip ITPs with zero NAV — no price feed resolved, broken or empty
      if (nav.nav_per_share <= 0) continue

      const market = getMorphoMarketForItp(collateralToken)
      if (!market) continue

      // Intent-based liquidity: cap - totalBorrow.
      // The vault reallocates to the target market on demand, so the meaningful
      // headroom is the per-market cap. When cap is zero (uncapped or not
      // registered) we fall back to the literal idle balance.
      const ceiling = mktData.cap > 0n ? mktData.cap : mktData.totalSupplyAssets
      const availableRaw = ceiling > mktData.totalBorrowAssets
        ? ceiling - mktData.totalBorrowAssets
        : 0n
      const available = parseFloat(formatUnits(availableRaw, 18))
      const lltv = Number(mktData.lltv) / 1e16

      const pos = positions?.[mktData.marketId]
      const collateralAmount = pos?.collateral || '0'
      const borrowShares = pos?.borrow_shares || '0'
      const hasPosition = BigInt(collateralAmount) > 0n || BigInt(borrowShares) > 0n

      // Compute debt from borrow shares: debt = borrowShares * totalBorrowAssets / totalBorrowShares
      const borrowSharesBn = BigInt(borrowShares)
      const debtAmount = (mktData.totalBorrowShares > 0n && borrowSharesBn > 0n)
        ? (borrowSharesBn * mktData.totalBorrowAssets) / mktData.totalBorrowShares
        : 0n

      // Compute health factor using NAV-based oracle price (36-decimal Morpho format)
      const oraclePrice = BigInt(Math.floor(nav.nav_per_share * 1e18)) * BigInt(1e18)
      const healthFactor = calculateHealthFactor(
        BigInt(collateralAmount), oraclePrice, debtAmount, mktData.lltv
      )

      // Look up user's ITP balance by itpId
      const userBal = balances?.itp_shares?.[nav.itp_id] || '0'

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
        debtAmount: debtAmount.toString(),
        borrowShares,
        healthFactor,
        userBalanceWei: userBal,
        market,
      })
    }

    // Sort: user balance first (highest balance → top), then position holders, then by available
    result.sort((a, b) => {
      const balA = BigInt(a.userBalanceWei)
      const balB = BigInt(b.userBalanceWei)
      if (balA !== balB) return balB > balA ? 1 : balB < balA ? -1 : 0
      if (a.hasPosition !== b.hasPosition) return a.hasPosition ? -1 : 1
      return b.available - a.available
    })

    return result
  }, [marketsMap, navSnapshots, navByCollateral, balances, positions])

  const eligibleCollateral = useMemo<EligibleCollateral[]>(() => {
    if (!balances?.itp_shares || navSnapshots.length === 0) return []

    const items: EligibleCollateral[] = []

    for (const [itpId, balStr] of Object.entries(balances.itp_shares)) {
      const bal = BigInt(balStr || '0')
      if (bal === 0n) continue

      const nav = navById.get(itpId.toLowerCase())
      if (!nav?.settlement_address || nav.nav_per_share <= 0) continue

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
