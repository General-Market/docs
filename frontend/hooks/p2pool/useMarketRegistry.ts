import { useQuery } from '@tanstack/react-query'
import { DATA_NODE_URL } from '@/lib/config'

export interface MarketInfo {
  id: string
  source: string
  name: string
  value: number
  change24h: number
}

/**
 * Fetches available markets from the data node's active market registry.
 * Used in CreateBatchModal for market selection.
 */
export function useMarketRegistry() {
  const query = useQuery<MarketInfo[]>({
    queryKey: ['p2pool-markets-active'],
    queryFn: async () => {
      const res = await fetch(`${DATA_NODE_URL}/p2pool/markets/active`)
      if (!res.ok) return []
      return res.json()
    },
    refetchInterval: 30000,
    staleTime: 15000,
  })

  return {
    markets: query.data ?? [],
    isLoading: query.isLoading,
  }
}
