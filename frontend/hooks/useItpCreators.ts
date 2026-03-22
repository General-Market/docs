'use client'

import { useMemo } from 'react'
import { useReadContracts } from 'wagmi'
import { INDEX_PROTOCOL } from '@/lib/contracts/addresses'
import { INDEX_ABI } from '@/lib/contracts/index-protocol-abi'
import { activeChainId } from '@/lib/wagmi'

/**
 * Batch-read ITP creators via multicall on getITPState.
 * Returns a Map<itpId, creatorAddress> for all provided ITP IDs.
 */
export function useItpCreators(itpIds: string[]): {
  creators: Map<string, string>
  isLoading: boolean
} {
  const contracts = useMemo(
    () =>
      itpIds.map((id) => ({
        address: INDEX_PROTOCOL.index,
        abi: INDEX_ABI,
        functionName: 'getITPState' as const,
        args: [id as `0x${string}`],
        chainId: activeChainId,
      })),
    [itpIds],
  )

  const { data, isLoading } = useReadContracts({
    contracts,
    query: {
      enabled: itpIds.length > 0,
      refetchInterval: 60_000, // creators don't change — refresh infrequently
      staleTime: 120_000,
    },
  })

  const creators = useMemo(() => {
    const map = new Map<string, string>()
    if (!data) return map
    for (let i = 0; i < itpIds.length; i++) {
      const result = data[i]
      if (result?.status === 'success' && Array.isArray(result.result)) {
        // getITPState returns: [creator, totalSupply, nav, assets[], weights[], inventory[]]
        const creator = result.result[0] as string
        if (creator) map.set(itpIds[i], creator.toLowerCase())
      }
    }
    return map
  }, [data, itpIds])

  return { creators, isLoading }
}
