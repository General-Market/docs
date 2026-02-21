'use client'

import { useSSENav } from './useSSE'

interface ItpNavResult {
  /** NAV per share in USD (float) */
  navPerShare: number
  /** NAV per share as bigint (18 decimals) */
  navPerShareBn: bigint
  /** Total supply of ITP shares */
  totalSupply: bigint
  /** Total number of assets */
  totalAssetCount: number
  /** Number of assets with prices from AP */
  pricedAssetCount: number
  isLoading: boolean
  error: string | null
  refresh: () => Promise<void>
}

/**
 * Gets ITP NAV from the SSE itp-nav stream.
 *
 * The backend computes NAV = Σ(inventory[i] * latestPrice[i]) / 1e18
 * and pushes it via SSE.
 */
export function useItpNav(itpId: string | undefined): ItpNavResult {
  const navList = useSSENav()

  if (!itpId || navList.length === 0) {
    return {
      navPerShare: 0,
      navPerShareBn: 0n,
      totalSupply: 0n,
      totalAssetCount: 0,
      pricedAssetCount: 0,
      isLoading: navList.length === 0,
      error: null,
      refresh: async () => {},
    }
  }

  const match = navList.find(n => n.itp_id === itpId)

  if (!match) {
    return {
      navPerShare: 0,
      navPerShareBn: 0n,
      totalSupply: 0n,
      totalAssetCount: 0,
      pricedAssetCount: 0,
      isLoading: false,
      error: 'ITP not found',
      refresh: async () => {},
    }
  }

  // Derive bigint NAV (18 decimals) from the float value.
  // Precision is sufficient for limit-price seeding (consumers add 5% buffer).
  const navPerShareBn = BigInt(Math.round(match.nav_per_share * 1e18))

  return {
    navPerShare: match.nav_per_share,
    navPerShareBn,
    totalSupply: BigInt(match.total_supply),
    totalAssetCount: 0,   // Not available from SSE chain poller
    pricedAssetCount: 0,  // Not available from SSE chain poller
    isLoading: false,
    error: null,
    refresh: async () => {},
  }
}
