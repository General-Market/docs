'use client'

import { useQuery } from '@tanstack/react-query'

export interface ProfileTick {
  tickId: number
  pnl: number
  won: boolean
}

export interface ProfileBatch {
  batchId: number
  sourceId: string
  status: 'active' | 'exited'
  deposited: number
  balance: number
  tickCount: number
  roi: number
  ticks: ProfileTick[]
}

export interface PnlPoint {
  timestamp: string
  pnl: number
}

export interface ProfileStats {
  pnl: number
  totalDeposited: number
  roi: number
  winRate: number
  totalBatches: number
  lastActiveAt: string | null
}

export interface PlayerProfile {
  stats: ProfileStats
  batches: ProfileBatch[]
  pnlHistory: PnlPoint[]
}

async function fetchProfile(address: string): Promise<PlayerProfile> {
  const res = await fetch(`/api/vision/player/${address.toLowerCase()}/profile`)
  if (!res.ok) throw new Error(`Profile fetch failed: ${res.status}`)
  return res.json()
}

export function usePlayerProfile(address: string) {
  const { data, isLoading, isError, error } = useQuery({
    queryKey: ['player-profile', address.toLowerCase()],
    queryFn: () => fetchProfile(address),
    enabled: /^0x[0-9a-fA-F]{40}$/.test(address),
    staleTime: 60_000,
    refetchInterval: 60_000,
  })
  return { profile: data ?? null, isLoading, isError, error: error as Error | null }
}
