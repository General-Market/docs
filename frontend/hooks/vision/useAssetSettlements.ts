'use client'

import { useQuery } from '@tanstack/react-query'

export type SettlementOutcome =
  | 'Up'
  | 'Down'
  | 'Flat'
  | 'Cancelled'
  | 'AllSameSide'
  | 'AllLosers'

export type SettlementSide = 'Up' | 'Down'

export interface AssetSettlementPlayer {
  player: string
  side: SettlementSide
  won: boolean
  effectiveStake: string
  payout: string
}

export interface AssetSettlement {
  batchId: number
  settledAt: string
  outcome: SettlementOutcome
  upStake: string
  downStake: string
  pctChangeBps: number
  /** Threshold in bps used to resolve this batch. Zero for binary up_0/down_0
   *  markets, or for legacy rows from before the oracle persisted it. */
  thresholdBps: number
  /** 0 = unknown, 1 = up_x, 2 = down_x, 3 = flat_x, 4 = up_0, 5 = down_0, etc. */
  resolutionType: number
  players: AssetSettlementPlayer[]
}

export function useAssetSettlements(
  sourceId: string,
  assetId: string,
  limit = 200,
) {
  return useQuery<AssetSettlement[]>({
    queryKey: ['asset-settlements', sourceId, assetId, limit],
    queryFn: async () => {
      // The proxy itself caps at 15s outer budget. Match that on the
      // client: a longer client timeout than the server is dead weight —
      // it just keeps a hung socket alive.
      const res = await fetch(
        `/api/vision/asset/${encodeURIComponent(sourceId)}/${encodeURIComponent(
          assetId,
        )}/settlements?limit=${limit}`,
        { signal: AbortSignal.timeout(18_000) },
      )
      // Throw on transport failure so React Query surfaces an error state
      // instead of caching an empty array — otherwise the UI is indistinguishable
      // from "no participants" when the upstream just timed out.
      if (!res.ok) throw new Error(`Settlements fetch failed: ${res.status}`)
      const data = await res.json()
      const raw = Array.isArray(data.settlements) ? data.settlements : []
      return raw.map((s: any) => ({
        batchId: Number(s.batchId ?? 0),
        settledAt: String(s.settledAt ?? ''),
        outcome: (s.outcome ?? 'Cancelled') as SettlementOutcome,
        upStake: String(s.upStake ?? '0'),
        downStake: String(s.downStake ?? '0'),
        pctChangeBps: Number(s.pctChangeBps ?? 0),
        thresholdBps: Number(s.thresholdBps ?? 0),
        resolutionType: Number(s.resolutionType ?? 0),
        players: Array.isArray(s.players)
          ? s.players.map((p: any) => ({
              player: String(p.player ?? ''),
              side: (p.side ?? 'Up') as SettlementSide,
              won: Boolean(p.won),
              effectiveStake: String(p.effectiveStake ?? '0'),
              payout: String(p.payout ?? '0'),
            }))
          : [],
      })) as AssetSettlement[]
    },
    // Steady-state poll cadence. When the last query errored, fall back to
    // a shorter interval so the page recovers within ~6s of the proxy
    // coming back, rather than waiting on the full 30s steady tick.
    refetchInterval: (q) =>
      q.state.status === 'error' ? 6_000 : 30_000,
    staleTime: 15_000,
    // Cover the worst case of an oracle rolling restart: ~5s per oracle
    // × 3 oracles + jitter. Four retries with capped backoff get the
    // hook through the restart window without the user noticing.
    retry: 4,
    retryDelay: attempt => Math.min(1_500 * 2 ** attempt, 4_000),
  })
}
