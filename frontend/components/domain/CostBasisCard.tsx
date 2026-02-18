'use client'

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
    <div className="bg-terminal-dark border border-white/10 rounded-lg p-4 space-y-3">
      <h4 className="text-sm font-bold text-white">Your Position</h4>

      <div className="space-y-1 text-xs font-mono">
        <div className="flex justify-between">
          <span className="text-white/50">Shares</span>
          <span className="text-white">{parseFloat(formatUnits(shares, 18)).toFixed(4)}</span>
        </div>
        {avgCost > 0n && (
          <div className="flex justify-between">
            <span className="text-white/50">Avg Cost</span>
            <span className="text-white">{fmtUsd(avgCost)}/share</span>
          </div>
        )}
        {totalCost > 0n && (
          <div className="flex justify-between">
            <span className="text-white/50">Total Cost</span>
            <span className="text-white">{fmtUsd(totalCost)}</span>
          </div>
        )}
        {currentValue > 0n && (
          <div className="flex justify-between">
            <span className="text-white/50">Current Value</span>
            <span className="text-white">{fmtUsd(currentValue)}</span>
          </div>
        )}
        {remainingCostBasis > 0n && (
          <div className="flex justify-between">
            <span className="text-white/50">Unrealized P&L</span>
            <span className={unrealizedPnL >= 0n ? 'text-green-400' : 'text-red-400'}>
              {unrealizedPnL >= 0n ? '+' : ''}{fmtUsd(unrealizedPnL)} ({unrealizedPnLPct >= 0 ? '+' : ''}{unrealizedPnLPct.toFixed(1)}%)
            </span>
          </div>
        )}
        {realizedPnL !== 0n && (
          <div className="flex justify-between">
            <span className="text-white/50">Realized P&L</span>
            <span className={realizedPnL >= 0n ? 'text-green-400' : 'text-red-400'}>
              {realizedPnL >= 0n ? '+' : ''}{fmtUsd(realizedPnL)}
            </span>
          </div>
        )}
      </div>

      {fees && (
        <>
          <div className="border-t border-white/10 pt-2">
            <p className="text-xs font-bold text-white/70 mb-1">Fees Paid</p>
            <div className="space-y-1 text-xs font-mono">
              {fees.tradingFees > 0n && (
                <div className="flex justify-between">
                  <span className="text-white/50">Trading</span>
                  <span className="text-white/70">{fmtUsd(fees.tradingFees)}</span>
                </div>
              )}
              {fees.managementFees > 0n && (
                <div className="flex justify-between">
                  <span className="text-white/50">Management</span>
                  <span className="text-white/70">{fmtUsd(fees.managementFees)}</span>
                </div>
              )}
              {fees.bridgeFees > 0n && (
                <div className="flex justify-between">
                  <span className="text-white/50">Bridge</span>
                  <span className="text-white/70">{fmtUsd(fees.bridgeFees)}</span>
                </div>
              )}
              {fees.gasFees > 0n && (
                <div className="flex justify-between">
                  <span className="text-white/50">Gas</span>
                  <span className="text-white/70">{fmtUsd(fees.gasFees)}</span>
                </div>
              )}
              <div className="flex justify-between pt-1 border-t border-white/5">
                <span className="text-white/50">Total Fees</span>
                <span className="text-white">{fmtUsd(fees.totalFees)}</span>
              </div>
            </div>
          </div>
        </>
      )}

      {isCostLoading && (
        <p className="text-xs text-white/30 text-center">Loading cost data...</p>
      )}
    </div>
  )
}
