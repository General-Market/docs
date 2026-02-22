'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { useAccount } from 'wagmi'
import { formatUnits } from 'viem'
import { usePlayerBatches, type PlayerBatchPosition } from '@/hooks/p2pool/usePlayerBatches'
import { useBatchMetadata } from '@/hooks/p2pool/useBatchMetadata'

function fmtUsdc(value: bigint, decimals = 6): string {
  if (value === 0n) return '0.00'
  return parseFloat(formatUnits(value, decimals)).toFixed(2)
}

function fmtPnl(value: bigint, decimals = 6): string {
  const num = parseFloat(formatUnits(value, decimals))
  return `${num >= 0 ? '+' : ''}${num.toFixed(2)}`
}

function fmtPct(value: number): string {
  return `${value >= 0 ? '+' : ''}${value.toFixed(1)}%`
}

function PositionRow({
  pos,
  onSelect,
}: {
  pos: PlayerBatchPosition
  onSelect: (batchId: number) => void
}) {
  const { metadata } = useBatchMetadata(pos.batchId)
  const name = metadata?.name || `Batch #${pos.batchId}`
  const profitable = pos.pnl >= 0n

  return (
    <button
      onClick={() => onSelect(pos.batchId)}
      className="w-full grid grid-cols-[auto_1fr_auto_auto] items-center gap-3 px-4 py-3
                 border-b border-border-light last:border-b-0 hover:bg-card-hover transition-colors text-left"
    >
      {/* PnL color bar */}
      <div className={`w-1 h-8 rounded-full ${profitable ? 'bg-color-up' : 'bg-color-down'}`} />

      {/* Batch info */}
      <div className="min-w-0">
        <p className="text-sm font-bold text-text-primary truncate">{name}</p>
        <p className="text-[10px] text-text-muted font-mono">
          {pos.batch.marketCount || pos.batch.marketIds.length} mkts
          {' \u00B7 '}
          {pos.batch.tickDuration / 60}min
          {' \u00B7 '}
          {fmtUsdc(pos.stakePerTick)}/tick
        </p>
      </div>

      {/* Balance + PnL */}
      <div className="text-right">
        <p className="text-sm font-mono font-bold text-text-primary tabular-nums">
          ${fmtUsdc(pos.balance)}
        </p>
        <p className={`text-[10px] font-mono tabular-nums ${profitable ? 'text-color-up' : 'text-color-down'}`}>
          {fmtPnl(pos.pnl)} ({fmtPct(pos.pnlPercent)})
        </p>
      </div>

      {/* Navigate indicator */}
      <span className="text-text-muted text-sm">{'\u203A'}</span>
    </button>
  )
}

interface MyPositionsProps {
  onSelectBatch: (batchId: number) => void
}

/**
 * Wallet position overview panel.
 * Shows aggregate PnL across all batches and per-batch rows.
 * Displayed at the top of /vision when wallet is connected with positions.
 */
export function MyPositions({ onSelectBatch }: MyPositionsProps) {
  const t = useTranslations('p2pool')
  const { isConnected } = useAccount()
  const { positions, stats, isLoading } = usePlayerBatches()
  const [collapsed, setCollapsed] = useState(false)

  // Don't render if not connected or no positions (and not loading)
  if (!isConnected) return null
  if (!isLoading && positions.length === 0) return null

  const totalProfitable = stats.totalPnl >= 0n

  return (
    <div className="mb-6">
      {/* Header bar */}
      <button
        onClick={() => setCollapsed(!collapsed)}
        className="w-full flex items-center justify-between px-1 mb-2"
      >
        <div className="flex items-center gap-2">
          <span className={`text-[10px] transition-transform duration-150 ${collapsed ? '' : 'rotate-90'}`}>
            {'\u25B6'}
          </span>
          <div>
            <p className="text-[11px] font-semibold tracking-[0.12em] uppercase text-text-muted">
              {t('my_positions.title')}
            </p>
            {!isLoading && positions.length > 0 && (
              <p className="text-xs text-text-secondary font-mono">
                {stats.activeBatches} batch{stats.activeBatches !== 1 ? 'es' : ''}
                {' \u00B7 '}${fmtUsdc(stats.totalBalance)} balance
              </p>
            )}
          </div>
        </div>

        {!isLoading && positions.length > 0 && (
          <span className={`text-sm font-bold font-mono tabular-nums ${
            totalProfitable ? 'text-color-up' : 'text-color-down'
          }`}>
            {fmtPnl(stats.totalPnl)} ({fmtPct(stats.totalPnlPercent)})
          </span>
        )}
      </button>

      {/* Position list */}
      {!collapsed && (
        <div className="bg-card border border-border-light rounded-card overflow-hidden">
          {isLoading ? (
            <div className="py-6 flex items-center justify-center">
              <div className="w-5 h-5 border-2 border-border-medium border-t-terminal rounded-full animate-spin" />
            </div>
          ) : (
            positions.map(pos => (
              <PositionRow key={pos.batchId} pos={pos} onSelect={onSelectBatch} />
            ))
          )}
        </div>
      )}
    </div>
  )
}
