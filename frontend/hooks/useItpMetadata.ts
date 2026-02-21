'use client'

import { useReadContract } from 'wagmi'
import { INDEX_PROTOCOL } from '@/lib/contracts/addresses'
import { BRIDGE_PROXY_ABI } from '@/lib/contracts/index-protocol-abi'

interface ItpMetadata {
  description: string
  websiteUrl: string
  videoUrl: string
}

interface UseItpMetadataReturn {
  metadata: ItpMetadata | null
  isLoading: boolean
  error: Error | null
  refetch: () => void
}

export function useItpMetadata(
  itpId: `0x${string}` | undefined
): UseItpMetadataReturn {
  const { data, isLoading, error, refetch } = useReadContract({
    address: INDEX_PROTOCOL.bridgeProxy,
    abi: BRIDGE_PROXY_ABI,
    functionName: 'getItpMetadata',
    args: itpId ? [itpId] : undefined,
    query: {
      enabled: !!itpId,
      refetchInterval: 30000,
    },
  })

  const result = data as [string, string, string] | undefined
  const description = result?.[0] ?? ''
  const websiteUrl = result?.[1] ?? ''
  const videoUrl = result?.[2] ?? ''

  const hasMetadata = description !== '' || websiteUrl !== '' || videoUrl !== ''

  return {
    metadata: hasMetadata ? { description, websiteUrl, videoUrl } : null,
    isLoading,
    error: error ?? null,
    refetch,
  }
}
