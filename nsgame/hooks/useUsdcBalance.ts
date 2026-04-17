'use client'

import { useSSEBalances } from './useSSE'
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
  /** Refetch the balance (no-op — SSE handles updates) */
  refetch: () => void
}

/**
 * Hook to fetch USDC balance for the connected wallet.
 * Reads from the SSE stream (userBalances.usdc_l3) instead of direct chain calls.
 * @returns Balance data, loading state, and error state
 */
export function useUsdcBalance(): UseUsdcBalanceReturn {
  const balances = useSSEBalances()

  const balance = balances ? BigInt(balances.usdc_l3) : undefined
  const formatted = balance !== undefined ? formatUsdcAmount(balance) : '0.00'

  return {
    balance,
    formatted,
    isLoading: !balances,
    isError: false,
    refetch: () => {},
  }
}
