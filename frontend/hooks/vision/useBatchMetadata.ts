'use client'

import { useReadContract } from 'wagmi'
import { VISION_ABI } from '@/lib/contracts/vision-abi'
import { activeChainId } from '@/lib/wagmi'

const VISION_ADDRESS = (
  process.env.NEXT_PUBLIC_VISION_ADDRESS || '0x0000000000000000000000000000000000000000'
) as `0x${string}`

export interface BatchMetadata {
  name: string
  description: string
  websiteUrl: string
  videoUrl: string
  imageUrl: string
}

export function useBatchMetadata(batchId: number | undefined) {
  const { data, isLoading, error, refetch } = useReadContract({
    address: VISION_ADDRESS,
    abi: VISION_ABI,
    functionName: 'getBatchMetadata',
    args: batchId !== undefined ? [BigInt(batchId)] : undefined,
    chainId: activeChainId,
    query: {
      enabled: batchId !== undefined,
      refetchInterval: 30000,
    },
  })

  const result = data as [string, string, string, string, string] | undefined
  const name = result?.[0] ?? ''
  const description = result?.[1] ?? ''
  const websiteUrl = result?.[2] ?? ''
  const videoUrl = result?.[3] ?? ''
  const imageUrl = result?.[4] ?? ''

  const hasMetadata = name !== '' || description !== '' || websiteUrl !== '' || videoUrl !== '' || imageUrl !== ''

  return {
    metadata: hasMetadata ? { name, description, websiteUrl, videoUrl, imageUrl } : null,
    isLoading,
    error: error ?? null,
    refetch,
  }
}
