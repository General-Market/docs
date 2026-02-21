'use client'

import { useSSEBalances } from './useSSE'

interface UseUserItpSharesReturn {
  shares: bigint
  isLoading: boolean
  error: Error | null
  refetch: () => void
}

/**
 * Hook to fetch ITP shares for the connected wallet.
 * Reads from the SSE stream (userBalances.itp_shares) instead of direct chain calls.
 */
export function useUserItpShares(
  itpId: `0x${string}` | undefined,
  userAddress: `0x${string}` | undefined
): UseUserItpSharesReturn {
  const balances = useSSEBalances()

  const shares = balances ? BigInt(balances.itp_shares) : 0n

  return {
    shares,
    isLoading: !balances,
    error: null,
    refetch: () => {},
  }
}
