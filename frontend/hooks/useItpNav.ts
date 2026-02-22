'use client'

import { useState, useEffect, useCallback, useRef } from 'react'

const DATA_NODE_URL = process.env.NEXT_PUBLIC_DATA_NODE_URL || 'http://localhost:8200'

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
 * Gets ITP NAV from data-node backend's /itp-price endpoint (live prices).
 *
 * The backend computes NAV = Σ(inventory[i] * latestPrice[i]) / 1e18
 * from its price DB.
 *
 * Never regresses from a good backend NAV (no-regression logic).
 */
export function useItpNav(itpId: string | undefined): ItpNavResult {
  const [navPerShare, setNavPerShare] = useState(0)
  const [navPerShareBn, setNavPerShareBn] = useState(0n)
  const [totalSupply, setTotalSupply] = useState(0n)
  const [totalAssetCount, setTotalAssetCount] = useState(0)
  const [pricedAssetCount, setPricedAssetCount] = useState(0)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const hasReceivedNav = useRef(false)
  const itpIdRef = useRef(itpId)

  useEffect(() => { itpIdRef.current = itpId }, [itpId])

  const compute = useCallback(async () => {
    const id = itpIdRef.current
    if (!id) {
      setIsLoading(false)
      return
    }

    try {
      const navResponse = await fetch(
        `${DATA_NODE_URL}/itp-price?itp_id=${id}`,
        { signal: AbortSignal.timeout(5000) }
      ).then(r => r.ok ? r.json() : null).catch(() => null)

      if (navResponse && navResponse.nav && navResponse.nav !== '0') {
        setNavPerShareBn(BigInt(navResponse.nav))
        setNavPerShare(parseFloat(navResponse.nav_display))
        setPricedAssetCount(navResponse.assets_priced)
        setTotalAssetCount(navResponse.assets_total)
        setError(null)
        hasReceivedNav.current = true
      } else if (!hasReceivedNav.current) {
        // No data yet — keep loading state
      }
    } catch (e: any) {
      if (!hasReceivedNav.current) {
        setError(e.message || 'Failed to fetch NAV')
      }
    } finally {
      setIsLoading(false)
    }
  }, [])

  // Reset state when itpId changes
  useEffect(() => {
    hasReceivedNav.current = false
    setIsLoading(true)
    setNavPerShare(0)
    setNavPerShareBn(0n)
    setTotalSupply(0n)
    setError(null)
  }, [itpId])

  useEffect(() => {
    compute()
    const interval = setInterval(compute, 1_500)
    return () => clearInterval(interval)
  }, [compute, itpId])

  return {
    navPerShare,
    navPerShareBn,
    totalSupply,
    totalAssetCount,
    pricedAssetCount,
    isLoading,
    error,
    refresh: compute,
  }
}
