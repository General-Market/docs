'use client'

import { useReadContract } from '@/lib/wallet-shim'
import { VISION_ABI } from '@/lib/contracts/vision-abi'
import { indexL3 } from '@/lib/wagmi'
import { useDeployment } from '@/hooks/useDeployment'

export interface BatchMetadata {
  name: string
  description: string
  websiteUrl: string
  videoUrl: string
  imageUrl: string
}

export function useBatchMetadata(batchId: number | undefined) {
  const { getAddress } = useDeployment()
  const visionAddress = getAddress('Vision')

  const { data, isLoading, error, refetch } = useReadContract({
    address: visionAddress,
    abi: VISION_ABI,
    functionName: 'getBatchMetadata',
    args: batchId !== undefined ? [BigInt(batchId)] : undefined,
    chainId: indexL3.id,
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
