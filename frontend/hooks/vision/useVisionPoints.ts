'use client'

import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useAccount } from 'wagmi'
import { usePlayerBatches, type PlayerBatchPosition } from './usePlayerBatches'
import { useBatches } from './useBatches'

const POINTS_PER_TICK_PER_BATCH = 100
const POINTS_PER_ROUND = 100
const USDC_DECIMALS = 18

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
  roundPoints: number
  roundsCompleted: number
  isLoading: boolean
}

interface PlayerRoundEntry {
  batchId: number
  deposited: string
  payout: string
  pnl: string
  correctCount: number
  totalMarkets: number
}

async function fetchPlayerRounds(address: string): Promise<{ rounds: PlayerRoundEntry[] }> {
  const res = await fetch(`/api/vision/player/${address}/rounds?limit=100`)
  if (!res.ok) return { rounds: [] }
  return res.json()
}

export function useVisionPoints(): VisionPointsResult {
  const { address } = useAccount()
  const { positions, isLoading: playerLoading } = usePlayerBatches()
  const { data: allBatches, isLoading: batchesLoading } = useBatches()

  // Fetch completed rounds for round-based points
  const { data: playerRoundsData, isLoading: roundsLoading } = useQuery({
    queryKey: ['vision-player-rounds', address],
    queryFn: () => fetchPlayerRounds(address!),
    enabled: !!address,
    refetchInterval: 30_000,
    staleTime: 15_000,
  })

  // Points from settled rounds: flat 100 per round participated
  const { roundPoints, roundsCompleted } = useMemo(() => {
    const rounds = playerRoundsData?.rounds
    if (!rounds?.length) return { roundPoints: 0, roundsCompleted: 0 }
    return {
      roundPoints: rounds.length * POINTS_PER_ROUND,
      roundsCompleted: rounds.length,
    }
  }, [playerRoundsData])

  const result = useMemo((): Omit<VisionPointsResult, 'isLoading'> => {
    const empty = {
      batches: [] as BatchPointsBreakdown[],
      totalPointsPerTick: 0,
      totalPointsPerHour: 0,
      estimatedTotalPoints: roundPoints,
      activeBatches: 0,
      roundPoints,
      roundsCompleted,
    }

    if (!positions.length || !allBatches?.length) {
      return empty
    }

    const nowSec = Math.floor(Date.now() / 1000)
    const batchMap = new Map(allBatches.map(b => [b.id, b]))
    const breakdowns: BatchPointsBreakdown[] = []

    for (const pos of positions) {
      const batch = batchMap.get(pos.batchId)
      if (!batch) continue

      const myBalanceUsd = Number(pos.balance) / 10 ** USDC_DECIMALS
      // TVL from API: raw string in L3 USDC smallest units (18 decimals)
      const tvlRaw = parseFloat(batch.tvl)
      const batchTvlUsd = tvlRaw / 10 ** USDC_DECIMALS

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
        sourceId: batch.sourceId || `batch-${pos.batchId}`,
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

    const continuousBatchPoints = breakdowns.reduce((s, b) => s + b.estimatedTotalPoints, 0)

    return {
      batches: breakdowns,
      totalPointsPerTick: breakdowns.reduce((s, b) => s + b.pointsPerTick, 0),
      totalPointsPerHour: breakdowns.reduce((s, b) => s + b.pointsPerHour, 0),
      estimatedTotalPoints: continuousBatchPoints + roundPoints,
      activeBatches: breakdowns.length,
      roundPoints,
      roundsCompleted,
    }
  }, [positions, allBatches, roundPoints, roundsCompleted])

  return {
    ...result,
    isLoading: playerLoading || batchesLoading || roundsLoading,
  }
}
