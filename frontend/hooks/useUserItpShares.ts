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
 * Reads from the SSE stream (userBalances.itp_shares map) instead of direct chain calls.
 * itp_shares is now a Record<string, string> keyed by ITP ID hex.
 */
export function useUserItpShares(
  itpId: `0x${string}` | undefined,
  userAddress: `0x${string}` | undefined
): UseUserItpSharesReturn {
  const balances = useSSEBalances()

  let shares = 0n
  if (balances && itpId && balances.itp_shares) {
    // itp_shares is a map: itp_id hex -> balance string
    const key = itpId.toLowerCase()
    const val = typeof balances.itp_shares === 'object'
      ? balances.itp_shares[key]
      : undefined
    if (val) {
      try { shares = BigInt(val) } catch { /* ignore */ }
    }
    // Backward compat: if itp_shares is still a plain string (old data-node),
    // treat it as the balance for any ITP
    if (shares === 0n && typeof balances.itp_shares === 'string') {
      try { shares = BigInt(balances.itp_shares as unknown as string) } catch { /* ignore */ }
    }
  }

  return {
    shares,
    isLoading: !balances,
    error: null,
    refetch: () => {},
  }
}
