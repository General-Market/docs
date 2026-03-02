'use client'

import { useState, useCallback, useRef, useEffect } from 'react'
import { useAccount, useWaitForTransactionReceipt, useReadContract } from 'wagmi'
import { useChainWriteContract } from '@/hooks/useChainWrite'
import { useTransactionNotification } from '@/hooks/useTransactionNotification'
import { ERC20_ABI } from '@/lib/contracts/index-protocol-abi'
import { VISION_ABI } from '@/lib/contracts/vision-abi'
import { VISION_ADDRESS } from '@/lib/vision/constants'

export type DepositBalanceStep = 'idle' | 'approving' | 'depositing' | 'done' | 'error'

export interface UseDepositBalanceReturn {
  /** Execute approve (if needed) + depositBalance flow on L3 */
  deposit: (amount: bigint) => void
  /** Current step */
  step: DepositBalanceStep
  /** Approve tx hash */
  approveHash: `0x${string}` | undefined
  /** Deposit tx hash */
  depositHash: `0x${string}` | undefined
  /** Error message if any */
  error: string | null
  /** Reset to idle state */
  reset: () => void
}

/**
 * Hook for direct L3 deposit: approve L3 USDC (18 dec) then call Vision.depositBalance(amount).
 * Credits realBalance[user] on Vision.sol.
 */
export function useDepositBalance(): UseDepositBalanceReturn {
  const { address } = useAccount()

  const [step, setStep] = useState<DepositBalanceStep>('idle')
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
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

  // --- DepositBalance ---
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

  // Toast notifications for the deposit step (not approval)
  useTransactionNotification({
    hash: depositHash,
    isPending: isDepositPending,
    isConfirming: isDepositConfirming,
    isSuccess: isDepositSuccess,
    error: depositError,
    label: 'Deposit to Vision',
  })

  const deposit = useCallback((amount: bigint) => {
    if (!address) return

    setErrorMsg(null)
    setPendingAmount(amount)
    approveHandled.current = false
    depositHandled.current = false

    const allowance = currentAllowance as bigint | undefined
    if (allowance !== undefined && allowance >= amount) {
      setStep('depositing')
      writeDeposit({
        address: VISION_ADDRESS,
        abi: VISION_ABI,
        functionName: 'depositBalance',
        args: [amount],
      })
    } else {
      setStep('approving')
      writeApprove({
        address: (usdcAddress || '0x0000000000000000000000000000000000000000') as `0x${string}`,
        abi: ERC20_ABI,
        functionName: 'approve',
        args: [VISION_ADDRESS, amount],
      })
    }
  }, [address, currentAllowance, usdcAddress, writeApprove, writeDeposit])

  // Approve success -> trigger depositBalance
  useEffect(() => {
    if (!isApproveSuccess || approveHandled.current || pendingAmount === null) return
    approveHandled.current = true

    refetchAllowance().then(() => {
      resetApprove()
      setStep('depositing')
      writeDeposit({
        address: VISION_ADDRESS,
        abi: VISION_ABI,
        functionName: 'depositBalance',
        args: [pendingAmount],
      })
    })
  }, [isApproveSuccess, pendingAmount, refetchAllowance, resetApprove, writeDeposit])

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
    setPendingAmount(null)
    resetApprove()
    resetDeposit()
  }, [resetApprove, resetDeposit])

  return {
    deposit,
    step,
    approveHash,
    depositHash,
    error: errorMsg,
    reset,
  }
}
