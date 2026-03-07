'use client'

import { useState, useCallback, useRef, useEffect } from 'react'
import { useAccount, useWaitForTransactionReceipt } from 'wagmi'
import { useChainWriteContract } from '@/hooks/useChainWrite'
import { useTransactionNotification } from '@/hooks/useTransactionNotification'
import { VISION_ABI } from '@/lib/contracts/vision-abi'
import { VISION_ADDRESS } from '@/lib/vision/constants'
import { indexL3 } from '@/lib/wagmi'

export type WithdrawBalanceStep = 'idle' | 'withdrawing' | 'done' | 'error'

export interface UseWithdrawBalanceReturn {
  /** Call Vision.withdrawBalance(amount) — debits realBalance, sends L3 USDC to wallet */
  withdraw: (amount: bigint) => void
  /** Current step */
  step: WithdrawBalanceStep
  /** Transaction hash */
  txHash: `0x${string}` | undefined
  /** Error message if any */
  error: string | null
  /** Reset to idle state */
  reset: () => void
}

/**
 * Hook to withdraw from realBalance on Vision.sol (L3).
 * Sends actual L3 USDC from the contract to the user's wallet.
 * Only debits realBalance — use useWithdrawToSettlement for virtualBalance.
 */
export function useWithdrawBalance(): UseWithdrawBalanceReturn {
  const { address } = useAccount()

  const [step, setStep] = useState<WithdrawBalanceStep>('idle')
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  const withdrawHandled = useRef(false)

  const {
    writeContract: writeWithdraw,
    data: txHash,
    isPending: isWithdrawPending,
    error: withdrawError,
    reset: resetWithdraw,
  } = useChainWriteContract()
  const {
    isLoading: isWithdrawConfirming,
    isSuccess: isWithdrawSuccess,
  } = useWaitForTransactionReceipt({ hash: txHash, chainId: indexL3.id })

  // Toast notifications for withdraw
  useTransactionNotification({
    hash: txHash,
    isPending: isWithdrawPending,
    isConfirming: isWithdrawConfirming,
    isSuccess: isWithdrawSuccess,
    error: withdrawError,
    label: 'Withdraw from Vision',
  })

  const withdraw = useCallback((amount: bigint) => {
    if (!address) return

    setErrorMsg(null)
    withdrawHandled.current = false
    setStep('withdrawing')

    writeWithdraw({
      address: VISION_ADDRESS,
      abi: VISION_ABI,
      functionName: 'withdrawBalance',
      args: [amount],
    })
  }, [address, writeWithdraw])

  // Success -> done
  useEffect(() => {
    if (!isWithdrawSuccess || withdrawHandled.current) return
    withdrawHandled.current = true
    setStep('done')
    resetWithdraw()
  }, [isWithdrawSuccess, resetWithdraw])

  // Error handling
  useEffect(() => {
    if (withdrawError) {
      const msg = withdrawError.message || 'Withdrawal failed'
      setErrorMsg(msg.slice(0, 300))
      setStep('error')
      resetWithdraw()
    }
  }, [withdrawError, resetWithdraw])

  const reset = useCallback(() => {
    setStep('idle')
    setErrorMsg(null)
    resetWithdraw()
  }, [resetWithdraw])

  return {
    withdraw,
    step,
    txHash,
    error: errorMsg,
    reset,
  }
}
