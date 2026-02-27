'use client'

import { useMemo } from 'react'
import { usePlayerBatches, type PlayerBatchPosition } from './usePlayerBatches'
import { useBatches } from './useBatches'

const POINTS_PER_TICK_PER_BATCH = 100
const USDC_DECIMALS = 6

export interface BatchPointsBreakdown {
  batchId: number
  sourceId: string
  myBalanceUsd: number
  batchTvlUsd: number
  myShare: number // 0..1
  pointsPerTick: number
  tickDurationSec: number
  pointsPerHour: number
  ticksElapsed: number
  estimatedTotalPoints: number
}

export interface VisionPointsResult {
  batches: BatchPointsBreakdown[]
  totalPointsPerTick: number
  totalPointsPerHour: number
  estimatedTotalPoints: number
  activeBatches: number
  isLoading: boolean
}

export function useVisionPoints(): VisionPointsResult {
  const { positions, isLoading: playerLoading } = usePlayerBatches()
  const { data: allBatches, isLoading: batchesLoading } = useBatches()

  const result = useMemo((): Omit<VisionPointsResult, 'isLoading'> => {
    if (!positions.length || !allBatches?.length) {
      return {
        batches: [],
        totalPointsPerTick: 0,
        totalPointsPerHour: 0,
        estimatedTotalPoints: 0,
        activeBatches: 0,
      }
    }

    const nowSec = Math.floor(Date.now() / 1000)
    const batchMap = new Map(allBatches.map(b => [b.id, b]))
    const breakdowns: BatchPointsBreakdown[] = []

    for (const pos of positions) {
      const batch = batchMap.get(pos.batchId)
      if (!batch) continue

      const myBalanceUsd = Number(pos.balance) / 10 ** USDC_DECIMALS
      // TVL from API: could be raw string (in USDC smallest unit) or formatted
      const tvlRaw = parseFloat(batch.tvl)
      // If TVL > 1e9, it's in raw units (6 decimals). Otherwise treat as formatted USD.
      const batchTvlUsd = tvlRaw > 1e9 ? tvlRaw / 10 ** USDC_DECIMALS : tvlRaw

      if (batchTvlUsd <= 0) continue

      const myShare = myBalanceUsd / batchTvlUsd
      const pointsPerTick = POINTS_PER_TICK_PER_BATCH * myShare
      const tickDurationSec = batch.tickDuration || 600 // default 10 min
      const ticksPerHour = 3600 / tickDurationSec
      const pointsPerHour = pointsPerTick * ticksPerHour

      const joinTs = Number(pos.joinTimestamp)
      const elapsed = Math.max(0, nowSec - joinTs)
      const ticksElapsed = Math.floor(elapsed / tickDurationSec)
      const estimatedTotalPoints = pointsPerTick * ticksElapsed

      breakdowns.push({
        batchId: pos.batchId,
        sourceId: batch.marketIds[0] ?? `batch-${pos.batchId}`,
        myBalanceUsd,
        batchTvlUsd,
        myShare,
        pointsPerTick,
        tickDurationSec,
        pointsPerHour,
        ticksElapsed,
        estimatedTotalPoints,
      })
    }

    // Sort by pointsPerHour descending
    breakdowns.sort((a, b) => b.pointsPerHour - a.pointsPerHour)

    return {
      batches: breakdowns,
      totalPointsPerTick: breakdowns.reduce((s, b) => s + b.pointsPerTick, 0),
      totalPointsPerHour: breakdowns.reduce((s, b) => s + b.pointsPerHour, 0),
      estimatedTotalPoints: breakdowns.reduce((s, b) => s + b.estimatedTotalPoints, 0),
      activeBatches: breakdowns.length,
    }
  }, [positions, allBatches])

  return {
    ...result,
    isLoading: playerLoading || batchesLoading,
  }
}
