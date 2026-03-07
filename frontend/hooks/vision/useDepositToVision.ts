'use client'

import { useState, useCallback, useRef, useEffect } from 'react'
import { useAccount, useWaitForTransactionReceipt, useReadContract } from 'wagmi'
import { useWriteContract } from 'wagmi'
import { decodeEventLog } from 'viem'
import { useTransactionNotification } from '@/hooks/useTransactionNotification'
import { ERC20_ABI } from '@/lib/contracts/index-protocol-abi'
import { SETTLEMENT_BRIDGE_CUSTODY_ABI } from '@/lib/contracts/settlement-bridge-custody-abi'
import {
  SETTLEMENT_BRIDGE_CUSTODY_ADDRESS,
  SETTLEMENT_USDC_ADDRESS,
  VISION_ADDRESS,
} from '@/lib/vision/constants'
import { settlementChainId } from '@/lib/wagmi'
import { VISION_ABI } from '@/lib/contracts/vision-abi'
import { indexL3 } from '@/lib/wagmi'
import { useDepositStatus, type DepositStatus } from '@/hooks/vision/useDepositStatus'

export type DepositToVisionStep =
  | 'idle'
  | 'approving'
  | 'depositing'
  | 'polling'
  | 'bridging'
  | 'done'
  | 'error'

export interface UseDepositToVisionReturn {
  /** Execute the cross-chain deposit flow: approve Settlement USDC -> depositToVision -> poll for credit */
  deposit: (usdcAmount: bigint) => void
  /** The orderId from the deposit event */
  orderId: `0x${string}` | null
  /** Current step */
  step: DepositToVisionStep
  /** Deposit status from issuer API (pending/credited/refunded/unknown) */
  depositStatus: DepositStatus
  /** Error message if any */
  error: string | null
  /** Reset to idle state */
  reset: () => void
}

/**
 * Hook for cross-chain deposit from Settlement to Vision.sol on L3.
 *
 * Flow:
 * 1. Approve USDC (6 dec) on Settlement for SettlementBridgeCustody
 * 2. Call SettlementBridgeCustody.depositToVision(usdcAmount) on Settlement
 * 3. Poll Vision.virtualBalance(address) on L3 until credited
 *
 * The issuers observe the SettlementBridgeCustody event and call Vision.creditBalance() on L3.
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

  // --- Deposit status from issuer API ---
  const { status: depositStatus } = useDepositStatus(orderId)

  // --- Approve USDC on Settlement ---
  const {
    writeContract: writeApprove,
    data: approveHash,
    isPending: isApprovePending,
    error: approveError,
    reset: resetApprove,
  } = useWriteContract()
  const {
    isSuccess: isApproveSuccess,
  } = useWaitForTransactionReceipt({ hash: approveHash, chainId: settlementChainId })

  // --- DepositToVision on Settlement ---
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
  } = useWaitForTransactionReceipt({ hash: depositHash, chainId: settlementChainId })

  // --- Read allowance on Settlement ---
  const { data: currentAllowance, refetch: refetchAllowance } = useReadContract({
    address: SETTLEMENT_USDC_ADDRESS,
    abi: ERC20_ABI,
    functionName: 'allowance',
    args: address ? [address, SETTLEMENT_BRIDGE_CUSTODY_ADDRESS] : undefined,
    chainId: settlementChainId,
    query: { enabled: !!address && SETTLEMENT_BRIDGE_CUSTODY_ADDRESS !== '0x0000000000000000000000000000000000000000' },
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

  // Toast notifications for the deposit tx (on Settlement)
  useTransactionNotification({
    hash: depositHash,
    isPending: isDepositPending,
    isConfirming: false,
    isSuccess: isDepositSuccess,
    error: depositError,
    label: 'Deposit to Vision (Settlement)',
    chain: 'settlement',
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
        address: SETTLEMENT_BRIDGE_CUSTODY_ADDRESS,
        abi: SETTLEMENT_BRIDGE_CUSTODY_ABI,
        functionName: 'depositToVision',
        args: [usdcAmount],
        chainId: settlementChainId,
      })
    } else {
      setStep('approving')
      writeApprove({
        address: SETTLEMENT_USDC_ADDRESS,
        abi: ERC20_ABI,
        functionName: 'approve',
        args: [SETTLEMENT_BRIDGE_CUSTODY_ADDRESS, usdcAmount],
        chainId: settlementChainId,
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
        address: SETTLEMENT_BRIDGE_CUSTODY_ADDRESS,
        abi: SETTLEMENT_BRIDGE_CUSTODY_ABI,
        functionName: 'depositToVision',
        args: [pendingAmount],
        chainId: settlementChainId,
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
          abi: SETTLEMENT_BRIDGE_CUSTODY_ABI,
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
      // Deposit is locked on Settlement and will be credited eventually — show bridging state
      setStep('bridging')
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
    depositStatus,
    error: errorMsg,
    reset,
  }
}
