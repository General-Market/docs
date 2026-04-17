'use client'

import { useAccount, useWaitForTransactionReceipt } from 'wagmi'
import { useChainWriteContract } from '@/hooks/useChainWrite'
import { useSSEAllowances } from './useSSE'
import { erc20Abi } from '@/lib/contracts/abi'
import { COLLATERAL_TOKEN_ADDRESS, CONTRACT_ADDRESS } from '@/lib/contracts/addresses'

type ApprovalState = 'idle' | 'checking' | 'approval-required' | 'approving' | 'approved' | 'error'

interface UseUsdcApprovalReturn {
  state: ApprovalState
  currentAllowance: bigint | undefined
  approve: (amount: bigint) => void
  isApprovalNeeded: (amount: bigint) => boolean
  error: Error | null
  txHash: `0x${string}` | undefined
}

/**
 * Hook for managing collateral token ERC20 approval for the Index contract.
 * Reads allowance from the SSE stream (userAllowances.usdc_l3_to_index).
 * Write (approve tx) still uses wagmi useWriteContract.
 */
export function useUsdcApproval(): UseUsdcApprovalReturn {
  const { address, isConnected } = useAccount()
  const contractAddress = CONTRACT_ADDRESS

  // Read current allowance from SSE
  const allowances = useSSEAllowances()
  const currentAllowance = allowances ? BigInt(allowances.usdc_l3_to_index) : undefined

  // Write contract for approval
  const {
    writeContract,
    data: txHash,
    isPending: isWritePending,
    error: writeError,
    reset: resetWrite
  } = useChainWriteContract()

  // Wait for transaction confirmation
  const {
    isLoading: isConfirming,
    isSuccess: isConfirmed,
    error: confirmError
  } = useWaitForTransactionReceipt({
    hash: txHash
  })

  // Determine current state
  const getState = (): ApprovalState => {
    if (!isConnected || !address || !contractAddress) return 'idle'
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
    if (!contractAddress) return

    resetWrite()
    writeContract({
      address: COLLATERAL_TOKEN_ADDRESS,
      abi: erc20Abi,
      functionName: 'approve',
      args: [contractAddress, amount]
    })
  }

  // Get first error from any source
  const error = writeError || confirmError || null

  return {
    state: getState(),
    currentAllowance,
    approve,
    isApprovalNeeded,
    error,
    txHash
  }
}
