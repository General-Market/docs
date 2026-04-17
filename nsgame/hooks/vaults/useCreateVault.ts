'use client'

import { useState, useCallback, useRef, useEffect } from 'react'
import { useAccount, useWaitForTransactionReceipt, useSwitchChain } from '@/lib/wallet-shim'
import { useChainWriteContract, ensureCorrectChain } from '@/hooks/useChainWrite'
import { useTransactionNotification } from '@/hooks/useTransactionNotification'
import { VISION_VAULT_FACTORY_ABI } from '@/lib/contracts/vault-abi'
import { useDeployment } from '@/hooks/useDeployment'
import { indexL3 } from '@/lib/wagmi'

type Step = 'idle' | 'creating' | 'done' | 'error'

export interface CreateVaultParams {
  name: string
  symbol: string
  performanceFeeRate: bigint
  manager: `0x${string}`
}

export interface UseCreateVaultReturn {
  create: (params: CreateVaultParams) => void
  step: Step
  isPending: boolean
  isConfirming: boolean
  error: string | null
  reset: () => void
}

function parseError(err: Error): string {
  const msg = err.message || ''
  if (msg.includes('User rejected') || msg.includes('user rejected')) return 'Transaction rejected in wallet.'
  if (msg.includes('FeeTooHigh')) return 'Performance fee exceeds maximum (50%).'
  if (msg.includes('FailedDeployment')) return 'Vault deployment failed on-chain.'
  return msg.replace(/^ContractFunctionRevertedError:\s*/, '').slice(0, 200) || 'Transaction reverted.'
}

export function useCreateVault(): UseCreateVaultReturn {
  const { address, chainId: currentChainId } = useAccount()
  const { switchChainAsync } = useSwitchChain()
  const { getAddress } = useDeployment()
  const factoryAddress = getAddress('VisionVaultFactory')

  const [step, setStep] = useState<Step>('idle')
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const handled = useRef(false)

  const {
    writeContract,
    data: txHash,
    isPending,
    error: writeError,
    reset: resetWrite,
  } = useChainWriteContract()
  const { isLoading: isConfirming, isSuccess } =
    useWaitForTransactionReceipt({ hash: txHash, chainId: indexL3.id })

  useTransactionNotification({
    hash: txHash,
    isPending,
    isConfirming,
    isSuccess,
    error: writeError,
    label: 'Create vault',
  })

  const create = useCallback(
    async (params: CreateVaultParams) => {
      if (!address) return
      try {
        await ensureCorrectChain(currentChainId, switchChainAsync)
      } catch {
        setErrorMsg('Could not switch to Index L3.')
        setStep('error')
        return
      }
      handled.current = false
      setErrorMsg(null)
      setStep('creating')
      writeContract({
        address: factoryAddress,
        abi: VISION_VAULT_FACTORY_ABI,
        functionName: 'createVault',
        args: [params.name, params.symbol, params.performanceFeeRate, params.manager],
      })
    },
    [address, currentChainId, switchChainAsync, writeContract, factoryAddress],
  )

  useEffect(() => {
    if (!isSuccess || handled.current) return
    handled.current = true
    setStep('done')
    resetWrite()
  }, [isSuccess, resetWrite])

  useEffect(() => {
    if (writeError) {
      setErrorMsg(parseError(writeError))
      setStep('error')
      resetWrite()
    }
  }, [writeError, resetWrite])

  const reset = useCallback(() => {
    setStep('idle')
    setErrorMsg(null)
    resetWrite()
  }, [resetWrite])

  return {
    create,
    step,
    isPending,
    isConfirming,
    error: errorMsg,
    reset,
  }
}
