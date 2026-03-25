'use client'

import { useMemo } from 'react'
import { formatUnits } from 'viem'
import { useAccount } from 'wagmi'
import { usePlayerPositions } from '@/hooks/vision/usePlayerPositions'
import type { RoundInfo } from '@/hooks/vision/useRounds'
import { VISION_USDC_DECIMALS } from '@/lib/vision/constants'

interface PendingPositionsProps {
  rounds: RoundInfo[]
  /** The active (betting) batch ID — excluded from the pending list */
  activeBatchId?: number
}

/**
 * Shows all unsettled positions the connected wallet holds for this source.
 * Only displays settling batches (not the active betting batch, which is
 * handled by BatchEntryPanel).
 */
export function PendingPositions({ rounds, activeBatchId }: PendingPositionsProps) {
  const { isConnected } = useAccount()

  // All settling batch IDs for this source (exclude the active betting batch)
  const settlingBatchIds = useMemo(
    () =>
      rounds
        .filter((r) => r.status === 'settling' && r.batchId !== activeBatchId)
        .map((r) => r.batchId),
    [rounds, activeBatchId],
  )

  const { positions, isLoading } = usePlayerPositions(settlingBatchIds)

  if (!isConnected || settlingBatchIds.length === 0) return null
  if (isLoading) return null
  if (positions.length === 0) return null

  // Build round lookup for extra info
  const roundMap = new Map(rounds.map((r) => [r.batchId, r]))

  return (
    <div className="mt-3">
      <div className="text-[10px] font-semibold uppercase tracking-[0.08em] text-text-muted mb-1.5">
        Pending Results
      </div>
      <div className="flex flex-col gap-1">
        {positions.map((pos) => {
          const round = roundMap.get(pos.batchId)
          const deposit = parseFloat(formatUnits(pos.deposit, VISION_USDC_DECIMALS))
          return (
            <div
              key={pos.batchId}
              className="flex items-center gap-4 bg-surface-warning/40 border-l-[3px] border-l-color-warning border-t border-r border-b border-t-border-light border-r-border-light border-b-border-light px-4 py-2.5"
            >
              {/* Status indicator */}
              <div className="flex items-center gap-1.5 shrink-0">
                <span className="relative flex h-1.5 w-1.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-color-warning opacity-50" />
                  <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-color-warning" />
                </span>
                <span className="text-[10px] font-bold uppercase tracking-[0.06em] text-color-warning">
                  Settling
                </span>
              </div>

              {/* Batch ID */}
              <span className="text-caption font-mono font-bold text-text-secondary">
                #{pos.batchId}
              </span>

              {/* Deposit */}
              <div className="flex items-baseline gap-1">
                <span className="text-body-sm font-black font-mono tabular-nums text-black">
                  {deposit.toFixed(2)}
                </span>
                <span className="text-micro text-text-muted">USDC</span>
              </div>

              {/* Players */}
              {round && (
                <span className="text-micro text-text-muted ml-auto">
                  {round.playerCount} players
                </span>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
