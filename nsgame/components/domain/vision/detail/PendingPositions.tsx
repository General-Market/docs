'use client'

import { useMemo } from 'react'
import { formatUnits } from 'viem'
import { useAccount } from '@/lib/wallet-shim'
import { useTranslations } from 'next-intl'
import { usePlayerPositions } from '@/hooks/vision/usePlayerPositions'
import type { RoundInfo } from '@/hooks/vision/useRounds'
import { VISION_USDC_DECIMALS } from '@/lib/vision/constants'

interface PendingPositionsProps {
  rounds: RoundInfo[]
  activeBatchId?: number
}

export function PendingPositions({ rounds, activeBatchId }: PendingPositionsProps) {
  const t = useTranslations('vision')
  const { isConnected } = useAccount()

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

  const roundMap = new Map(rounds.map((r) => [r.batchId, r]))
  const totalAtStake = positions.reduce(
    (sum, p) => sum + parseFloat(formatUnits(p.totalDeposited, VISION_USDC_DECIMALS)),
    0,
  )

  return (
    <div className="mt-4">
      {/* Header with total */}
      <div className="flex items-baseline justify-between mb-2">
        <div className="flex items-center gap-2">
          <span className="relative flex h-2 w-2 shrink-0">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-color-warning opacity-50" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-color-warning" />
          </span>
          <span className="text-[10px] font-bold uppercase tracking-[0.08em] text-color-warning">
            Pending Results
          </span>
          <span className="text-[10px] font-mono text-text-muted">
            {t('pending_positions.positions_count', { count: positions.length })}
          </span>
        </div>
        <div className="flex items-baseline gap-1">
          <span className="text-[18px] font-black font-mono tabular-nums text-black tracking-tight">
            {totalAtStake.toFixed(2)}
          </span>
          <span className="text-[10px] font-bold text-text-muted">{t('pending_positions.usdc_pending')}</span>
        </div>
      </div>

      {/* Position rows */}
      <div className="flex flex-col gap-px bg-color-warning/10 border border-color-warning/20">
        {positions.map((pos) => {
          const round = roundMap.get(pos.batchId)
          const deposit = parseFloat(formatUnits(pos.totalDeposited, VISION_USDC_DECIMALS))
          return (
            <div
              key={pos.batchId}
              className="flex items-center gap-3 bg-white px-4 py-3"
            >
              {/* Batch ID, subdued */}
              <span className="text-caption font-mono font-bold text-text-muted tabular-nums w-16 shrink-0">
                #{pos.batchId}
              </span>

              {/* Deposit, the hero number */}
              <div className="flex items-baseline gap-1 flex-1 min-w-0">
                <span className="text-[20px] font-black font-mono tabular-nums text-black tracking-tight leading-none">
                  {deposit.toFixed(2)}
                </span>
                <span className="text-micro font-bold text-text-muted">USDC</span>
              </div>

              {/* Players + status */}
              <div className="flex items-center gap-3 shrink-0">
                {round && (
                  <span className="text-micro font-mono text-text-muted tabular-nums">
                    {round.playerCount} {t('pending_positions.players')}
                  </span>
                )}
                <span className="text-micro font-black font-mono text-color-warning uppercase tracking-wider">
                  {t('pending_positions.awaiting_results')}
                </span>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
