'use client'

import { useReadContract } from 'wagmi'
import { INDEX_PROTOCOL } from '@/lib/contracts/addresses'
import { INDEX_ABI } from '@/lib/contracts/index-protocol-abi'

interface UseUserItpSharesReturn {
  shares: bigint
  isLoading: boolean
  error: Error | null
  refetch: () => void
}

export function useUserItpShares(
  itpId: `0x${string}` | undefined,
  userAddress: `0x${string}` | undefined
): UseUserItpSharesReturn {
  const { data, isLoading, error, refetch } = useReadContract({
    address: INDEX_PROTOCOL.index,
    abi: INDEX_ABI,
    functionName: 'getUserShares',
    args: itpId && userAddress ? [itpId, userAddress] : undefined,
    query: {
      enabled: !!itpId && !!userAddress,
      refetchInterval: 10000,
    },
  })

  return {
    shares: (data as bigint) ?? 0n,
    isLoading,
    error: error ?? null,
    refetch,
  }
}
