'use client'

import { useReadContract, useAccount } from '@/lib/wallet-shim'
import { VISION_ABI } from '@/lib/contracts/vision-abi'
import { indexL3 } from '@/lib/wagmi'
import { useDeployment } from '@/hooks/useDeployment'

export interface PlayerPosition {
  totalDeposited: bigint
  joinTimestamp: bigint
  bitmapHash: string
}

export function usePlayerPosition(batchId: number | undefined) {
  const { address } = useAccount()
  const { getAddress } = useDeployment()
  const visionAddress = getAddress('Vision')

  const { data, isLoading, isError, error, refetch } = useReadContract({
    address: visionAddress,
    abi: VISION_ABI,
    functionName: 'getPosition',
    args: batchId !== undefined && address ? [BigInt(batchId), address] : undefined,
    chainId: indexL3.id,
    query: {
      enabled: batchId !== undefined && !!address && visionAddress !== '0x0000000000000000000000000000000000000000',
      refetchInterval: 10000,
      // Contract reverts are not transient — don't waste retries on a deleted batch
      retry: false,
    },
  })

  const pos = data as {
    bitmapHash: string
    configHash: string
    joinTimestamp: bigint
    totalDeposited: bigint
  } | undefined

  // If the contract call reverts (batch no longer exists), treat as not joined.
  // Check both isError (query-level) AND error (set on background refetch failure
  // even when TanStack Query keeps stale data with status: 'success').
  const hasError = isError || error !== null
  const isJoined = !hasError && pos !== undefined && pos.totalDeposited > 0n

  return {
    position: isJoined ? {
      totalDeposited: pos!.totalDeposited,
      joinTimestamp: pos!.joinTimestamp,
      bitmapHash: pos!.bitmapHash,
    } : null,
    isJoined,
    isLoading,
    isError: hasError,
    refetch,
  }
}
