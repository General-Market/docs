'use client'

import { useMemo } from 'react'
import { useSSEPositions, useSSEMorphoMarkets, useSSENav } from '@/hooks/useSSE'
import { getMorphoMarketForItp, type MorphoMarketEntry } from '@/lib/contracts/morpho-markets-registry'
import { calculateHealthFactor } from '@/lib/types/morpho'

export interface UserMarketPosition {
  market: MorphoMarketEntry
  marketId: string
  itpName: string
  itpSymbol: string
  collateralToken: string
  collateralAmount: bigint
  debtAmount: bigint
  healthFactor: number
  nav: number
}

export function useAllUserPositions(): {
  positions: UserMarketPosition[]
  isLoading: boolean
} {
  const positions = useSSEPositions()
  const morphoMarkets = useSSEMorphoMarkets()
  const navSnapshots = useSSENav()

  const result = useMemo(() => {
    if (!positions || morphoMarkets.length === 0 || navSnapshots.length === 0) {
      return { positions: [], isLoading: !positions }
    }

    const marketById = new Map(morphoMarkets.map(m => [m.market_id.toLowerCase(), m]))
    const navBySettlement = new Map(
      navSnapshots
        .filter(n => n.settlement_address)
        .map(n => [n.settlement_address!.toLowerCase(), n])
    )

    const active: UserMarketPosition[] = []

    for (const [marketId, snapshot] of Object.entries(positions)) {
      const collateralAmount = BigInt(snapshot.collateral || '0')
      const borrowShares = BigInt(snapshot.borrow_shares || '0')

      if (collateralAmount === 0n && borrowShares === 0n) continue

      const sseMarket = marketById.get(marketId.toLowerCase())
      if (!sseMarket) continue

      // Compute debt from borrow shares
      const totalBorrowAssets = BigInt(sseMarket.total_borrow_assets || '0')
      const totalBorrowShares = BigInt(sseMarket.total_borrow_shares || '0')
      const debtAmount = totalBorrowShares > 0n
        ? (borrowShares * totalBorrowAssets) / totalBorrowShares
        : 0n

      // Find ITP name/symbol via settlement_address -> collateral_token match
      const navSnap = navBySettlement.get(sseMarket.collateral_token.toLowerCase())
      if (!navSnap) continue

      const nav = navSnap.nav_per_share
      // Convert NAV to 36-decimal Morpho oracle price
      const oraclePrice = BigInt(Math.floor(nav * 1e18)) * BigInt(1e18)

      const lltv = BigInt(sseMarket.lltv || '0')
      const healthFactor = calculateHealthFactor(collateralAmount, oraclePrice, debtAmount, lltv)

      const marketEntry = getMorphoMarketForItp(sseMarket.collateral_token)
      if (!marketEntry) continue

      active.push({
        market: marketEntry,
        marketId,
        itpName: navSnap.name,
        itpSymbol: navSnap.symbol,
        collateralToken: sseMarket.collateral_token,
        collateralAmount,
        debtAmount,
        healthFactor,
        nav,
      })
    }

    return { positions: active, isLoading: false }
  }, [positions, morphoMarkets, navSnapshots])

  return result
}
