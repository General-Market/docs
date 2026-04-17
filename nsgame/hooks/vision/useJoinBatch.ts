'use client'

import { useState, useCallback, useRef, useEffect } from 'react'
import { useAccount, useWaitForTransactionReceipt, useReadContract, useSwitchChain } from 'wagmi'
import { useChainWriteContract, ensureCorrectChain } from '@/hooks/useChainWrite'
import { useTransactionNotification } from '@/hooks/useTransactionNotification'
import { VISION_ABI } from '@/lib/contracts/vision-abi'
import { encodeBitmap, hashBitmap, type BetDirection } from '@/lib/vision/bitmap'
import { indexL3 } from '@/lib/wagmi'
import { useDeployment } from '@/hooks/useDeployment'

/** Map contract error names to user-facing messages */
const ERROR_MESSAGES: Record<string, string> = {
  BatchNotFound: 'Batch not found or config changed. Refresh the page.',
  BatchPaused: 'This batch is paused.',
  AlreadyJoined: 'You already joined this round.',
  TickLocked: 'Round is locked — predictions close before settlement.',
  DepositBelowMinimum: 'Deposit too low. Minimum is 0.1 USDC.',
  NonZeroSum: 'Player count incompatible with payout split.',
  Unauthorized: 'Not authorized for this action.',
  BatchAlreadySettled: 'This batch has already been settled.',
}

/** Extract a readable message from a wagmi/viem error */
function parseContractError(err: Error): string {
  const msg = err.message || ''
  // viem decodes custom errors as "Error: ErrorName()" in the message
  for (const [name, readable] of Object.entries(ERROR_MESSAGES)) {
    if (msg.includes(name)) return readable
  }
  // ERC20 transfer failures
  if (msg.includes('ERC20InsufficientBalance') || msg.includes('transfer amount exceeds balance'))
    return 'Insufficient USDC balance.'
  if (msg.includes('ERC20InsufficientAllowance') || msg.includes('allowance'))
    return 'USDC allowance too low. Try again — approval may have failed.'
  // User rejected in wallet
  if (msg.includes('User rejected') || msg.includes('user rejected'))
    return 'Transaction rejected in wallet.'
  // Fallback: trim the viem noise
  const short = msg.replace(/^ContractFunctionRevertedError:\s*/, '').slice(0, 200)
  return short || 'Transaction reverted.'
}

export interface UseJoinBatchParams {
  batchId: bigint
  configHash: `0x${string}`
  depositAmount: bigint
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
 * 2. Approve USDC to Vision contract (if needed)
 * 3. Call Vision.joinBatchDirect(batchId, configHash, depositAmount, bitmapHash)
 *
 * After joinBatchDirect succeeds, the caller should use useSubmitBitmap to reveal
 * the actual bitmap bytes to the oracle nodes.
 */
export function useJoinBatch(): UseJoinBatchReturn {
  const { address, chainId: currentChainId } = useAccount()
  const { switchChainAsync } = useSwitchChain()
  const { getAddress } = useDeployment()
  const visionAddress = getAddress('Vision')
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

  // --- Read allowance ---
  const { data: allowance } = useReadContract({
    address: usdcAddress,
    abi: ERC20_ABI,
    functionName: 'allowance',
    args: address ? [address, visionAddress] : undefined,
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

  const join = useCallback(async (params: UseJoinBatchParams) => {
    if (!address) return

    // 0. Ensure wallet is on L3 before any writes.
    // useChainWriteContract has its own ensureCorrectChain, but it swallows
    // errors silently (returns without calling writeContract). If we pre-check
    // here and fail, we can set a visible error for the user.
    try {
      await ensureCorrectChain(currentChainId, switchChainAsync)
    } catch (e: any) {
      setErrorMsg(
        e?.message?.includes('rejected')
          ? 'Chain switch rejected. Please switch to Index L3 and try again.'
          : 'Could not switch to Index L3. Please switch manually in your wallet.'
      )
      setStep('error')
      return
    }

    // 1. Encode bitmap and hash
    const encoded = encodeBitmap(params.bets, params.marketCount)
    const hash = hashBitmap(encoded)
    setBitmap(encoded)
    setBitmapHash(hash)
    setErrorMsg(null)
    joinHandled.current = false
    approveHandled.current = false

    // 2. Check allowance — approve if needed
    const currentAllowance = (allowance as bigint | undefined) ?? 0n
    if (currentAllowance < params.depositAmount) {
      setPendingParams(params)
      setStep('approving')
      writeApprove({
        address: usdcAddress,
        abi: ERC20_ABI,
        functionName: 'approve',
        args: [visionAddress, params.depositAmount],
      })
      return
    }

    // 3. Allowance sufficient — call joinBatchDirect directly
    setPendingParams(null)
    setStep('joining')
    writeJoin({
      address: visionAddress,
      abi: VISION_ABI,
      functionName: 'joinBatchDirect',
      args: [params.batchId, params.configHash, params.depositAmount, hash],
    })
  }, [address, currentChainId, switchChainAsync, allowance, writeApprove, writeJoin, usdcAddress, visionAddress])

  // Approve success -> call joinBatchDirect
  useEffect(() => {
    if (!isApproveSuccess || approveHandled.current || !pendingParams || !bitmapHash) return
    approveHandled.current = true
    setStep('joining')
    resetApprove()
    writeJoin({
      address: visionAddress,
      abi: VISION_ABI,
      functionName: 'joinBatchDirect',
      args: [pendingParams.batchId, pendingParams.configHash, pendingParams.depositAmount, bitmapHash],
    })
    setPendingParams(null)
  }, [isApproveSuccess, pendingParams, bitmapHash, writeJoin, resetApprove, visionAddress])

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
        resetJoin() // Clear hash so wagmi stops polling and isJoinConfirming goes false
      }
    }, 30_000)
    return () => clearTimeout(timer)
  }, [isJoinConfirming, joinHash, step, resetJoin])

  // Error handling
  useEffect(() => {
    if (approveError) {
      setErrorMsg(parseContractError(approveError))
      setStep('error')
      resetApprove()
    }
  }, [approveError, resetApprove])

  useEffect(() => {
    if (joinError) {
      setErrorMsg(parseContractError(joinError))
      setStep('error')
      resetJoin()
    }
  }, [joinError, resetJoin])

  useEffect(() => {
    if (isJoinReceiptError && joinReceiptError) {
      setErrorMsg(parseContractError(joinReceiptError))
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
