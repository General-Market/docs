'use client'

import { useState } from 'react'
import { useAccount } from 'wagmi'
import { formatUnits } from 'viem'
import { useVisionBalance } from '@/hooks/vision/useVisionBalance'
import { useVisionPoints } from '@/hooks/vision/useVisionPoints'
import { VISION_USDC_DECIMALS } from '@/lib/vision/constants'
import { Link } from '@/i18n/routing'
import { BalanceDepositModal } from './BalanceDepositModal'
import { BalanceWithdrawModal } from './BalanceWithdrawModal'

function formatPts(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`
  if (n >= 1) return Math.floor(n).toLocaleString()
  return n.toFixed(1)
}

export function VisionBalanceBar() {
  const { isConnected } = useAccount()
  const { realBalance, virtualBalance, total, isLoading } = useVisionBalance()
  const { totalPointsPerHour, estimatedTotalPoints, activeBatches, isLoading: ptsLoading } = useVisionPoints()
  const [showDepositModal, setShowDepositModal] = useState(false)
  const [showWithdrawModal, setShowWithdrawModal] = useState(false)

  const fmtBal = (v: bigint) => parseFloat(formatUnits(v, VISION_USDC_DECIMALS)).toFixed(2)

  if (!isConnected || isLoading) return null

  const hasBalance = total > 0n

  return (
    <>
      <div className="mb-6 flex items-center justify-between bg-card border border-border-light rounded-card px-5 py-3">
        <div className="flex items-center gap-6">
          <div>
            <p className="text-sm font-bold text-text-primary">
              Balance: {fmtBal(total)} USDC
            </p>
            {hasBalance && (
              <p className="text-[10px] text-text-muted font-mono">
                L3: {fmtBal(realBalance)}  &middot;  Arb-backed: {fmtBal(virtualBalance)}
              </p>
            )}
          </div>
          {hasBalance && !ptsLoading && activeBatches > 0 && (
            <Link href="/points" className="flex items-center gap-3 pl-6 border-l border-border-light hover:opacity-80 transition-opacity">
              <div>
                <p className="text-sm font-bold text-text-primary font-mono tabular-nums">
                  {formatPts(estimatedTotalPoints)} pts
                </p>
                <p className="text-[10px] text-color-up font-bold font-mono">
                  +{formatPts(totalPointsPerHour)}/hr &middot; {activeBatches} batch{activeBatches !== 1 ? 'es' : ''}
                </p>
              </div>
            </Link>
          )}
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setShowDepositModal(true)}
            className="px-3 py-1.5 bg-color-up text-white text-xs font-bold rounded-card hover:opacity-90 transition-opacity"
          >
            DEPOSIT
          </button>
          {hasBalance && (
            <button
              onClick={() => setShowWithdrawModal(true)}
              className="px-3 py-1.5 bg-muted text-text-secondary text-xs font-bold rounded-card border border-border-light hover:bg-surface transition-colors"
            >
              WITHDRAW
            </button>
          )}
        </div>
      </div>
      {showDepositModal && <BalanceDepositModal onClose={() => setShowDepositModal(false)} />}
      {showWithdrawModal && <BalanceWithdrawModal onClose={() => setShowWithdrawModal(false)} />}
    </>
  )
}
