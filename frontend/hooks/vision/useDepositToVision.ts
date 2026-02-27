'use client'

import { useState, useCallback, useRef, useEffect } from 'react'
import { useAccount, useWaitForTransactionReceipt, useReadContract } from 'wagmi'
import { useWriteContract } from 'wagmi'
import { decodeEventLog } from 'viem'
import { ERC20_ABI } from '@/lib/contracts/index-protocol-abi'
import { ARB_BRIDGE_CUSTODY_ABI } from '@/lib/contracts/arb-bridge-custody-abi'
import {
  ARB_BRIDGE_CUSTODY_ADDRESS,
  ARB_USDC_ADDRESS,
  VISION_ADDRESS,
} from '@/lib/vision/constants'
import { arbChainId } from '@/lib/wagmi'
import { VISION_ABI } from '@/lib/contracts/vision-abi'
import { indexL3 } from '@/lib/wagmi'
import { VISION_ISSUER_URLS } from '@/lib/config'

export type DepositToVisionStep =
  | 'idle'
  | 'approving'
  | 'depositing'
  | 'polling'
  | 'done'
  | 'error'

export interface UseDepositToVisionReturn {
  /** Execute the cross-chain deposit flow: approve Arb USDC -> depositToVision -> poll for credit */
  deposit: (usdcAmount: bigint) => void
  /** The orderId from the deposit event */
  orderId: `0x${string}` | null
  /** Current step */
  step: DepositToVisionStep
  /** Error message if any */
  error: string | null
  /** Reset to idle state */
  reset: () => void
}

/**
 * Hook for cross-chain deposit from Arbitrum to Vision.sol on L3.
 *
 * Flow:
 * 1. Approve USDC (6 dec) on Arbitrum for ArbBridgeCustody
 * 2. Call ArbBridgeCustody.depositToVision(usdcAmount) on Arbitrum
 * 3. Poll Vision.virtualBalance(address) on L3 until credited
 *
 * The issuers observe the ArbBridgeCustody event and call Vision.creditBalance() on L3.
 */
export function useDepositToVision(): UseDepositToVisionReturn {
  const { address } = useAccount()

  const [step, setStep] = useState<DepositToVisionStep>('idle')
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [orderId, setOrderId] = useState<`0x${string}` | null>(null)
  const [pendingAmount, setPendingAmount] = useState<bigint | null>(null)
  const [initialVirtualBalance, setInitialVirtualBalance] = useState<bigint | null>(null)

  const approveHandled = useRef(false)
  const depositHandled = useRef(false)
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // --- Approve USDC on Arb ---
  const {
    writeContract: writeApprove,
    data: approveHash,
    isPending: isApprovePending,
    error: approveError,
    reset: resetApprove,
  } = useWriteContract()
  const {
    isSuccess: isApproveSuccess,
  } = useWaitForTransactionReceipt({ hash: approveHash })

  // --- DepositToVision on Arb ---
  const {
    writeContract: writeDeposit,
    data: depositHash,
    isPending: isDepositPending,
    error: depositError,
    reset: resetDeposit,
  } = useWriteContract()
  const {
    isSuccess: isDepositSuccess,
    data: depositReceipt,
  } = useWaitForTransactionReceipt({ hash: depositHash })

  // --- Read allowance on Arb ---
  const { data: currentAllowance, refetch: refetchAllowance } = useReadContract({
    address: ARB_USDC_ADDRESS,
    abi: ERC20_ABI,
    functionName: 'allowance',
    args: address ? [address, ARB_BRIDGE_CUSTODY_ADDRESS] : undefined,
    chainId: arbChainId,
    query: { enabled: !!address && ARB_BRIDGE_CUSTODY_ADDRESS !== '0x0000000000000000000000000000000000000000' },
  })

  // --- Read virtualBalance on L3 (for polling) ---
  const { data: currentVirtualBalance, refetch: refetchVirtualBalance } = useReadContract({
    address: VISION_ADDRESS,
    abi: VISION_ABI,
    functionName: 'virtualBalance',
    args: address ? [address] : undefined,
    chainId: indexL3.id,
    query: { enabled: !!address && step === 'polling' },
  })

  const deposit = useCallback((usdcAmount: bigint) => {
    if (!address) return

    setErrorMsg(null)
    setOrderId(null)
    setPendingAmount(usdcAmount)
    setInitialVirtualBalance(null)
    approveHandled.current = false
    depositHandled.current = false

    // Check allowance
    const allowance = currentAllowance as bigint | undefined
    if (allowance !== undefined && allowance >= usdcAmount) {
      setStep('depositing')
      writeDeposit({
        address: ARB_BRIDGE_CUSTODY_ADDRESS,
        abi: ARB_BRIDGE_CUSTODY_ABI,
        functionName: 'depositToVision',
        args: [usdcAmount],
        chainId: arbChainId,
      })
    } else {
      setStep('approving')
      writeApprove({
        address: ARB_USDC_ADDRESS,
        abi: ERC20_ABI,
        functionName: 'approve',
        args: [ARB_BRIDGE_CUSTODY_ADDRESS, usdcAmount],
        chainId: arbChainId,
      })
    }
  }, [address, currentAllowance, writeApprove, writeDeposit])

  // Approve success -> call depositToVision
  useEffect(() => {
    if (!isApproveSuccess || approveHandled.current || pendingAmount === null) return
    approveHandled.current = true

    refetchAllowance().then(() => {
      resetApprove()
      setStep('depositing')
      writeDeposit({
        address: ARB_BRIDGE_CUSTODY_ADDRESS,
        abi: ARB_BRIDGE_CUSTODY_ABI,
        functionName: 'depositToVision',
        args: [pendingAmount],
        chainId: arbChainId,
      })
    })
  }, [isApproveSuccess, pendingAmount, refetchAllowance, resetApprove, writeDeposit])

  // Deposit success -> extract orderId, start polling L3 virtualBalance
  useEffect(() => {
    if (!isDepositSuccess || !depositReceipt || depositHandled.current) return
    depositHandled.current = true

    // Extract orderId from VisionDepositCreated event
    for (const log of depositReceipt.logs) {
      try {
        const decoded = decodeEventLog({
          abi: ARB_BRIDGE_CUSTODY_ABI,
          data: log.data,
          topics: log.topics,
        })
        if (decoded.eventName === 'VisionDepositCreated') {
          setOrderId((decoded.args as any).orderId as `0x${string}`)
          break
        }
      } catch {
        // Not the right event
      }
    }

    // Snapshot current virtualBalance before polling
    if (currentVirtualBalance !== undefined) {
      setInitialVirtualBalance(currentVirtualBalance as bigint)
    } else {
      setInitialVirtualBalance(0n)
    }

    setStep('polling')
    resetDeposit()
  }, [isDepositSuccess, depositReceipt, currentVirtualBalance, resetDeposit])

  // Poll L3 virtualBalance until it increases (issuers credited)
  useEffect(() => {
    if (step !== 'polling' || initialVirtualBalance === null) return

    // Start polling
    pollRef.current = setInterval(() => {
      refetchVirtualBalance()
    }, 3000)

    return () => {
      if (pollRef.current) {
        clearInterval(pollRef.current)
        pollRef.current = null
      }
    }
  }, [step, initialVirtualBalance, refetchVirtualBalance])

  // Check if virtualBalance increased
  useEffect(() => {
    if (step !== 'polling' || initialVirtualBalance === null) return

    const current = (currentVirtualBalance as bigint | undefined) ?? 0n
    if (current > initialVirtualBalance) {
      // Balance credited!
      if (pollRef.current) {
        clearInterval(pollRef.current)
        pollRef.current = null
      }
      setStep('done')
    }
  }, [step, currentVirtualBalance, initialVirtualBalance])

  // Timeout polling after 2 minutes
  useEffect(() => {
    if (step !== 'polling') return

    const timeout = setTimeout(() => {
      if (pollRef.current) {
        clearInterval(pollRef.current)
        pollRef.current = null
      }
      // Don't error — the deposit is locked on Arb and will be credited eventually
      setStep('done')
    }, 120_000)

    return () => clearTimeout(timeout)
  }, [step])

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
    if (pollRef.current) {
      clearInterval(pollRef.current)
      pollRef.current = null
    }
    setStep('idle')
    setErrorMsg(null)
    setOrderId(null)
    setPendingAmount(null)
    setInitialVirtualBalance(null)
    resetApprove()
    resetDeposit()
  }, [resetApprove, resetDeposit])

  return {
    deposit,
    orderId,
    step,
    error: errorMsg,
    reset,
  }
}
