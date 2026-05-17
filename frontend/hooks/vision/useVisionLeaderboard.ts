'use client'

import { useQuery } from '@tanstack/react-query'
import { VISION_API_URL } from '@/lib/config'
import { parseLeaderboardResponse } from '@/lib/leaderboard/parse'
import type { VisionLeaderboardEntry, VisionLeaderboardResponse } from '@/lib/leaderboard/types'

export type { VisionLeaderboardEntry, VisionLeaderboardResponse }

async function fetchVisionLeaderboard(
  batchId?: number,
  sourceId?: string,
): Promise<VisionLeaderboardResponse> {
  if (!VISION_API_URL) {
    return { leaderboard: [], updatedAt: new Date().toISOString() }
  }

  const params = sourceId !== undefined
    ? `?source_id=${encodeURIComponent(sourceId)}`
    : batchId !== undefined
      ? `?batch_id=${batchId}`
      : ''
  const response = await fetch(`${VISION_API_URL}/vision/leaderboard${params}`)
  if (!response.ok) {
    throw new Error(`Failed to fetch Vision leaderboard: ${response.status}`)
  }
  return parseLeaderboardResponse(await response.json())
}

export function useVisionLeaderboard(batchId?: number, sourceId?: string) {
  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['vision-leaderboard', batchId, sourceId],
    queryFn: () => fetchVisionLeaderboard(batchId, sourceId),
    refetchInterval: 30_000,
    staleTime: 15_000,
  })

  return {
    leaderboard: data?.leaderboard ?? [],
    updatedAt: data?.updatedAt ?? null,
    isLoading,
    isError,
    error: error as Error | null,
    refetch,
  }
}
