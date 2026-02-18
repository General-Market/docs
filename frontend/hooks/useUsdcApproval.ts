'use client'

import { useAccount, useReadContract, useWaitForTransactionReceipt } from 'wagmi'
import { useChainWriteContract } from '@/hooks/useChainWrite'
import { useEffect, useRef } from 'react'
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
 * Hook for managing collateral token ERC20 approval for the AgiArenaCore contract
 * Checks current allowance and requests approval if needed
 */
export function useUsdcApproval(): UseUsdcApprovalReturn {
  const { address, isConnected } = useAccount()

  // Contract address
  const contractAddress = CONTRACT_ADDRESS

  // Read current allowance
  const {
    data: currentAllowance,
    isLoading: isCheckingAllowance,
    error: allowanceError,
    refetch: refetchAllowance
  } = useReadContract({
    address: COLLATERAL_TOKEN_ADDRESS,
    abi: erc20Abi,
    functionName: 'allowance',
    args: address && contractAddress ? [address, contractAddress] : undefined,
    query: {
      enabled: isConnected && !!address && !!contractAddress
    }
  })

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

  // Track previous confirmation state to detect changes
  const prevIsConfirmed = useRef(false)

  // Refetch allowance after confirmation (in useEffect to avoid side effects during render)
  useEffect(() => {
    if (isConfirmed && !prevIsConfirmed.current) {
      refetchAllowance()
    }
    prevIsConfirmed.current = isConfirmed
  }, [isConfirmed, refetchAllowance])

  // Determine current state
  const getState = (): ApprovalState => {
    if (!isConnected || !address || !contractAddress) return 'idle'
    if (isCheckingAllowance) return 'checking'
    if (isWritePending || isConfirming) return 'approving'
    if (allowanceError || writeError || confirmError) return 'error'
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
  const error = allowanceError || writeError || confirmError || null

  return {
    state: getState(),
    currentAllowance,
    approve,
    isApprovalNeeded,
    error,
    txHash
  }
}
