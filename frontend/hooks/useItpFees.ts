'use client'

import { useState, useEffect, useCallback } from 'react'
import { usePublicClient } from 'wagmi'
import { INDEX_PROTOCOL } from '@/lib/contracts/addresses'

const FEE_REGISTRY_ABI = [
  {
    inputs: [{ name: 'itpId', type: 'bytes32' }],
    name: 'getAccumulatedFees',
    outputs: [
      { name: 'trading', type: 'uint256' },
      { name: 'management', type: 'uint256' },
      { name: 'bridge', type: 'uint256' },
      { name: 'gas', type: 'uint256' },
    ],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [{ name: 'itpId', type: 'bytes32' }],
    name: 'getTotalFees',
    outputs: [{ name: 'total', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
] as const

interface ItpFees {
  tradingFees: bigint
  managementFees: bigint
  bridgeFees: bigint
  gasFees: bigint
  totalFees: bigint
}

interface UseItpFeesReturn {
  fees: ItpFees | null
  isLoading: boolean
  error: string | null
  refresh: () => Promise<void>
}

/**
 * Reads cumulative fees from FeeRegistry for an ITP.
 * Returns null if FeeRegistry is not deployed (E2E mode).
 *
 * TODO: Migrate to SSE or REST endpoint. This is a single lightweight chain read
 * every 30s — low priority but should eventually move to the data-node to
 * eliminate the last direct RPC dependency.
 */
export function useItpFees(itpId: string | null): UseItpFeesReturn {
  const publicClient = usePublicClient()
  const [fees, setFees] = useState<ItpFees | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetchFees = useCallback(async () => {
    if (!publicClient || !itpId) return

    // Skip if FeeRegistry address not configured
    if (!INDEX_PROTOCOL.feeRegistry || (INDEX_PROTOCOL.feeRegistry as string) === '' || (INDEX_PROTOCOL.feeRegistry as string) === '0x') {
      setFees(null)
      return
    }

    setIsLoading(true)
    setError(null)

    try {
      const result = await publicClient.readContract({
        address: INDEX_PROTOCOL.feeRegistry,
        abi: FEE_REGISTRY_ABI,
        functionName: 'getAccumulatedFees',
        args: [itpId as `0x${string}`],
      }) as [bigint, bigint, bigint, bigint]

      setFees({
        tradingFees: result[0],
        managementFees: result[1],
        bridgeFees: result[2],
        gasFees: result[3],
        totalFees: result[0] + result[1] + result[2] + result[3],
      })
    } catch (e: any) {
      // FeeRegistry may not be deployed — not an error in E2E mode
      setFees(null)
      setError(null)
    } finally {
      setIsLoading(false)
    }
  }, [publicClient, itpId])

  useEffect(() => {
    fetchFees()
    const interval = setInterval(fetchFees, 30_000)
    return () => clearInterval(interval)
  }, [fetchFees])

  return { fees, isLoading, error, refresh: fetchFees }
}
