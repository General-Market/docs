'use client'

import { useQuery } from '@tanstack/react-query'
import { DATA_NODE_URL } from '@/lib/config'

export interface PointsData {
  vision: number
  indexCreator: number
  indexHolder: number
  total: number
  updatedAt: string
}

export interface PointsLeaderboardEntry {
  rank: number
  player: string
  vision: number
  indexCreator: number
  indexHolder: number
  total: number
}

export interface PointsLeaderboard {
  entries: PointsLeaderboardEntry[]
  updatedAt: string
}

async function fetchPoints(address: string): Promise<PointsData> {
  const res = await fetch(`${DATA_NODE_URL}/points?user=${address.toLowerCase()}`)
  if (!res.ok) {
    return { vision: 0, indexCreator: 0, indexHolder: 0, total: 0, updatedAt: new Date().toISOString() }
  }
  const data = await res.json()
  return {
    vision: data.vision ?? 0,
    indexCreator: data.indexCreator ?? 0,
    indexHolder: data.indexHolder ?? 0,
    total: data.total ?? 0,
    updatedAt: data.updatedAt ?? new Date().toISOString(),
  }
}

async function fetchPointsLeaderboard(limit = 50, offset = 0): Promise<PointsLeaderboard> {
  const res = await fetch(`${DATA_NODE_URL}/points/leaderboard?limit=${limit}&offset=${offset}`)
  if (!res.ok) {
    return { entries: [], updatedAt: new Date().toISOString() }
  }
  const data = await res.json()
  return {
    entries: (data.entries ?? []).map((e: Record<string, unknown>) => ({
      rank: (e.rank as number) ?? 0,
      player: (e.player as string) ?? '',
      vision: (e.vision as number) ?? 0,
      indexCreator: (e.indexCreator as number) ?? 0,
      indexHolder: (e.indexHolder as number) ?? 0,
      total: (e.total as number) ?? 0,
    })),
    updatedAt: data.updatedAt ?? new Date().toISOString(),
  }
}

export function usePoints(address?: string) {
  const { data, isLoading, isError } = useQuery({
    queryKey: ['points', address],
    queryFn: () => fetchPoints(address!),
    enabled: !!address,
    refetchInterval: 15000,
    staleTime: 10000,
  })

  return {
    points: data ?? { vision: 0, indexCreator: 0, indexHolder: 0, total: 0, updatedAt: '' },
    isLoading,
    isError,
  }
}

export function usePointsLeaderboard(limit = 50, offset = 0) {
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['points-leaderboard', limit, offset],
    queryFn: () => fetchPointsLeaderboard(limit, offset),
    refetchInterval: 30000,
    staleTime: 15000,
  })

  return {
    leaderboard: data?.entries ?? [],
    updatedAt: data?.updatedAt ?? null,
    isLoading,
    isError,
    refetch,
  }
}
