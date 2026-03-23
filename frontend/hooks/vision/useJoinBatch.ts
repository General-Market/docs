'use client'

import { useState, useCallback, useRef, useEffect } from 'react'
import { useAccount, useWaitForTransactionReceipt, useReadContract } from 'wagmi'
import { formatUnits } from 'viem'
import { useChainWriteContract } from '@/hooks/useChainWrite'
import { useTransactionNotification } from '@/hooks/useTransactionNotification'
import { VISION_ABI } from '@/lib/contracts/vision-abi'
import { VISION_ADDRESS } from '@/lib/vision/constants'
import { encodeBitmap, hashBitmap, type BetDirection } from '@/lib/vision/bitmap'
import { indexL3 } from '@/lib/wagmi'
import { useDeployment } from '@/hooks/useDeployment'

export interface UseJoinBatchParams {
  batchId: bigint
  configHash: `0x${string}`
  depositAmount: bigint
  stakePerTick: bigint
  bets: BetDirection[]
  marketCount: number
}

export interface UseJoinBatchReturn {
  /** Execute the full join flow: encode bitmap -> approve USDC -> joinBatchDirect */
  join: (params: UseJoinBatchParams) => void
  /** The encoded bitmap bytes (available after join is called) */
  bitmap: Uint8Array | null
  /** The bitmap hash committed on-chain */
  bitmapHash: `0x${string}` | null
  /** JoinBatch tx hash */
  joinHash: `0x${string}` | undefined
  /** Current step: 'idle' | 'approving' | 'joining' | 'done' | 'error' */
  step: 'idle' | 'approving' | 'joining' | 'done' | 'error'
  /** Whether wallet prompt is pending */
  isPending: boolean
  /** Whether a tx is confirming on-chain */
  isConfirming: boolean
  /** Error message if any */
  error: string | null
  /** Reset to idle state */
  reset: () => void
}

const ERC20_ABI = [
  {
    inputs: [{ name: 'account', type: 'address' }],
    name: 'balanceOf',
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [
      { name: 'spender', type: 'address' },
      { name: 'amount', type: 'uint256' },
    ],
    name: 'approve',
    outputs: [{ name: '', type: 'bool' }],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [
      { name: 'owner', type: 'address' },
      { name: 'spender', type: 'address' },
    ],
    name: 'allowance',
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
] as const

/**
 * Hook to join a Vision batch (round-based).
 *
 * Flow:
 * 1. Encode bets into bitmap, compute keccak256 hash
 * 2. Check wallet USDC balance >= depositAmount
 * 3. Approve USDC to Vision contract (if needed)
 * 4. Call Vision.joinBatchDirect(batchId, configHash, depositAmount, depositAmount, bitmapHash)
 *
 * After joinBatchDirect succeeds, the caller should use useSubmitBitmap to reveal
 * the actual bitmap bytes to the oracle nodes.
 */
export function useJoinBatch(): UseJoinBatchReturn {
  const { address } = useAccount()
  const { getAddress } = useDeployment()
  const usdcAddress = getAddress('L3_WUSDC')

  const [step, setStep] = useState<'idle' | 'approving' | 'joining' | 'done' | 'error'>('idle')
  const [bitmap, setBitmap] = useState<Uint8Array | null>(null)
  const [bitmapHash, setBitmapHash] = useState<`0x${string}` | null>(null)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [pendingParams, setPendingParams] = useState<UseJoinBatchParams | null>(null)

  const joinHandled = useRef(false)
  const approveHandled = useRef(false)

  // --- Approve ---
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
  } = useWaitForTransactionReceipt({ hash: approveHash, chainId: indexL3.id })

  // --- JoinBatchDirect ---
  const {
    writeContract: writeJoin,
    data: joinHash,
    isPending: isJoinPending,
    error: joinError,
    reset: resetJoin,
  } = useChainWriteContract()
  const {
    isLoading: isJoinConfirming,
    isSuccess: isJoinSuccess,
    isError: isJoinReceiptError,
    error: joinReceiptError,
  } = useWaitForTransactionReceipt({ hash: joinHash, chainId: indexL3.id })

  // --- Read wallet USDC balance ---
  const { data: walletBalance } = useReadContract({
    address: usdcAddress,
    abi: ERC20_ABI,
    functionName: 'balanceOf',
    args: address ? [address] : undefined,
    query: { enabled: !!address && usdcAddress !== '0x0000000000000000000000000000000000000000' },
  })

  // --- Read allowance ---
  const { data: allowance } = useReadContract({
    address: usdcAddress,
    abi: ERC20_ABI,
    functionName: 'allowance',
    args: address ? [address, VISION_ADDRESS] : undefined,
    query: { enabled: !!address && usdcAddress !== '0x0000000000000000000000000000000000000000' },
  })

  // Toast notifications for join
  useTransactionNotification({
    hash: joinHash,
    isPending: isJoinPending,
    isConfirming: isJoinConfirming,
    isSuccess: isJoinSuccess,
    error: joinError,
    label: 'Join round',
  })

  const join = useCallback((params: UseJoinBatchParams) => {
    if (!address) return

    // 1. Encode bitmap and hash
    const encoded = encodeBitmap(params.bets, params.marketCount)
    const hash = hashBitmap(encoded)
    setBitmap(encoded)
    setBitmapHash(hash)
    setErrorMsg(null)
    joinHandled.current = false
    approveHandled.current = false

    // 2. Check wallet USDC balance
    const balance = (walletBalance as bigint | undefined) ?? 0n
    if (balance < params.depositAmount) {
      setErrorMsg(`Insufficient USDC in wallet. Have ${formatUnits(balance, 18)}, need ${formatUnits(params.depositAmount, 18)} USDC.`)
      setStep('error')
      return
    }

    // 3. Check allowance — approve if needed
    const currentAllowance = (allowance as bigint | undefined) ?? 0n
    if (currentAllowance < params.depositAmount) {
      setPendingParams(params)
      setStep('approving')
      writeApprove({
        address: usdcAddress,
        abi: ERC20_ABI,
        functionName: 'approve',
        args: [VISION_ADDRESS, params.depositAmount],
      })
      return
    }

    // 4. Allowance sufficient — call joinBatchDirect directly
    setPendingParams(null)
    setStep('joining')
    writeJoin({
      address: VISION_ADDRESS,
      abi: VISION_ABI,
      functionName: 'joinBatchDirect',
      args: [params.batchId, params.configHash, params.depositAmount, params.depositAmount, hash],
    })
  }, [address, walletBalance, allowance, writeApprove, writeJoin, usdcAddress])

  // Approve success -> call joinBatchDirect
  useEffect(() => {
    if (!isApproveSuccess || approveHandled.current || !pendingParams || !bitmapHash) return
    approveHandled.current = true
    setStep('joining')
    resetApprove()
    writeJoin({
      address: VISION_ADDRESS,
      abi: VISION_ABI,
      functionName: 'joinBatchDirect',
      args: [pendingParams.batchId, pendingParams.configHash, pendingParams.depositAmount, pendingParams.depositAmount, bitmapHash],
    })
    setPendingParams(null)
  }, [isApproveSuccess, pendingParams, bitmapHash, writeJoin, resetApprove])

  // JoinBatchDirect success -> done
  useEffect(() => {
    if (!isJoinSuccess || joinHandled.current) return
    joinHandled.current = true
    setStep('done')
    resetJoin()
  }, [isJoinSuccess, resetJoin])

  // Timeout: if confirming for >30s, assume success (L3 RPC may be rate-limited)
  useEffect(() => {
    if (!isJoinConfirming || !joinHash) return
    const timer = setTimeout(() => {
      if (step === 'joining' && !joinHandled.current) {
        joinHandled.current = true
        setStep('done')
      }
    }, 30_000)
    return () => clearTimeout(timer)
  }, [isJoinConfirming, joinHash, step])

  // Error handling
  useEffect(() => {
    if (approveError) {
      const msg = approveError.message || 'USDC approve failed'
      setErrorMsg(msg.slice(0, 300))
      setStep('error')
      resetApprove()
    }
  }, [approveError, resetApprove])

  useEffect(() => {
    if (joinError) {
      const msg = joinError.message || 'Join round failed'
      setErrorMsg(msg.slice(0, 300))
      setStep('error')
      resetJoin()
    }
  }, [joinError, resetJoin])

  useEffect(() => {
    if (isJoinReceiptError && joinReceiptError) {
      const msg = joinReceiptError.message || 'Join transaction reverted'
      setErrorMsg(msg.slice(0, 300))
      setStep('error')
      resetJoin()
    }
  }, [isJoinReceiptError, joinReceiptError, resetJoin])

  const reset = useCallback(() => {
    setStep('idle')
    setBitmap(null)
    setBitmapHash(null)
    setErrorMsg(null)
    setPendingParams(null)
    resetJoin()
    resetApprove()
  }, [resetJoin, resetApprove])

  return {
    join,
    bitmap,
    bitmapHash,
    joinHash,
    step,
    isPending: isJoinPending || isApprovePending,
    isConfirming: isJoinConfirming || isApproveConfirming,
    error: errorMsg,
    reset,
  }
}
