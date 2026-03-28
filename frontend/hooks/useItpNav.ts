'use client'

import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
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
 * Gets ITP NAV from the SSE stream (no polling).
 *
 * Primary: reads from the SSE itp-nav / itp-nav-delta events.
 * Fallback: if SSE hasn't delivered data within 3s, does a single
 * REST fetch to /api/itp-price. No periodic polling.
 */
export function useItpNav(itpId: string | undefined): ItpNavResult {
  const sseNav = useSSENav()

  const sseEntry = useMemo(() => {
    if (!itpId || sseNav.length === 0) return null
    return sseNav.find(s => s.itp_id === itpId) ?? null
  }, [sseNav, itpId])

  // REST fallback — fires once if SSE hasn't delivered within 3s
  const [restNav, setRestNav] = useState<{
    navPerShare: number
    navPerShareBn: bigint
    totalAssetCount: number
    pricedAssetCount: number
  } | null>(null)
  const [restLoading, setRestLoading] = useState(false)
  const [restError, setRestError] = useState<string | null>(null)
  const fetchedRef = useRef(false)

  // Reset when itpId changes
  useEffect(() => {
    setRestNav(null)
    setRestError(null)
    setRestLoading(false)
    fetchedRef.current = false
  }, [itpId])

  const fetchOnce = useCallback(async () => {
    if (!itpId || fetchedRef.current) return
    fetchedRef.current = true
    setRestLoading(true)
    try {
      const res = await fetch(
        `/api/itp-price?itp_id=${encodeURIComponent(itpId)}`,
        { signal: AbortSignal.timeout(8000) }
      )
      if (!res.ok) return
      const json = await res.json()
      if (json?.nav && json.nav !== '0') {
        setRestNav({
          navPerShare: parseFloat(json.nav_display),
          navPerShareBn: BigInt(json.nav),
          totalAssetCount: json.assets_total ?? 0,
          pricedAssetCount: json.assets_priced ?? 0,
        })
        setRestError(null)
      }
    } catch (e) {
      setRestError(e instanceof Error ? e.message : 'Failed to fetch NAV')
    } finally {
      setRestLoading(false)
    }
  }, [itpId])

  // If SSE hasn't delivered data for this ITP within 3s, do one REST fetch
  useEffect(() => {
    if (sseEntry || !itpId) return
    const timeout = setTimeout(fetchOnce, 3000)
    return () => clearTimeout(timeout)
  }, [sseEntry, itpId, fetchOnce])

  // SSE wins over REST fallback
  if (sseEntry) {
    let navBn = 0n
    try { navBn = BigInt(Math.round(sseEntry.nav_per_share * 1e18)) } catch { /* */ }
    let supply = 0n
    try { supply = BigInt(sseEntry.total_supply) } catch { /* */ }

    return {
      navPerShare: sseEntry.nav_per_share,
      navPerShareBn: navBn,
      totalSupply: supply,
      totalAssetCount: restNav?.totalAssetCount ?? 0,
      pricedAssetCount: restNav?.pricedAssetCount ?? 0,
      isLoading: false,
      error: null,
      refresh: fetchOnce,
    }
  }

  if (restNav) {
    return {
      navPerShare: restNav.navPerShare,
      navPerShareBn: restNav.navPerShareBn,
      totalSupply: 0n,
      totalAssetCount: restNav.totalAssetCount,
      pricedAssetCount: restNav.pricedAssetCount,
      isLoading: false,
      error: null,
      refresh: fetchOnce,
    }
  }

  return {
    navPerShare: 0,
    navPerShareBn: 0n,
    totalSupply: 0n,
    totalAssetCount: 0,
    pricedAssetCount: 0,
    isLoading: !restError && (restLoading || !fetchedRef.current),
    error: restError,
    refresh: fetchOnce,
  }
}
