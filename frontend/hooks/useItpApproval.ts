'use client'

import { useAccount, useReadContract, useWaitForTransactionReceipt } from 'wagmi'
import { useEffect, useRef } from 'react'
import { MORPHO_ADDRESSES } from '@/lib/contracts/morpho-addresses'
import { ERC20_ABI } from '@/lib/contracts/index-protocol-abi'
import { useChainWriteContract } from '@/hooks/useChainWrite'

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
  /** Refetch allowance */
  refetch: () => void
}

/**
 * Hook for managing ITP ERC20 approval for Morpho contract
 *
 * Similar to useUsdcApproval but for ITP tokens being used as collateral.
 *
 * @param params - Optional collateralToken and morpho addresses. Falls back to MORPHO_ADDRESSES.
 */
export function useItpApproval(params?: UseItpApprovalParams): UseItpApprovalReturn {
  const { address, isConnected } = useAccount()
  const collateralToken = params?.collateralToken ?? MORPHO_ADDRESSES.collateralToken
  const morpho = params?.morpho ?? MORPHO_ADDRESSES.morpho

  // Read current allowance
  const {
    data: currentAllowance,
    isLoading: isCheckingAllowance,
    error: allowanceError,
    refetch: refetchAllowance,
  } = useReadContract({
    address: collateralToken,
    abi: ERC20_ABI,
    functionName: 'allowance',
    args: address ? [address, morpho] : undefined,
    query: {
      enabled: isConnected && !!address,
    },
  })

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

  // Track previous confirmation state
  const prevIsConfirmed = useRef(false)

  // Refetch allowance after confirmation
  useEffect(() => {
    if (isConfirmed && !prevIsConfirmed.current) {
      refetchAllowance()
    }
    prevIsConfirmed.current = isConfirmed
  }, [isConfirmed, refetchAllowance])

  // Determine current state
  const getState = (): ApprovalState => {
    if (!isConnected || !address) return 'idle'
    if (isCheckingAllowance) return 'checking'
    if (isWritePending || isConfirming) return 'approving'
    if (allowanceError || writeError || confirmError) return 'error'
    if (isConfirmed) return 'approved'
    return 'idle'
  }

  // Check if approval is needed for a given amount
  const isApprovalNeeded = (amount: bigint): boolean => {
    if (currentAllowance === undefined) return true
    return (currentAllowance as bigint) < amount
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
  const error = allowanceError || writeError || confirmError || null

  return {
    state: getState(),
    currentAllowance: currentAllowance as bigint | undefined,
    approve,
    isApprovalNeeded,
    error: error as Error | null,
    txHash,
    refetch: refetchAllowance,
  }
}
