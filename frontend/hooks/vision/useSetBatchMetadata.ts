'use client'

import { useCallback, useState } from 'react'
import { useWaitForTransactionReceipt } from 'wagmi'
import { useChainWriteContract } from '@/hooks/useChainWrite'
import { VISION_ABI } from '@/lib/contracts/vision-abi'

const VISION_ADDRESS = (
  process.env.NEXT_PUBLIC_VISION_ADDRESS || '0x0000000000000000000000000000000000000000'
) as `0x${string}`

export interface SetBatchMetadataParams {
  batchId: bigint
  name: string
  description: string
  websiteUrl: string
  videoUrl: string
  imageUrl: string
}

export function useSetBatchMetadata() {
  const [error, setError] = useState<string | null>(null)

  const {
    writeContract,
    data: txHash,
    isPending,
    error: writeError,
    reset: resetWrite,
  } = useChainWriteContract()

  const {
    isLoading: isConfirming,
    isSuccess,
  } = useWaitForTransactionReceipt({ hash: txHash })

  if (writeError && !error) {
    const msg = writeError.message || 'Transaction failed'
    const shortMsg = msg.includes('User rejected')
      ? 'Transaction rejected in wallet'
      : msg.includes('Details:')
        ? msg.split('Details:')[1].trim().slice(0, 200)
        : msg.slice(0, 200)
    setError(shortMsg)
  }

  const setBatchMetadata = useCallback((params: SetBatchMetadataParams) => {
    setError(null)
    writeContract({
      address: VISION_ADDRESS,
      abi: VISION_ABI,
      functionName: 'setBatchMetadata',
      args: [
        params.batchId,
        params.name,
        params.description,
        params.websiteUrl,
        params.videoUrl,
        params.imageUrl,
      ],
    })
  }, [writeContract])

  const reset = useCallback(() => {
    resetWrite()
    setError(null)
  }, [resetWrite])

  return { setBatchMetadata, txHash, isPending, isConfirming, isSuccess, error, reset }
}
