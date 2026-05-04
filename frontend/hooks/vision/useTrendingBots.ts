'use client'

import { useQuery } from '@tanstack/react-query'
import type { BotEntry, TrendingBotsResponse } from '@/app/api/vision/bots/trending/route'

export type { BotEntry, TrendingBotsResponse }

async function fetchTrendingBots(sourceId: string): Promise<TrendingBotsResponse> {
  const res = await fetch(`/api/vision/bots/trending?source=${encodeURIComponent(sourceId)}`)
  if (!res.ok) {
    return { bots: [], _stub: true, reason: 'fetch failed' }
  }
  return res.json()
}

export function useTrendingBots(sourceId: string) {
  const { data, isLoading, isError } = useQuery<TrendingBotsResponse>({
    queryKey: ['trending-bots', sourceId],
    queryFn: () => fetchTrendingBots(sourceId),
    staleTime: 5 * 60 * 1000,
    enabled: Boolean(sourceId),
  })

  return {
    bots: data?.bots ?? [],
    isStub: data?._stub ?? false,
    stubReason: data?.reason ?? null,
    isLoading,
    isError,
  }
}
