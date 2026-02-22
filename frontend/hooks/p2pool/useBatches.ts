import { useQuery } from '@tanstack/react-query'
import { DATA_NODE_URL } from '@/lib/config'

export interface BatchInfo {
  id: number
  creator: string
  marketIds: string[]
  resolutionTypes: number[]
  tickDuration: number
  playerCount: number
  tvl: string
  currentTick: number
  paused: boolean
}

export function useBatches() {
  return useQuery<BatchInfo[]>({
    queryKey: ['p2pool-batches'],
    queryFn: async () => {
      const res = await fetch(`${DATA_NODE_URL}/p2pool/batches`)
      if (!res.ok) return []
      return res.json()
    },
    refetchInterval: 10000,
  })
}
