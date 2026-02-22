'use client'

import { useCallback, useState } from 'react'
import { useWaitForTransactionReceipt } from 'wagmi'
import { useChainWriteContract } from '@/hooks/useChainWrite'
import { VISION_ABI } from '@/lib/contracts/vision-abi'

const VISION_ADDRESS = (
  process.env.NEXT_PUBLIC_VISION_ADDRESS || '0x0000000000000000000000000000000000000000'
) as `0x${string}`

export function useSetDeployerName() {
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

  const setDeployerName = useCallback((name: string) => {
    setError(null)
    writeContract({
      address: VISION_ADDRESS,
      abi: VISION_ABI,
      functionName: 'setDeployerName',
      args: [name],
    })
  }, [writeContract])

  const reset = useCallback(() => {
    resetWrite()
    setError(null)
  }, [resetWrite])

  return { setDeployerName, txHash, isPending, isConfirming, isSuccess, error, reset }
}
