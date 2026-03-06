'use client'

import { useState, useCallback, useRef, useEffect } from 'react'
import { useAccount, useWaitForTransactionReceipt, useReadContract } from 'wagmi'
import { useChainWriteContract } from '@/hooks/useChainWrite'
import { useTransactionNotification } from '@/hooks/useTransactionNotification'
import { VISION_ABI } from '@/lib/contracts/vision-abi'
import { VISION_ADDRESS } from '@/lib/vision/constants'
import { indexL3 } from '@/lib/wagmi'

export type DepositStep = 'idle' | 'depositing' | 'done' | 'error'

export interface UseDepositReturn {
  /** Execute deposit from Vision balance into a batch */
  deposit: (batchId: bigint, amount: bigint) => void
  /** Deposit tx hash */
  depositHash: `0x${string}` | undefined
  /** Current step */
  step: DepositStep
  /** Whether wallet prompt is pending */
  isPending: boolean
  /** Whether a tx is confirming on-chain */
  isConfirming: boolean
  /** Error message if any */
  error: string | null
  /** User's total Vision balance (for UI checks) */
  visionBalance: bigint
  /** Reset to idle state */
  reset: () => void
}

/**
 * Hook to deposit additional USDC into a Vision batch.
 *
 * Vision.deposit(batchId, amount) now pulls from the user's Vision balance
 * internally via _debitBalance. No USDC transferFrom needed, so no approval needed.
 *
 * Flow:
 * 1. Read Vision balanceOf to verify sufficient balance
 * 2. Call Vision.deposit(batchId, amount) directly
 */
export function useDeposit(): UseDepositReturn {
  const { address } = useAccount()

  const [step, setStep] = useState<DepositStep>('idle')
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  const depositHandled = useRef(false)

  // --- Read Vision balance (real + virtual) ---
  const { data: balanceData } = useReadContract({
    address: VISION_ADDRESS,
    abi: VISION_ABI,
    functionName: 'balanceOf',
    args: address ? [address] : undefined,
    chainId: indexL3.id,
    query: { enabled: !!address && VISION_ADDRESS !== '0x0000000000000000000000000000000000000000' },
  })

  const visionBalance = (balanceData as bigint | undefined) ?? 0n

  // --- Deposit ---
  const {
    writeContract: writeDeposit,
    data: depositHash,
    isPending: isDepositPending,
    error: depositError,
    reset: resetDeposit,
  } = useChainWriteContract()
  const {
    isLoading: isDepositConfirming,
    isSuccess: isDepositSuccess,
  } = useWaitForTransactionReceipt({ hash: depositHash, chainId: indexL3.id })

  // Toast notifications for deposit
  useTransactionNotification({
    hash: depositHash,
    isPending: isDepositPending,
    isConfirming: isDepositConfirming,
    isSuccess: isDepositSuccess,
    error: depositError,
    label: 'Batch deposit',
  })

  const deposit = useCallback((batchId: bigint, amount: bigint) => {
    if (!address) return

    setErrorMsg(null)
    depositHandled.current = false

    // Check Vision balance before submitting
    if (visionBalance < amount) {
      setErrorMsg('Insufficient Vision balance. Deposit USDC to your Vision balance first.')
      setStep('error')
      return
    }

    setStep('depositing')
    writeDeposit({
      address: VISION_ADDRESS,
      abi: VISION_ABI,
      functionName: 'deposit',
      args: [batchId, amount],
    })
  }, [address, visionBalance, writeDeposit])

  // Deposit success -> done
  useEffect(() => {
    if (!isDepositSuccess || depositHandled.current) return
    depositHandled.current = true
    setStep('done')
    resetDeposit()
  }, [isDepositSuccess, resetDeposit])

  // Error handling
  useEffect(() => {
    if (depositError) {
      const msg = depositError.message || 'Deposit failed'
      setErrorMsg(msg.slice(0, 300))
      setStep('error')
      resetDeposit()
    }
  }, [depositError, resetDeposit])

  const reset = useCallback(() => {
    setStep('idle')
    setErrorMsg(null)
    resetDeposit()
  }, [resetDeposit])

  return {
    deposit,
    depositHash,
    step,
    isPending: isDepositPending,
    isConfirming: isDepositConfirming,
    error: errorMsg,
    visionBalance,
    reset,
  }
}
