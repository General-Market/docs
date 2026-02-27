'use client'

import { useState, useCallback, useRef, useEffect } from 'react'
import { useAccount, useWaitForTransactionReceipt } from 'wagmi'
import { useChainWriteContract } from '@/hooks/useChainWrite'
import { VISION_ABI } from '@/lib/contracts/vision-abi'
import { VISION_ADDRESS } from '@/lib/vision/constants'
import { VISION_ISSUER_URLS } from '@/lib/config'

export type WithdrawToArbStep = 'idle' | 'withdrawing' | 'polling' | 'done' | 'error'

export interface UseWithdrawToArbReturn {
  /** Call Vision.withdrawToArb(amount) — debits virtualBalance, issuers release from ArbBridgeCustody */
  withdraw: (amount: bigint) => void
  /** Current step */
  step: WithdrawToArbStep
  /** L3 transaction hash */
  txHash: `0x${string}` | undefined
  /** Error message if any */
  error: string | null
  /** Reset to idle state */
  reset: () => void
}

/**
 * Hook to withdraw from virtualBalance on Vision.sol (L3).
 * This triggers issuers to release USDC from ArbBridgeCustody on Arbitrum.
 * Only debits virtualBalance — use useWithdrawBalance for realBalance.
 */
export function useWithdrawToArb(): UseWithdrawToArbReturn {
  const { address } = useAccount()

  const [step, setStep] = useState<WithdrawToArbStep>('idle')
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
  } = useWaitForTransactionReceipt({ hash: txHash })

  const withdraw = useCallback((amount: bigint) => {
    if (!address) return

    setErrorMsg(null)
    withdrawHandled.current = false
    setStep('withdrawing')

    writeWithdraw({
      address: VISION_ADDRESS,
      abi: VISION_ABI,
      functionName: 'withdrawToArb',
      args: [amount],
    })
  }, [address, writeWithdraw])

  // On-chain success -> poll for Arb-side completion
  useEffect(() => {
    if (!isWithdrawSuccess || withdrawHandled.current) return
    withdrawHandled.current = true

    // The L3 tx succeeded (virtualBalance debited).
    // Issuers will now call ArbBridgeCustody.releaseVisionWithdrawal().
    // We could poll an API here, but for now just mark done since the L3 side is complete.
    // The user's Arb USDC will arrive asynchronously.
    setStep('done')
    resetWithdraw()
  }, [isWithdrawSuccess, resetWithdraw])

  // Error handling
  useEffect(() => {
    if (withdrawError) {
      const msg = withdrawError.message || 'Withdrawal to Arb failed'
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
