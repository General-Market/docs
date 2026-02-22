import { useQuery } from '@tanstack/react-query'
import { P2POOL_API_URL } from '@/lib/config'

export interface MarketOutcome {
  marketId: string
  startPrice: number
  endPrice: number
  pctChange: number
  wentUp: boolean
}

export interface BatchHistoryEntry {
  tickId: number
  resolvedAt: number
  marketOutcomes: MarketOutcome[]
  totalPool: string
  winnerCount: number
  loserCount: number
}

export function useBatchHistory(batchId: number | null) {
  return useQuery<BatchHistoryEntry[]>({
    queryKey: ['p2pool-batch-history', batchId],
    queryFn: async () => {
      const res = await fetch(`${P2POOL_API_URL}/p2pool/batch/${batchId}/history`)
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = await res.json()
      // Parse market_outcomes JSON if it comes as a string
      return data.map((entry: Record<string, unknown>) => ({
        ...entry,
        marketOutcomes: typeof entry.marketOutcomes === 'string'
          ? JSON.parse(entry.marketOutcomes as string)
          : entry.marketOutcomes ?? [],
      }))
    },
    enabled: batchId !== null,
    refetchInterval: 10000,
  })
}
