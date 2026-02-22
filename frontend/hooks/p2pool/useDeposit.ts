'use client'

import { useState, useCallback, useRef, useEffect } from 'react'
import { useAccount, useWaitForTransactionReceipt, useReadContract } from 'wagmi'
import { useChainWriteContract } from '@/hooks/useChainWrite'
import { ERC20_ABI } from '@/lib/contracts/index-protocol-abi'
import { VISION_ABI } from '@/lib/contracts/vision-abi'

const VISION_ADDRESS = (
  process.env.NEXT_PUBLIC_VISION_ADDRESS || '0x0000000000000000000000000000000000000000'
) as `0x${string}`

export type DepositStep = 'idle' | 'approving' | 'depositing' | 'done' | 'error'

export interface UseDepositReturn {
  /** Execute approve (if needed) + deposit flow */
  deposit: (batchId: bigint, amount: bigint) => void
  /** Approve tx hash */
  approveHash: `0x${string}` | undefined
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
  /** Reset to idle state */
  reset: () => void
}

/**
 * Hook to deposit additional USDC into a P2Pool batch.
 *
 * Flow:
 * 1. Check USDC allowance for Vision contract
 * 2. Approve if needed
 * 3. Call Vision.deposit(batchId, amount)
 */
export function useDeposit(): UseDepositReturn {
  const { address } = useAccount()

  const [step, setStep] = useState<DepositStep>('idle')
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [pendingBatchId, setPendingBatchId] = useState<bigint | null>(null)
  const [pendingAmount, setPendingAmount] = useState<bigint | null>(null)

  const approveHandled = useRef(false)
  const depositHandled = useRef(false)

  // --- Approve USDC ---
  const {
    writeContract: writeApprove,
    data: approveHash,
    isPending: isApprovePending,
    error: approveError,
    reset: resetApprove,
  } = useChainWriteContract()
  const {
    isLoading: isApproveConfirming,
    isSuccess: isApproveSuccess,
  } = useWaitForTransactionReceipt({ hash: approveHash })

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
  } = useWaitForTransactionReceipt({ hash: depositHash })

  // --- Read USDC address from Vision contract ---
  const { data: usdcAddress } = useReadContract({
    address: VISION_ADDRESS,
    abi: VISION_ABI,
    functionName: 'USDC',
    query: { enabled: VISION_ADDRESS !== '0x0000000000000000000000000000000000000000' },
  })

  // --- Read current allowance ---
  const { data: currentAllowance, refetch: refetchAllowance } = useReadContract({
    address: usdcAddress as `0x${string}` | undefined,
    abi: ERC20_ABI,
    functionName: 'allowance',
    args: address && usdcAddress ? [address, VISION_ADDRESS] : undefined,
    query: { enabled: !!address && !!usdcAddress },
  })

  const deposit = useCallback((batchId: bigint, amount: bigint) => {
    if (!address) return

    setErrorMsg(null)
    setPendingBatchId(batchId)
    setPendingAmount(amount)
    approveHandled.current = false
    depositHandled.current = false

    // Check if approval is needed
    const allowance = currentAllowance as bigint | undefined
    if (allowance !== undefined && allowance >= amount) {
      // No approval needed, go straight to deposit
      setStep('depositing')
      writeDeposit({
        address: VISION_ADDRESS,
        abi: VISION_ABI,
        functionName: 'deposit',
        args: [batchId, amount],
      })
    } else {
      // Need approval first
      setStep('approving')
      writeApprove({
        address: (usdcAddress || '0x0000000000000000000000000000000000000000') as `0x${string}`,
        abi: ERC20_ABI,
        functionName: 'approve',
        args: [VISION_ADDRESS, amount],
      })
    }
  }, [address, currentAllowance, usdcAddress, writeApprove, writeDeposit])

  // Approve success -> trigger deposit
  useEffect(() => {
    if (!isApproveSuccess || approveHandled.current || pendingBatchId === null || pendingAmount === null) return
    approveHandled.current = true

    refetchAllowance().then(() => {
      resetApprove()
      setStep('depositing')
      writeDeposit({
        address: VISION_ADDRESS,
        abi: VISION_ABI,
        functionName: 'deposit',
        args: [pendingBatchId, pendingAmount],
      })
    })
  }, [isApproveSuccess, pendingBatchId, pendingAmount, refetchAllowance, resetApprove, writeDeposit])

  // Deposit success -> done
  useEffect(() => {
    if (!isDepositSuccess || depositHandled.current) return
    depositHandled.current = true
    setStep('done')
    resetDeposit()
  }, [isDepositSuccess, resetDeposit])

  // Error handling
  useEffect(() => {
    if (approveError) {
      const msg = approveError.message || 'Approval failed'
      setErrorMsg(msg.slice(0, 300))
      setStep('error')
      resetApprove()
    }
  }, [approveError, resetApprove])

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
    setPendingBatchId(null)
    setPendingAmount(null)
    resetApprove()
    resetDeposit()
  }, [resetApprove, resetDeposit])

  return {
    deposit,
    approveHash,
    depositHash,
    step,
    isPending: isApprovePending || isDepositPending,
    isConfirming: isApproveConfirming || isDepositConfirming,
    error: errorMsg,
    reset,
  }
}
