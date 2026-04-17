'use client'

import { useAccount, useBalance } from '@/lib/wallet-shim'
import { indexL3 } from '@/lib/wagmi'
import { LOW_GAS_THRESHOLD } from '@/lib/vision/constants'

export interface UseL3GasBalanceReturn {
  /** Native GM balance on L3 */
  balance: bigint
  /** Whether balance is below the low threshold (needs gas) */
  isLow: boolean
  /** Whether data is loading */
  isLoading: boolean
  /** Force a refetch (e.g. right after a faucet drip) */
  refetch: () => void
}

/**
 * Read the native GM gas balance on L3 for the connected wallet.
 * Returns isLow=true when balance is below LOW_GAS_THRESHOLD.
 */
export function useL3GasBalance(): UseL3GasBalanceReturn {
  const { address } = useAccount()

  const { data, isLoading, refetch } = useBalance({
    address,
    chainId: indexL3.id,
    query: { enabled: !!address, refetchInterval: 10_000 },
  })

  const balance = data?.value ?? 0n

  return {
    balance,
    isLow: balance < LOW_GAS_THRESHOLD,
    isLoading,
    refetch: () => { refetch() },
  }
}
