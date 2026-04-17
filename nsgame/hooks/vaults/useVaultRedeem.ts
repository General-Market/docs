'use client'

import { useState, useCallback, useRef, useEffect } from 'react'
import { useAccount, useWaitForTransactionReceipt, useSwitchChain } from '@/lib/wallet-shim'
import { useChainWriteContract, ensureCorrectChain } from '@/hooks/useChainWrite'
import { useTransactionNotification } from '@/hooks/useTransactionNotification'
import { VISION_VAULT_ABI } from '@/lib/contracts/vault-abi'
import { indexL3 } from '@/lib/wagmi'

type Step = 'idle' | 'requesting' | 'done' | 'error'

export interface UseVaultRedeemReturn {
  redeem: (vaultAddress: `0x${string}`, shares: bigint) => void
  claim: (vaultAddress: `0x${string}`) => void
  step: Step
  isPending: boolean
  isConfirming: boolean
  error: string | null
  reset: () => void
}

function parseError(err: Error): string {
  const msg = err.message || ''
  if (msg.includes('User rejected') || msg.includes('user rejected')) return 'Transaction rejected in wallet.'
  if (msg.includes('NothingToClaim')) return 'Nothing to claim yet. Wait for reconciliation.'
  if (msg.includes('InsufficientIdleCapital')) return 'Insufficient idle capital. Wait for next batch settlement.'
  return msg.replace(/^ContractFunctionRevertedError:\s*/, '').slice(0, 200) || 'Transaction reverted.'
}

export function useVaultRedeem(): UseVaultRedeemReturn {
  const { address, chainId: currentChainId } = useAccount()
  const { switchChainAsync } = useSwitchChain()

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
    label: 'Vault redeem',
  })

  const redeem = useCallback(
    async (vaultAddress: `0x${string}`, shares: bigint) => {
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
      setStep('requesting')
      writeContract({
        address: vaultAddress,
        abi: VISION_VAULT_ABI,
        functionName: 'requestRedeem',
        args: [shares, address, address],
      })
    },
    [address, currentChainId, switchChainAsync, writeContract],
  )

  const claim = useCallback(
    async (vaultAddress: `0x${string}`) => {
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
      setStep('requesting')
      writeContract({
        address: vaultAddress,
        abi: VISION_VAULT_ABI,
        functionName: 'claimRedeem',
        args: [address, address],
      })
    },
    [address, currentChainId, switchChainAsync, writeContract],
  )

  // Success
  useEffect(() => {
    if (!isSuccess || handled.current) return
    handled.current = true
    setStep('done')
    resetWrite()
  }, [isSuccess, resetWrite])

  // Error
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
    redeem,
    claim,
    step,
    isPending,
    isConfirming,
    error: errorMsg,
    reset,
  }
}
