import { useQuery } from '@tanstack/react-query'
import { DATA_NODE_URL } from '@/lib/config'

export interface BatchState {
  id: number
  creator: string
  marketIds: string[]
  resolutionTypes: number[]
  tickDuration: number
  customThresholds: string[]
  playerCount: number
  tvl: string
  currentTick: number
  paused: boolean
}

export function useBatchState(batchId: number | null) {
  return useQuery<BatchState>({
    queryKey: ['p2pool-batch-state', batchId],
    queryFn: async () => {
      const res = await fetch(`${DATA_NODE_URL}/p2pool/batch/${batchId}/state`)
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      return res.json()
    },
    enabled: batchId !== null,
    refetchInterval: 5000,
  })
}
