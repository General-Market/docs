'use client'

import { useCallback, useState } from 'react'
import { useWaitForTransactionReceipt } from 'wagmi'
import { useChainWriteContract } from '@/hooks/useChainWrite'
import { indexL3 } from '@/lib/wagmi'
import { useTransactionNotification } from '@/hooks/useTransactionNotification'
import { VISION_ABI } from '@/lib/contracts/vision-abi'
import { useDeployment } from '@/hooks/useDeployment'

export function useSetDeployerName() {
  const { getAddress } = useDeployment()
  const visionAddress = getAddress('Vision')

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
  } = useWaitForTransactionReceipt({ hash: txHash, chainId: indexL3.id })

  // Toast notifications
  useTransactionNotification({
    hash: txHash,
    isPending,
    isConfirming,
    isSuccess,
    error: writeError,
    label: 'Set deployer name',
  })

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
      address: visionAddress,
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
