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
      const res = await fetch(
        `/api/vision/asset/${encodeURIComponent(sourceId)}/${encodeURIComponent(
          assetId,
        )}/settlements?limit=${limit}`,
      )
      if (!res.ok) return []
      const data = await res.json()
      const raw = Array.isArray(data.settlements) ? data.settlements : []
      return raw.map((s: any) => ({
        batchId: Number(s.batchId ?? 0),
        settledAt: String(s.settledAt ?? ''),
        outcome: (s.outcome ?? 'Cancelled') as SettlementOutcome,
        upStake: String(s.upStake ?? '0'),
        downStake: String(s.downStake ?? '0'),
        pctChangeBps: Number(s.pctChangeBps ?? 0),
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
    refetchInterval: 30_000,
    staleTime: 15_000,
  })
}
