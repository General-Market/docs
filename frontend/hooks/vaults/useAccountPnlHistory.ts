'use client'

import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useAccount } from 'wagmi'
import { formatUnits } from 'viem'
import { useSSEVisionVaults, useSSEUserVaultPositions } from '@/hooks/useSSE'

export interface AccountPnlPoint {
  ts: number
  value: number
  cost: number
  pnl: number
  realized_pnl: number
}

export interface AccountPnlHistory {
  range: string
  bucket_secs: number
  points: AccountPnlPoint[]
  last_updated: string | null
}

const RANGES = ['1d', '1w', '1m', 'all'] as const
export type AccountPnlRange = (typeof RANGES)[number]

/**
 * Fetches the precomputed per-account portfolio P&L curve from the
 * data-node's `account_pnl_curve` materialized view via
 * `/api/account/:addr/pnl-history`. Cost basis is event-driven, so the
 * absolute level is correct (no "current shares × historical NAV" guess).
 *
 * Augments the bucketed history with a live SSE tip:
 *
 *     liveValue = Σ shares × current_NAV         (from useSSEVisionVaults +
 *                                                  useSSEUserVaultPositions)
 *     liveCost  = last_point.cost                (cost basis is event-driven —
 *                                                  unchanged between events)
 *     livePnl   = liveValue − liveCost
 *
 * appended at NOW so the chart picks up intraday motion within the SSE
 * 3-second cadence rather than waiting for the next account_pnl_curve
 * flush. Same pattern VaultDetailClient uses on /source/.../vault.
 */
export function useAccountPnlHistory(
  address: string | undefined,
  range: AccountPnlRange = 'all',
) {
  const enabled = !!address
  const q = useQuery<AccountPnlHistory>({
    queryKey: ['account-pnl-history', address?.toLowerCase(), range],
    queryFn: async () => {
      const res = await fetch(`/api/account/${address}/pnl-history?range=${range}`)
      if (!res.ok) {
        return { range, bucket_secs: 21600, points: [], last_updated: null }
      }
      return res.json()
    },
    staleTime: 15_000,
    refetchInterval: 30_000,
    refetchIntervalInBackground: false,
    enabled,
  })

  const sseVaults = useSSEVisionVaults()
  const userPositions = useSSEUserVaultPositions()
  const { address: connectedAddress } = useAccount()

  // The SSE stream's userVaultPositions are scoped to the CONNECTED wallet.
  // When the page address is a different wallet (visitor view), pairing the
  // connected user's positions with the profile's cost basis produces a
  // nonsense PnL like "+$901 on a $0 cost basis" — looks like a fake pump.
  // Only enable the live tip when the two addresses match.
  const isOwnProfile =
    !!address &&
    !!connectedAddress &&
    address.toLowerCase() === connectedAddress.toLowerCase()

  // Live tip — compute current portfolio value from streaming NAVs and
  // pair it with the most recent server-side cost basis. Cost basis only
  // changes on deposit/withdraw events, so reusing the last bucket's cost
  // is exact, not an approximation.
  const liveTip = useMemo<AccountPnlPoint | null>(() => {
    if (!isOwnProfile) return null
    const points = q.data?.points
    if (!points || points.length === 0) return null
    if (sseVaults.length === 0) return null
    if (Object.keys(userPositions).length === 0) return null

    const navByAddr = new Map<string, number>()
    for (const v of sseVaults) {
      if (typeof v.nav_per_share === 'number') {
        navByAddr.set(v.address.toLowerCase(), v.nav_per_share)
      }
    }

    let liveValue = 0
    let anyKnown = false
    for (const [vaultAddr, pos] of Object.entries(userPositions)) {
      const nav = navByAddr.get(vaultAddr.toLowerCase())
      if (typeof nav !== 'number') continue
      let sharesFloat = 0
      try {
        sharesFloat = parseFloat(formatUnits(BigInt(pos.shares ?? '0'), 18))
      } catch {
        continue
      }
      if (sharesFloat <= 0) continue
      liveValue += sharesFloat * nav
      anyKnown = true
    }
    if (!anyKnown) return null

    const last = points[points.length - 1]
    return {
      ts: Date.now(),
      value: liveValue,
      cost: last.cost,
      pnl: liveValue - last.cost,
      realized_pnl: last.realized_pnl,
    }
  }, [isOwnProfile, q.data, sseVaults, userPositions])

  // Stitch the live tip onto the server history when it's strictly newer
  // than the last bucket. Pruning the duplicate (same ts) keeps recharts
  // from drawing a vertical segment at NOW.
  //
  // We also drop leading pre-position buckets — rows where cost=0 AND
  // value=0. The writer occasionally emits a zero-zero row at the bucket
  // boundary preceding a first trade, which then graphs as a vertical
  // cliff from PnL=0 down to (price − cost). It reads as a portfolio
  // crash when the user has merely opened a position.
  const history = useMemo<AccountPnlPoint[]>(() => {
    const raw = q.data?.points ?? []
    let firstReal = 0
    while (
      firstReal < raw.length &&
      raw[firstReal].cost === 0 &&
      raw[firstReal].value === 0
    ) {
      firstReal += 1
    }
    const base = raw.slice(firstReal)
    if (!liveTip) return base
    if (base.length === 0) return [liveTip]
    const last = base[base.length - 1]
    if (liveTip.ts <= last.ts) return base
    return [...base, liveTip]
  }, [q.data, liveTip])

  return {
    history,
    livePnl: liveTip?.pnl ?? q.data?.points.at(-1)?.pnl ?? null,
    isLoading: q.isLoading,
    hasHistory: history.length > 1,
    lastUpdated: q.data?.last_updated ?? null,
    bucketSecs: q.data?.bucket_secs,
  }
}
