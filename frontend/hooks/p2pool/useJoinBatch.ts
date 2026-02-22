'use client'

import { useState, useCallback, useRef, useEffect } from 'react'
import { useAccount, useWaitForTransactionReceipt, useReadContract } from 'wagmi'
import { useChainWriteContract } from '@/hooks/useChainWrite'
import { ERC20_ABI } from '@/lib/contracts/index-protocol-abi'
import { VISION_ABI } from '@/lib/contracts/vision-abi'
import { encodeBitmap, hashBitmap, type BetDirection } from '@/lib/p2pool/bitmap'

/**
 * Vision contract address.
 *
 * Not yet in deployment.json — will be added when Vision.sol is deployed.
 * For now, read from env or default to zero address (callers must check).
 */
const VISION_ADDRESS = (process.env.NEXT_PUBLIC_VISION_ADDRESS || '0x0000000000000000000000000000000000000000') as `0x${string}`

export interface UseJoinBatchParams {
  batchId: bigint
  depositAmount: bigint
  stakePerTick: bigint
  bets: BetDirection[]
  marketCount: number
}

export interface UseJoinBatchReturn {
  /** Execute the full join flow: encode bitmap -> approve USDC -> joinBatch */
  join: (params: UseJoinBatchParams) => void
  /** The encoded bitmap bytes (available after join is called) */
  bitmap: Uint8Array | null
  /** The bitmap hash committed on-chain */
  bitmapHash: `0x${string}` | null
  /** Approve tx hash */
  approveHash: `0x${string}` | undefined
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

/**
 * Hook to join a P2Pool batch.
 *
 * Flow:
 * 1. Encode bets into bitmap, compute keccak256 hash
 * 2. Check USDC allowance; approve Vision contract if needed
 * 3. Call Vision.joinBatch(batchId, depositAmount, stakePerTick, bitmapHash)
 *
 * After joinBatch succeeds, the caller should use useSubmitBitmap to reveal
 * the actual bitmap bytes to the issuer nodes.
 */
export function useJoinBatch(): UseJoinBatchReturn {
  const { address } = useAccount()

  const [step, setStep] = useState<'idle' | 'approving' | 'joining' | 'done' | 'error'>('idle')
  const [bitmap, setBitmap] = useState<Uint8Array | null>(null)
  const [bitmapHash, setBitmapHash] = useState<`0x${string}` | null>(null)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [pendingParams, setPendingParams] = useState<UseJoinBatchParams | null>(null)

  // Track whether effects have already handled transitions
  const approveHandled = useRef(false)
  const joinHandled = useRef(false)

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

  // --- JoinBatch ---
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
  } = useWaitForTransactionReceipt({ hash: joinHash })

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

  const join = useCallback((params: UseJoinBatchParams) => {
    if (!address) return

    // 1. Encode bitmap and hash
    const encoded = encodeBitmap(params.bets, params.marketCount)
    const hash = hashBitmap(encoded)
    setBitmap(encoded)
    setBitmapHash(hash)
    setErrorMsg(null)
    setPendingParams(params)
    approveHandled.current = false
    joinHandled.current = false

    // 2. Check if approval is needed
    const allowance = currentAllowance as bigint | undefined
    if (allowance !== undefined && allowance >= params.depositAmount) {
      // No approval needed, go straight to joinBatch
      setStep('joining')
      writeJoin({
        address: VISION_ADDRESS,
        abi: VISION_ABI,
        functionName: 'joinBatch',
        args: [params.batchId, params.depositAmount, params.stakePerTick, hash],
      })
    } else {
      // Need approval first
      setStep('approving')
      writeApprove({
        address: (usdcAddress || '0x0000000000000000000000000000000000000000') as `0x${string}`,
        abi: ERC20_ABI,
        functionName: 'approve',
        args: [VISION_ADDRESS, params.depositAmount],
      })
    }
  }, [address, currentAllowance, usdcAddress, writeApprove, writeJoin])

  // Approve success -> trigger joinBatch
  useEffect(() => {
    if (!isApproveSuccess || approveHandled.current || !pendingParams || !bitmapHash) return
    approveHandled.current = true

    refetchAllowance().then(() => {
      resetApprove()
      setStep('joining')
      writeJoin({
        address: VISION_ADDRESS,
        abi: VISION_ABI,
        functionName: 'joinBatch',
        args: [
          pendingParams.batchId,
          pendingParams.depositAmount,
          pendingParams.stakePerTick,
          bitmapHash,
        ],
      })
    })
  }, [isApproveSuccess, pendingParams, bitmapHash, refetchAllowance, resetApprove, writeJoin])

  // JoinBatch success -> done
  useEffect(() => {
    if (!isJoinSuccess || joinHandled.current) return
    joinHandled.current = true
    setStep('done')
    resetJoin()
  }, [isJoinSuccess, resetJoin])

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
    if (joinError) {
      const msg = joinError.message || 'Join batch failed'
      setErrorMsg(msg.slice(0, 300))
      setStep('error')
      resetJoin()
    }
  }, [joinError, resetJoin])

  const reset = useCallback(() => {
    setStep('idle')
    setBitmap(null)
    setBitmapHash(null)
    setErrorMsg(null)
    setPendingParams(null)
    resetApprove()
    resetJoin()
  }, [resetApprove, resetJoin])

  return {
    join,
    bitmap,
    bitmapHash,
    approveHash,
    joinHash,
    step,
    isPending: isApprovePending || isJoinPending,
    isConfirming: isApproveConfirming || isJoinConfirming,
    error: errorMsg,
    reset,
  }
}
