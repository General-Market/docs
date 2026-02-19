'use client'

import { useAccount, useWaitForTransactionReceipt, useReadContract } from 'wagmi'
import { useChainWriteContract } from '@/hooks/useChainWrite'
import { useEffect, useRef } from 'react'
import { MORPHO_ADDRESSES } from '@/lib/contracts/morpho-addresses'
import { METAMORPHO_VAULT_ABI } from '@/lib/contracts/morpho-abi'
import { ERC20_ABI } from '@/lib/contracts/index-protocol-abi'

interface UseVaultDepositReturn {
  /** Deposit USDC into vault */
  deposit: (amount: bigint) => void
  /** Withdraw USDC from vault */
  withdraw: (amount: bigint) => void
  /** Redeem vault shares for USDC */
  redeem: (shares: bigint) => void
  /** Check if USDC approval is needed */
  isApprovalNeeded: (amount: bigint) => boolean
  /** Approve USDC for vault */
  approve: (amount: bigint) => void
  /** Current USDC allowance for vault */
  allowance: bigint | undefined
  /** Transaction hash */
  txHash: `0x${string}` | undefined
  /** Whether transaction is pending */
  isPending: boolean
  /** Whether transaction is confirming */
  isConfirming: boolean
  /** Whether transaction succeeded */
  isSuccess: boolean
  /** Transaction error */
  error: Error | null
  /** Reset transaction state */
  reset: () => void
  /** Refetch allowance */
  refetchAllowance: () => void
}

/**
 * Hook for MetaMorpho vault deposit/withdraw operations
 *
 * Handles USDC approval and deposit/withdraw into the vault.
 */
export function useVaultDeposit(): UseVaultDepositReturn {
  const { address } = useAccount()

  // Read USDC allowance for vault
  const {
    data: allowance,
    refetch: refetchAllowance,
  } = useReadContract({
    address: MORPHO_ADDRESSES.loanToken, // USDC
    abi: ERC20_ABI,
    functionName: 'allowance',
    args: address ? [address, MORPHO_ADDRESSES.metaMorphoVault] : undefined,
    query: {
      enabled: !!address,
    },
  })

  const {
    writeContract,
    data: txHash,
    isPending,
    error: writeError,
    reset,
  } = useChainWriteContract()

  const {
    isLoading: isConfirming,
    isSuccess,
  } = useWaitForTransactionReceipt({ hash: txHash })

  // Track previous confirmation state
  const prevIsSuccess = useRef(false)

  // Refetch allowance after successful transaction
  useEffect(() => {
    if (isSuccess && !prevIsSuccess.current) {
      refetchAllowance()
    }
    prevIsSuccess.current = isSuccess
  }, [isSuccess, refetchAllowance])

  const isApprovalNeeded = (amount: bigint): boolean => {
    if (allowance === undefined) return true
    return (allowance as bigint) < amount
  }

  const approve = (amount: bigint) => {
    reset()
    writeContract({
      address: MORPHO_ADDRESSES.loanToken,
      abi: ERC20_ABI,
      functionName: 'approve',
      args: [MORPHO_ADDRESSES.metaMorphoVault, amount],
    })
  }

  const deposit = (amount: bigint) => {
    if (!address) return
    reset()
    writeContract({
      address: MORPHO_ADDRESSES.metaMorphoVault,
      abi: METAMORPHO_VAULT_ABI,
      functionName: 'deposit',
      args: [amount, address],
    })
  }

  const withdraw = (amount: bigint) => {
    if (!address) return
    reset()
    writeContract({
      address: MORPHO_ADDRESSES.metaMorphoVault,
      abi: METAMORPHO_VAULT_ABI,
      functionName: 'withdraw',
      args: [amount, address, address],
    })
  }

  const redeem = (shares: bigint) => {
    if (!address) return
    reset()
    writeContract({
      address: MORPHO_ADDRESSES.metaMorphoVault,
      abi: METAMORPHO_VAULT_ABI,
      functionName: 'redeem',
      args: [shares, address, address],
    })
  }

  return {
    deposit,
    withdraw,
    redeem,
    isApprovalNeeded,
    approve,
    allowance: allowance as bigint | undefined,
    txHash,
    isPending,
    isConfirming,
    isSuccess,
    error: writeError as Error | null,
    reset,
    refetchAllowance,
  }
}
