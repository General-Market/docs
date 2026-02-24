'use client'

import { useAccount, useReadContracts } from 'wagmi'
import { useMemo } from 'react'
import { useBatches, type BatchInfo } from './useBatches'
import { VISION_ABI } from '@/lib/contracts/vision-abi'
import { activeChainId } from '@/lib/wagmi'

const VISION_ADDRESS = (
  process.env.NEXT_PUBLIC_VISION_ADDRESS || '0x0000000000000000000000000000000000000000'
) as `0x${string}`

export interface PlayerBatchPosition {
  batchId: number
  batch: BatchInfo
  balance: bigint
  stakePerTick: bigint
  totalDeposited: bigint
  totalClaimed: bigint
  lastClaimedTick: bigint
  startTick: bigint
  joinTimestamp: bigint
  pnl: bigint // balance - totalDeposited + totalClaimed
  pnlPercent: number // PnL as percentage of deposited
}

/**
 * Find all batches where the connected wallet has an active position.
 * Reads getPosition for each active batch in a single multicall.
 */
export function usePlayerBatches() {
  const { address } = useAccount()
  const { data: batches, isLoading: batchesLoading } = useBatches()

  // Build multicall contracts array for all batches
  const contracts = useMemo(() => {
    if (!address || !batches?.length) return []
    return batches.map(batch => ({
      address: VISION_ADDRESS as `0x${string}`,
      abi: VISION_ABI,
      functionName: 'getPosition' as const,
      args: [BigInt(batch.id), address] as const,
      chainId: activeChainId,
    }))
  }, [address, batches])

  const { data: positionsData, isLoading: positionsLoading } = useReadContracts({
    contracts,
    query: {
      enabled: contracts.length > 0 && VISION_ADDRESS !== '0x0000000000000000000000000000000000000000',
      refetchInterval: 15000,
    },
  })

  // Filter to batches where player has a position (stakePerTick > 0)
  const positions = useMemo((): PlayerBatchPosition[] => {
    if (!batches || !positionsData) return []

    const result: PlayerBatchPosition[] = []
    for (let i = 0; i < batches.length; i++) {
      const res = positionsData[i]
      if (res.status !== 'success' || !res.result) continue

      const pos = res.result as {
        bitmapHash: string
        stakePerTick: bigint
        startTick: bigint
        balance: bigint
        lastClaimedTick: bigint
        joinTimestamp: bigint
        totalDeposited: bigint
        totalClaimed: bigint
      }

      if (pos.stakePerTick === 0n) continue

      const pnl = pos.balance - pos.totalDeposited + pos.totalClaimed
      const pnlPercent = pos.totalDeposited > 0n
        ? Number((pnl * 10000n) / pos.totalDeposited) / 100
        : 0

      result.push({
        batchId: batches[i].id,
        batch: batches[i],
        balance: pos.balance,
        stakePerTick: pos.stakePerTick,
        totalDeposited: pos.totalDeposited,
        totalClaimed: pos.totalClaimed,
        lastClaimedTick: pos.lastClaimedTick,
        startTick: pos.startTick,
        joinTimestamp: pos.joinTimestamp,
        pnl,
        pnlPercent,
      })
    }
    return result
  }, [batches, positionsData])

  // Aggregate stats
  const aggregateStats = useMemo(() => {
    let totalBalance = 0n
    let totalDeposited = 0n
    let totalPnl = 0n

    for (const pos of positions) {
      totalBalance += pos.balance
      totalDeposited += pos.totalDeposited
      totalPnl += pos.pnl
    }

    return {
      totalBalance,
      totalDeposited,
      totalPnl,
      totalPnlPercent: totalDeposited > 0n
        ? Number((totalPnl * 10000n) / totalDeposited) / 100
        : 0,
      activeBatches: positions.length,
    }
  }, [positions])

  return {
    positions,
    stats: aggregateStats,
    isLoading: batchesLoading || positionsLoading,
  }
}
