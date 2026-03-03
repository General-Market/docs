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
      <div className="flex items-center gap-2">
        <span className="text-[13px] font-bold font-mono tabular-nums text-black">
          {fmtBal(total)}
          <span className="text-text-muted font-medium ml-1">USDC</span>
        </span>
        {hasBalance && !ptsLoading && activeBatches > 0 && (
          <Link href="/points" className="text-[11px] font-bold font-mono text-color-up hover:opacity-80 transition-opacity">
            {formatPts(estimatedTotalPoints)} pts
          </Link>
        )}
        <button
          onClick={() => setShowDepositModal(true)}
          className="px-2.5 py-1 bg-color-up text-white text-[11px] font-bold rounded hover:opacity-90 transition-opacity"
        >
          DEPOSIT
        </button>
        {hasBalance && (
          <button
            onClick={() => setShowWithdrawModal(true)}
            className="px-2.5 py-1 bg-muted text-text-secondary text-[11px] font-bold rounded border border-border-light hover:bg-surface transition-colors"
          >
            WITHDRAW
          </button>
        )}
      </div>
      {showDepositModal && <BalanceDepositModal onClose={() => setShowDepositModal(false)} />}
      {showWithdrawModal && <BalanceWithdrawModal onClose={() => setShowWithdrawModal(false)} />}
    </>
  )
}
