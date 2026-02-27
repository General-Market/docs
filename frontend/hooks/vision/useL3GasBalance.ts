'use client'

import { useAccount, useBalance } from 'wagmi'
import { indexL3 } from '@/lib/wagmi'
import { LOW_GAS_THRESHOLD } from '@/lib/vision/constants'

export interface UseL3GasBalanceReturn {
  /** Native GM balance on L3 */
  balance: bigint
  /** Whether balance is below the low threshold (needs gas) */
  isLow: boolean
  /** Whether data is loading */
  isLoading: boolean
}

/**
 * Read the native GM gas balance on L3 for the connected wallet.
 * Returns isLow=true when balance is below LOW_GAS_THRESHOLD.
 */
export function useL3GasBalance(): UseL3GasBalanceReturn {
  const { address } = useAccount()

  const { data, isLoading } = useBalance({
    address,
    chainId: indexL3.id,
    query: { enabled: !!address },
  })

  const balance = data?.value ?? 0n

  return {
    balance,
    isLow: balance < LOW_GAS_THRESHOLD,
    isLoading,
  }
}
