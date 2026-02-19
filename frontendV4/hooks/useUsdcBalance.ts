'use client'

import { useReadContract, useAccount } from 'wagmi'
import { erc20Abi } from '@/lib/contracts/abi'
import { COLLATERAL_TOKEN_ADDRESS } from '@/lib/contracts/addresses'
import { formatUsdcAmount } from '@/lib/utils/formatters'

interface UseUsdcBalanceReturn {
  /** Raw balance in base units (6 decimals) */
  balance: bigint | undefined
  /** Formatted balance string (e.g., "1,234.56") */
  formatted: string
  /** Whether the balance is currently loading */
  isLoading: boolean
  /** Whether there was an error fetching the balance */
  isError: boolean
  /** Refetch the balance */
  refetch: () => void
}

/**
 * Hook to fetch USDC balance for the connected wallet
 * Auto-refreshes every 5 seconds
 * @returns Balance data, loading state, and error state
 */
export function useUsdcBalance(): UseUsdcBalanceReturn {
  const { address, isConnected } = useAccount()

  const { data: balance, isLoading, isError, refetch } = useReadContract({
    address: COLLATERAL_TOKEN_ADDRESS,
    abi: erc20Abi,
    functionName: 'balanceOf',
    args: address ? [address] : undefined,
    query: {
      enabled: isConnected && !!address,
      refetchInterval: 5000
    }
  })

  // Format balance to display string with commas and 2 decimal places
  const formatted = balance !== undefined
    ? formatUsdcAmount(balance)
    : '0.00'

  return {
    balance,
    formatted,
    isLoading,
    isError,
    refetch
  }
}
