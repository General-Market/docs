'use client'

import { useState } from 'react'
import { useAccount } from 'wagmi'
import { getMorphoMarketForItp } from '@/lib/contracts/morpho-markets-registry'
import { ErrorBoundary } from '@/components/ui/ErrorBoundary'
import { DepositCollateral } from '@/components/lending/DepositCollateral'
import { BorrowUsdc } from '@/components/lending/BorrowUsdc'
import { RepayDebt } from '@/components/lending/RepayDebt'
import { WithdrawCollateral } from '@/components/lending/WithdrawCollateral'
import { PositionCard } from '@/components/lending/PositionCard'
import { LendingHistory } from '@/components/lending/LendingHistory'
import { useMorphoPosition } from '@/hooks/useMorphoPosition'
import { useLendingQuote } from '@/hooks/useLendingQuote'
import type { CrisisLevel } from '@/lib/types/lending-quote'

interface ItpInfo {
  id: string
  itpId?: string
  nonce?: number
  admin: string
  name: string
  symbol: string
  createdAt: number
  source: 'index' | 'bridge'
  completed: boolean
  orbitItpId?: string
  arbAddress?: string
}

interface LendItpModalProps {
  itpInfo: ItpInfo
  isOpen: boolean
  onClose: () => void
}

type Tab = 'borrow' | 'repay'

const LendingErrorFallback = (
  <div className="bg-surface-down border border-color-down/30 rounded-xl p-6 text-center">
    <h3 className="text-color-down font-semibold mb-2">Something went wrong</h3>
    <p className="text-text-muted text-sm">Please close and reopen the modal.</p>
  </div>
)

export function LendItpModal({ itpInfo, isOpen, onClose }: LendItpModalProps) {
  const { isConnected } = useAccount()
  const [activeTab, setActiveTab] = useState<Tab>('borrow')

  const market = getMorphoMarketForItp(itpInfo.arbAddress)

  const { position, refetch: refetchPosition } = useMorphoPosition(market ?? undefined)
  const hasPosition = position && (position.collateralAmount > 0n || position.debtAmount > 0n)

  // Fetch crisis level from quote API (lightweight probe with minimal borrow)
  const { quote: crisisProbe } = useLendingQuote({
    itpAddress: itpInfo.arbAddress,
    collateralAmount: position?.collateralAmount?.toString(),
    borrowAmount: '1', // minimal amount just to get crisis level
    enabled: !!hasPosition && !!itpInfo.arbAddress,
  })
  const crisisLevel: CrisisLevel | undefined = crisisProbe
    ? (crisisProbe as any).crisisLevel as CrisisLevel
    : undefined

  if (!isOpen || !market) return null

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div
        className="bg-card border border-border-light rounded-xl shadow-modal max-w-lg w-full max-h-[90vh] overflow-y-auto"
        onClick={e => e.stopPropagation()}
      >
        <div className="p-6">
          {/* Header */}
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-lg font-semibold text-text-primary">Borrow against {itpInfo.name || 'ITP'}</h2>
            <button onClick={onClose} className="text-text-muted hover:text-text-primary text-2xl leading-none">&times;</button>
          </div>
          {itpInfo.symbol && <p className="text-text-secondary mb-1 font-mono">${itpInfo.symbol}</p>}
          <p className="text-xs text-text-muted mb-6">
            Borrow USDC against your {itpInfo.symbol || 'ITP'} collateral via Morpho
          </p>

          {!isConnected ? (
            <div className="bg-muted border border-border-light rounded-xl p-8 text-center">
              <p className="text-text-secondary">Connect your wallet to access lending</p>
            </div>
          ) : (
            <ErrorBoundary fallback={LendingErrorFallback}>
              <div className="space-y-4">
                {/* Tabs */}
                <div className="flex gap-4 border-b border-border-light">
                  <button
                    onClick={() => setActiveTab('borrow')}
                    className={`pb-3 px-4 text-sm transition-colors border-b-2 ${
                      activeTab === 'borrow'
                        ? 'text-text-primary border-zinc-900'
                        : 'text-text-secondary border-transparent hover:text-text-primary'
                    }`}
                  >
                    Borrow
                  </button>
                  <button
                    onClick={() => setActiveTab('repay')}
                    className={`pb-3 px-4 text-sm transition-colors border-b-2 ${
                      activeTab === 'repay'
                        ? 'text-text-primary border-zinc-900'
                        : 'text-text-secondary border-transparent hover:text-text-primary'
                    }`}
                  >
                    Repay
                  </button>
                </div>

                {/* Position summary */}
                {hasPosition && <PositionCard market={market} crisisLevel={crisisLevel} />}

                {/* Tab content */}
                {activeTab === 'borrow' ? (
                  <div className="space-y-4">
                    <DepositCollateral market={market} itpId={itpInfo.orbitItpId || itpInfo.itpId} onSuccess={refetchPosition} />
                    {position && position.collateralAmount > 0n && (
                      <BorrowUsdc market={market} onSuccess={refetchPosition} />
                    )}
                  </div>
                ) : (
                  <div className="space-y-4">
                    {position && position.debtAmount > 0n && (
                      <RepayDebt market={market} itpId={itpInfo.orbitItpId || itpInfo.itpId} onSuccess={refetchPosition} />
                    )}
                    {position && position.collateralAmount > 0n && (
                      <WithdrawCollateral market={market} onSuccess={refetchPosition} />
                    )}
                    {(!position || (position.debtAmount === 0n && position.collateralAmount === 0n)) && (
                      <div className="bg-muted border border-border-light rounded-xl p-8 text-center">
                        <p className="text-text-muted">No active position to repay or withdraw</p>
                        <p className="text-text-muted text-sm mt-2">Switch to the Borrow tab to open a position</p>
                      </div>
                    )}
                  </div>
                )}

                {/* Transaction History */}
                <LendingHistory market={market} />
              </div>
            </ErrorBoundary>
          )}
        </div>
      </div>
    </div>
  )
}
