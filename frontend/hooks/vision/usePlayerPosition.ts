'use client'

import { useReadContract, useAccount } from 'wagmi'
import { VISION_ABI } from '@/lib/contracts/vision-abi'
import { indexL3 } from '@/lib/wagmi'
import { useDeployment } from '@/hooks/useDeployment'

export interface PlayerPosition {
  deposit: bigint
  totalDeposited: bigint
  joinTimestamp: bigint
  bitmapHash: string
}

export function usePlayerPosition(batchId: number | undefined) {
  const { address } = useAccount()
  const { getAddress } = useDeployment()
  const visionAddress = getAddress('Vision')

  const { data, isLoading, isError, refetch } = useReadContract({
    address: visionAddress,
    abi: VISION_ABI,
    functionName: 'getPosition',
    args: batchId !== undefined && address ? [BigInt(batchId), address] : undefined,
    chainId: indexL3.id,
    query: {
      enabled: batchId !== undefined && !!address && visionAddress !== '0x0000000000000000000000000000000000000000',
      refetchInterval: 10000,
    },
  })

  const pos = data as {
    bitmapHash: string
    deposit: bigint
    joinTimestamp: bigint
    totalDeposited: bigint
  } | undefined

  // If the contract call reverts (batch no longer exists), treat as not joined
  const isJoined = !isError && pos !== undefined && pos.deposit > 0n

  return {
    position: isJoined ? {
      deposit: pos.deposit,
      totalDeposited: pos.totalDeposited,
      joinTimestamp: pos.joinTimestamp,
      bitmapHash: pos.bitmapHash,
    } : null,
    isJoined,
    isLoading,
    refetch,
  }
}
