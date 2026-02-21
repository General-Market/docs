'use client'

import { useAccount, useWaitForTransactionReceipt } from 'wagmi'
import { MORPHO_ADDRESSES } from '@/lib/contracts/morpho-addresses'
import { ERC20_ABI } from '@/lib/contracts/index-protocol-abi'
import { useChainWriteContract } from '@/hooks/useChainWrite'
import { useSSEAllowances } from './useSSE'

type ApprovalState = 'idle' | 'checking' | 'approval-required' | 'approving' | 'approved' | 'error'

interface UseItpApprovalParams {
  collateralToken?: `0x${string}`
  morpho?: `0x${string}`
}

interface UseItpApprovalReturn {
  /** Current approval state */
  state: ApprovalState
  /** Current allowance */
  currentAllowance: bigint | undefined
  /** Request approval for amount */
  approve: (amount: bigint) => void
  /** Check if approval is needed for amount */
  isApprovalNeeded: (amount: bigint) => boolean
  /** Error if any */
  error: Error | null
  /** Transaction hash */
  txHash: `0x${string}` | undefined
  /** Refetch allowance (no-op — SSE handles updates) */
  refetch: () => void
}

/**
 * Hook for managing ITP ERC20 approval for Morpho contract.
 * Reads allowance from the SSE stream (userAllowances.itp_to_morpho).
 * Write (approve tx) still uses wagmi useWriteContract.
 *
 * @param params - Optional collateralToken and morpho addresses. Falls back to MORPHO_ADDRESSES.
 */
export function useItpApproval(params?: UseItpApprovalParams): UseItpApprovalReturn {
  const { address, isConnected } = useAccount()
  const collateralToken = params?.collateralToken ?? MORPHO_ADDRESSES.collateralToken
  const morpho = params?.morpho ?? MORPHO_ADDRESSES.morpho

  // Read current allowance from SSE
  const allowances = useSSEAllowances()
  const currentAllowance = allowances ? BigInt(allowances.itp_to_morpho) : undefined

  // Write contract for approval
  const {
    writeContract,
    data: txHash,
    isPending: isWritePending,
    error: writeError,
    reset: resetWrite,
  } = useChainWriteContract()

  // Wait for transaction confirmation
  const {
    isLoading: isConfirming,
    isSuccess: isConfirmed,
    error: confirmError,
  } = useWaitForTransactionReceipt({ hash: txHash })

  // Determine current state
  const getState = (): ApprovalState => {
    if (!isConnected || !address) return 'idle'
    if (!allowances) return 'checking'
    if (isWritePending || isConfirming) return 'approving'
    if (writeError || confirmError) return 'error'
    if (isConfirmed) return 'approved'
    return 'idle'
  }

  // Check if approval is needed for a given amount
  const isApprovalNeeded = (amount: bigint): boolean => {
    if (currentAllowance === undefined) return true
    return currentAllowance < amount
  }

  // Request approval
  const approve = (amount: bigint) => {
    resetWrite()
    writeContract({
      address: collateralToken,
      abi: ERC20_ABI,
      functionName: 'approve',
      args: [morpho, amount],
    })
  }

  // Get first error from any source
  const error = writeError || confirmError || null

  return {
    state: getState(),
    currentAllowance,
    approve,
    isApprovalNeeded,
    error: error as Error | null,
    txHash,
    refetch: () => {},
  }
}
