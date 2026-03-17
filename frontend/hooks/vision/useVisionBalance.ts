'use client'

import { useQuery } from '@tanstack/react-query'
import { useAccount } from 'wagmi'

export interface UseVisionBalanceReturn {
  /** Real balance — backed by actual L3 USDC in Vision.sol */
  realBalance: bigint
  /** Virtual balance — backed by USDC locked in SettlementBridgeCustody on Settlement*/
  virtualBalance: bigint
  /** Total balance = realBalance + virtualBalance */
  total: bigint
  /** Whether data is loading */
  isLoading: boolean
  /** Refetch both balances */
  refetch: () => void
}

/**
 * Read the dual-balance for the connected wallet from the Vision oracle API.
 *
 * Fetches from /api/vision/user/:address/balance (proxied to oracle)
 * instead of direct on-chain reads, avoiding mixed-content issues on HTTPS.
 */
export function useVisionBalance(): UseVisionBalanceReturn {
  const { address } = useAccount()

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['vision-balance', address],
    queryFn: async () => {
      if (!address) return null
      const res = await fetch(`/api/vision/user/${address}/balance`)
      if (!res.ok) return null
      return res.json() as Promise<{ realBalance: string; virtualBalance: string; total: string }>
    },
    enabled: !!address,
    refetchInterval: 10_000,
  })

  const realBalance = data ? BigInt(data.realBalance) : 0n
  const virtualBalance = data ? BigInt(data.virtualBalance) : 0n

  return {
    realBalance,
    virtualBalance,
    total: realBalance + virtualBalance,
    isLoading,
    refetch: () => { refetch() },
  }
}
