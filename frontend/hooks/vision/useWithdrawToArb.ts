'use client'

import { useState, useCallback, useRef, useEffect } from 'react'
import { useAccount, useWaitForTransactionReceipt } from 'wagmi'
import { decodeEventLog } from 'viem'
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
 *
 * After L3 tx confirms, polls issuer API for Arb-side completion.
 */
export function useWithdrawToArb(): UseWithdrawToArbReturn {
  const { address } = useAccount()

  const [step, setStep] = useState<WithdrawToArbStep>('idle')
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [withdrawId, setWithdrawId] = useState<string | null>(null)

  const withdrawHandled = useRef(false)
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const {
    writeContract: writeWithdraw,
    data: txHash,
    isPending: isWithdrawPending,
    error: withdrawError,
    reset: resetWithdraw,
  } = useChainWriteContract()
  const {
    isSuccess: isWithdrawSuccess,
    data: withdrawReceipt,
  } = useWaitForTransactionReceipt({ hash: txHash })

  const withdraw = useCallback((amount: bigint) => {
    if (!address) return

    setErrorMsg(null)
    setWithdrawId(null)
    withdrawHandled.current = false
    setStep('withdrawing')

    writeWithdraw({
      address: VISION_ADDRESS,
      abi: VISION_ABI,
      functionName: 'withdrawToArb',
      args: [amount],
    })
  }, [address, writeWithdraw])

  // On-chain success -> extract withdrawId, start polling issuer API
  useEffect(() => {
    if (!isWithdrawSuccess || !withdrawReceipt || withdrawHandled.current) return
    withdrawHandled.current = true

    // Extract withdrawId from WithdrawToArbRequested event
    for (const log of withdrawReceipt.logs) {
      try {
        const decoded = decodeEventLog({
          abi: VISION_ABI,
          data: log.data,
          topics: log.topics,
        })
        if (decoded.eventName === 'WithdrawToArbRequested') {
          setWithdrawId(String((decoded.args as any).withdrawId))
          break
        }
      } catch {
        // Not the right event
      }
    }

    setStep('polling')
    resetWithdraw()
  }, [isWithdrawSuccess, withdrawReceipt, resetWithdraw])

  // Poll issuer API for withdraw completion
  useEffect(() => {
    if (step !== 'polling' || !withdrawId) return

    const poll = async () => {
      for (const url of VISION_ISSUER_URLS) {
        try {
          const res = await fetch(`${url}/vision/withdraw/${withdrawId}/status`)
          if (res.ok) {
            const data = await res.json()
            if (data.status === 'completed') {
              if (pollRef.current) {
                clearInterval(pollRef.current)
                pollRef.current = null
              }
              setStep('done')
              return
            }
            return // got a response, don't try other issuers
          }
        } catch {
          // Try next issuer
        }
      }
    }

    poll()
    pollRef.current = setInterval(poll, 5000)

    // Timeout after 5 minutes — mark done (USDC will arrive eventually)
    const timeout = setTimeout(() => {
      if (pollRef.current) {
        clearInterval(pollRef.current)
        pollRef.current = null
      }
      setStep('done')
    }, 300_000)

    return () => {
      if (pollRef.current) {
        clearInterval(pollRef.current)
        pollRef.current = null
      }
      clearTimeout(timeout)
    }
  }, [step, withdrawId])

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
    if (pollRef.current) {
      clearInterval(pollRef.current)
      pollRef.current = null
    }
    setStep('idle')
    setErrorMsg(null)
    setWithdrawId(null)
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
