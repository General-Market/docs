'use client'

import { useTranslations } from 'next-intl'
import { useAccount } from 'wagmi'
import { formatUnits } from 'viem'
import { useItpCostBasis } from '@/hooks/useItpCostBasis'
import { useItpFees } from '@/hooks/useItpFees'
import { useItpNav } from '@/hooks/useItpNav'
import { useUserItpShares } from '@/hooks/useUserItpShares'

interface CostBasisCardProps {
  itpId: string
}

export function CostBasisCard({ itpId }: CostBasisCardProps) {
  const t = useTranslations('portfolio')
  const { address } = useAccount()
  const { costBasis, isLoading: isCostLoading } = useItpCostBasis(itpId, address ?? null)
  const { fees } = useItpFees(itpId)
  const { navPerShare, navPerShareBn } = useItpNav(itpId)
  const { shares } = useUserItpShares(
    itpId as `0x${string}`,
    address as `0x${string}` | undefined
  )

  if (!address || shares === 0n && !costBasis) return null

  const currentValue = shares > 0n && navPerShareBn > 0n
    ? (shares * navPerShareBn) / BigInt(1e18)
    : 0n

  const avgCost = costBasis?.avgCostPerShare ?? 0n
  const totalCost = costBasis?.totalCost ?? 0n

  // Unrealized P&L: current value - remaining cost basis
  const remainingShares = (costBasis?.totalSharesBought ?? 0n) - (costBasis?.totalSharesSold ?? 0n)
  const remainingCostBasis = remainingShares > 0n && avgCost > 0n
    ? (avgCost * remainingShares) / BigInt(1e18)
    : 0n
  const unrealizedPnL = currentValue - remainingCostBasis

  const unrealizedPnLPct = remainingCostBasis > 0n
    ? Number(unrealizedPnL) * 100 / Number(remainingCostBasis)
    : 0

  const realizedPnL = costBasis?.realizedPnL ?? 0n

  const fmt = (val: bigint) => parseFloat(formatUnits(val, 18)).toFixed(6)
  const fmtUsd = (val: bigint) => `$${fmt(val)}`

  return (
    <div className="bg-card rounded-xl shadow-card border border-border-light p-4 space-y-3">
      <h4 className="text-xs font-medium uppercase tracking-wider text-text-muted">{t('cost_basis.title')}</h4>

      <div className="space-y-1 text-xs font-mono">
        <div className="flex justify-between">
          <span className="text-text-muted">{t('cost_basis.shares')}</span>
          <span className="text-text-primary tabular-nums">{parseFloat(formatUnits(shares, 18)).toFixed(4)}</span>
        </div>
        {avgCost > 0n && (
          <div className="flex justify-between">
            <span className="text-text-muted">{t('cost_basis.avg_cost')}</span>
            <span className="text-text-primary tabular-nums">{fmtUsd(avgCost)}/share</span>
          </div>
        )}
        {totalCost > 0n && (
          <div className="flex justify-between">
            <span className="text-text-muted">{t('cost_basis.total_cost')}</span>
            <span className="text-text-primary tabular-nums">{fmtUsd(totalCost)}</span>
          </div>
        )}
        {currentValue > 0n && (
          <div className="flex justify-between">
            <span className="text-text-muted">{t('cost_basis.current_value')}</span>
            <span className="text-text-primary tabular-nums">{fmtUsd(currentValue)}</span>
          </div>
        )}
        {remainingCostBasis > 0n && (
          <div className="flex justify-between">
            <span className="text-text-muted">{t('cost_basis.unrealized_pnl')}</span>
            <span className={unrealizedPnL >= 0n ? 'text-color-up' : 'text-color-down'}>
              {unrealizedPnL >= 0n ? '+' : ''}{fmtUsd(unrealizedPnL)} ({unrealizedPnLPct >= 0 ? '+' : ''}{unrealizedPnLPct.toFixed(1)}%)
            </span>
          </div>
        )}
        {realizedPnL !== 0n && (
          <div className="flex justify-between">
            <span className="text-text-muted">{t('cost_basis.realized_pnl')}</span>
            <span className={realizedPnL >= 0n ? 'text-color-up' : 'text-color-down'}>
              {realizedPnL >= 0n ? '+' : ''}{fmtUsd(realizedPnL)}
            </span>
          </div>
        )}
      </div>

      {fees && (
        <>
          <div className="border-t border-border-light pt-2">
            <p className="text-xs font-medium uppercase tracking-wider text-text-muted mb-1">{t('cost_basis.fees_title')}</p>
            <div className="space-y-1 text-xs font-mono">
              {fees.tradingFees > 0n && (
                <div className="flex justify-between">
                  <span className="text-text-muted">{t('cost_basis.fee_trading')}</span>
                  <span className="text-text-secondary tabular-nums">{fmtUsd(fees.tradingFees)}</span>
                </div>
              )}
              {fees.managementFees > 0n && (
                <div className="flex justify-between">
                  <span className="text-text-muted">{t('cost_basis.fee_management')}</span>
                  <span className="text-text-secondary tabular-nums">{fmtUsd(fees.managementFees)}</span>
                </div>
              )}
              {fees.bridgeFees > 0n && (
                <div className="flex justify-between">
                  <span className="text-text-muted">{t('cost_basis.fee_bridge')}</span>
                  <span className="text-text-secondary tabular-nums">{fmtUsd(fees.bridgeFees)}</span>
                </div>
              )}
              {fees.gasFees > 0n && (
                <div className="flex justify-between">
                  <span className="text-text-muted">{t('cost_basis.fee_gas')}</span>
                  <span className="text-text-secondary tabular-nums">{fmtUsd(fees.gasFees)}</span>
                </div>
              )}
              <div className="flex justify-between pt-1 border-t border-border-light">
                <span className="text-text-muted">{t('cost_basis.fee_total')}</span>
                <span className="text-text-primary tabular-nums">{fmtUsd(fees.totalFees)}</span>
              </div>
            </div>
          </div>
        </>
      )}

      {isCostLoading && (
        <p className="text-xs text-text-muted text-center">{t('cost_basis.loading')}</p>
      )}
    </div>
  )
}
