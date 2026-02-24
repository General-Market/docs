'use client'

import { useReadContract, useAccount } from 'wagmi'
import { VISION_ABI } from '@/lib/contracts/vision-abi'
import { activeChainId } from '@/lib/wagmi'

const VISION_ADDRESS = (
  process.env.NEXT_PUBLIC_VISION_ADDRESS || '0x0000000000000000000000000000000000000000'
) as `0x${string}`

export interface PlayerPosition {
  balance: bigint
  stakePerTick: bigint
  totalDeposited: bigint
  totalClaimed: bigint
  lastClaimedTick: bigint
  startTick: bigint
  joinTimestamp: bigint
  bitmapHash: string
}

export function usePlayerPosition(batchId: number | undefined) {
  const { address } = useAccount()

  const { data, isLoading, refetch } = useReadContract({
    address: VISION_ADDRESS,
    abi: VISION_ABI,
    functionName: 'getPosition',
    args: batchId !== undefined && address ? [BigInt(batchId), address] : undefined,
    chainId: activeChainId,
    query: {
      enabled: batchId !== undefined && !!address && VISION_ADDRESS !== '0x0000000000000000000000000000000000000000',
      refetchInterval: 10000,
    },
  })

  const pos = data as {
    bitmapHash: string
    stakePerTick: bigint
    startTick: bigint
    balance: bigint
    lastClaimedTick: bigint
    joinTimestamp: bigint
    totalDeposited: bigint
    totalClaimed: bigint
  } | undefined

  const isJoined = pos !== undefined && pos.stakePerTick > 0n

  return {
    position: isJoined ? {
      balance: pos.balance,
      stakePerTick: pos.stakePerTick,
      totalDeposited: pos.totalDeposited,
      totalClaimed: pos.totalClaimed,
      lastClaimedTick: pos.lastClaimedTick,
      startTick: pos.startTick,
      joinTimestamp: pos.joinTimestamp,
      bitmapHash: pos.bitmapHash,
    } : null,
    isJoined,
    isLoading,
    refetch,
  }
}
