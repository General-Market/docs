'use client'

import { useState, useCallback, useRef, useEffect } from 'react'
import { useAccount, useWaitForTransactionReceipt, useReadContract } from 'wagmi'
import { useChainWriteContract } from '@/hooks/useChainWrite'
import { VISION_ABI } from '@/lib/contracts/vision-abi'
import { VISION_ADDRESS } from '@/lib/vision/constants'
import { encodeBitmap, hashBitmap, type BetDirection } from '@/lib/vision/bitmap'

export interface UseJoinBatchParams {
  batchId: bigint
  depositAmount: bigint
  stakePerTick: bigint
  bets: BetDirection[]
  marketCount: number
}

export interface UseJoinBatchReturn {
  /** Execute the full join flow: encode bitmap -> check balance -> joinBatch */
  join: (params: UseJoinBatchParams) => void
  /** The encoded bitmap bytes (available after join is called) */
  bitmap: Uint8Array | null
  /** The bitmap hash committed on-chain */
  bitmapHash: `0x${string}` | null
  /** JoinBatch tx hash */
  joinHash: `0x${string}` | undefined
  /** Current step: 'idle' | 'joining' | 'done' | 'error' */
  step: 'idle' | 'joining' | 'done' | 'error'
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
 * Hook to join a Vision batch (p2pool variant).
 *
 * Flow (dual-balance architecture):
 * 1. Encode bets into bitmap, compute keccak256 hash
 * 2. Check Vision balance >= depositAmount (no USDC approve needed — joinBatch pulls from Vision balance)
 * 3. Call Vision.joinBatch(batchId, depositAmount, stakePerTick, bitmapHash)
 *
 * After joinBatch succeeds, the caller should use useSubmitBitmap to reveal
 * the actual bitmap bytes to the issuer nodes.
 */
export function useJoinBatch(): UseJoinBatchReturn {
  const { address } = useAccount()

  const [step, setStep] = useState<'idle' | 'joining' | 'done' | 'error'>('idle')
  const [bitmap, setBitmap] = useState<Uint8Array | null>(null)
  const [bitmapHash, setBitmapHash] = useState<`0x${string}` | null>(null)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  // Track whether effects have already handled transitions
  const joinHandled = useRef(false)

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
    isError: isJoinReceiptError,
    error: joinReceiptError,
  } = useWaitForTransactionReceipt({ hash: joinHash })

  // --- Read Vision balance (realBalance + virtualBalance) ---
  const { data: visionBalance } = useReadContract({
    address: VISION_ADDRESS,
    abi: VISION_ABI,
    functionName: 'balanceOf',
    args: address ? [address] : undefined,
    query: { enabled: !!address && VISION_ADDRESS !== '0x0000000000000000000000000000000000000000' },
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

    // 2. Check balance (no approve needed — joinBatch pulls from Vision balance internally)
    const balance = (visionBalance as bigint | undefined) ?? 0n
    if (balance < params.depositAmount) {
      setErrorMsg(`Insufficient Vision balance. Have ${balance}, need ${params.depositAmount}. Deposit USDC first.`)
      setStep('error')
      return
    }

    // 3. Call joinBatch directly
    setStep('joining')
    writeJoin({
      address: VISION_ADDRESS,
      abi: VISION_ABI,
      functionName: 'joinBatch',
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      args: [params.batchId, params.depositAmount, params.stakePerTick, hash] as any,
    })
  }, [address, visionBalance, writeJoin])

  // JoinBatch success -> done
  useEffect(() => {
    if (!isJoinSuccess || joinHandled.current) return
    joinHandled.current = true
    setStep('done')
    resetJoin()
  }, [isJoinSuccess, resetJoin])

  // Error handling
  useEffect(() => {
    if (joinError) {
      const msg = joinError.message || 'Join batch failed'
      setErrorMsg(msg.slice(0, 300))
      setStep('error')
      resetJoin()
    }
  }, [joinError, resetJoin])

  // Handle receipt errors
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
    resetJoin()
  }, [resetJoin])

  return {
    join,
    bitmap,
    bitmapHash,
    joinHash,
    step,
    isPending: isJoinPending,
    isConfirming: isJoinConfirming,
    error: errorMsg,
    reset,
  }
}
