'use client'

import { useState, useEffect, useCallback } from 'react'
import { useTranslations } from 'next-intl'
import { useAccount } from 'wagmi'
import { formatUnits } from 'viem'
import { useMorphoPosition } from '@/hooks/useMorphoPosition'
import { DepositCollateral } from '@/components/lending/DepositCollateral'
import { BorrowUsdc } from '@/components/lending/BorrowUsdc'
import { RepayDebt } from '@/components/lending/RepayDebt'
import { WithdrawCollateral } from '@/components/lending/WithdrawCollateral'
import { LendingHistory } from '@/components/lending/LendingHistory'
import { ErrorBoundary } from '@/components/ui/ErrorBoundary'
import {
  SpringModal,
  SpringBackdrop,
  SpringTabs,
  SpringTab,
  glass,
  ModalClose,
} from '@/components/ui/spring'
import type { MorphoMarketEntry } from '@/lib/contracts/morpho-markets-registry'

type TabId = 'supply' | 'borrow' | 'repay' | 'withdraw'

interface MarketActionModalProps {
  market: MorphoMarketEntry
  itpInfo: { name: string; symbol: string; itpId: string; settlementAddress: string }
  isOpen: boolean
  onClose: () => void
  initialTab?: TabId
}

const LendingErrorFallback = (
  <div className={`${glass.error} p-6 text-center`}>
    <h3 className="text-color-down font-semibold mb-2">Something went wrong</h3>
    <p className="text-text-muted text-sm">Please close and reopen the modal.</p>
  </div>
)

export function MarketActionModal({
  market,
  itpInfo,
  isOpen,
  onClose,
  initialTab = 'borrow',
}: MarketActionModalProps) {
  const t = useTranslations('lending')
  const { isConnected } = useAccount()
  const [activeTab, setActiveTab] = useState<TabId>(initialTab)

  const { position, isLoading, refetch: refetchPosition } = useMorphoPosition(market)
  const hasPosition = position && (position.collateralAmount > 0n || position.debtAmount > 0n)

  // Sync tab when initialTab prop changes (e.g. different row clicked)
  useEffect(() => {
    setActiveTab(initialTab)
  }, [initialTab])

  // Listen for lending-refresh events to refetch position
  useEffect(() => {
    const handler = () => refetchPosition()
    window.addEventListener('lending-refresh', handler)
    return () => window.removeEventListener('lending-refresh', handler)
  }, [refetchPosition])

  const handleActionSuccess = useCallback(() => {
    refetchPosition()
  }, [refetchPosition])

  if (!isOpen || !market) return null

  // Position summary values
  const collateral = position ? formatUnits(position.collateralAmount, 18) : null
  const debt = position ? formatUnits(position.debtAmount, 18) : null
  const healthFactor = position?.healthFactor ?? Infinity

  const healthColor =
    healthFactor >= 1.5
      ? 'text-color-up'
      : healthFactor >= 1.0
        ? 'text-color-warning'
        : 'text-color-down'

  const tabs: { id: TabId; label: string }[] = [
    { id: 'supply', label: t('market_modal.tab_supply') },
    { id: 'borrow', label: t('lend_modal.tab_borrow') },
    { id: 'repay', label: t('lend_modal.tab_repay') },
    { id: 'withdraw', label: t('market_modal.tab_withdraw') },
  ]

  return (
    <SpringBackdrop className={glass.backdrop} onClick={onClose}>
      <SpringModal
        className={`${glass.modal} max-w-lg w-full`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-6">
          {/* Header */}
          <div className="flex justify-between items-start mb-1">
            <div>
              <h2 className="text-lg font-semibold text-text-primary">
                {t('lend_modal.title', { name: itpInfo.name || 'ITP' })}
              </h2>
              {itpInfo.symbol && (
                <p className="text-text-muted text-sm font-mono">${itpInfo.symbol}</p>
              )}
            </div>
            <ModalClose onClick={onClose} />
          </div>

          {!isConnected ? (
            <div className={`${glass.section} p-8 text-center mt-4`}>
              <p className="text-text-secondary">{t('lend_modal.connect_wallet')}</p>
            </div>
          ) : (
            <ErrorBoundary fallback={LendingErrorFallback}>
              <div className="space-y-4 mt-4">
                {/* Position Summary, compact rows */}
                {hasPosition && !isLoading && (
                  <div className={`${glass.section} p-4 space-y-2`}>
                    <div className="flex justify-between items-center">
                      <span className="text-xs text-text-muted uppercase tracking-wide">
                        {t('position_card.collateral')}
                      </span>
                      <span className="text-sm text-text-primary font-mono tabular-nums">
                        {parseFloat(collateral!).toFixed(4)} ITP
                      </span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-xs text-text-muted uppercase tracking-wide">
                        {t('position_card.debt')}
                      </span>
                      <span className="text-sm text-text-primary font-mono tabular-nums">
                        {parseFloat(debt!).toFixed(2)} USDC
                      </span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-xs text-text-muted uppercase tracking-wide">
                        {t('position_card.health_label', { value: '' })}
                      </span>
                      <span className={`text-sm font-mono tabular-nums font-bold ${healthColor}`}>
                        {healthFactor === Infinity ? '∞' : healthFactor.toFixed(2)}
                      </span>
                    </div>
                  </div>
                )}

                {/* Tabs */}
                <SpringTabs className="flex border-b border-border-light">
                  {tabs.map((tab) => (
                    <SpringTab
                      key={tab.id}
                      isActive={activeTab === tab.id}
                      onClick={() => setActiveTab(tab.id)}
                      className="pb-2 px-3 text-sm transition-colors"
                      layoutId="market-action-tab"
                    >
                      {tab.label}
                    </SpringTab>
                  ))}
                </SpringTabs>

                {/* Tab content */}
                <div>
                  {activeTab === 'supply' && (
                    <DepositCollateral
                      market={market}
                      itpId={itpInfo.itpId}
                      onSuccess={handleActionSuccess}
                    />
                  )}
                  {activeTab === 'borrow' && (
                    <BorrowUsdc
                      market={market}
                      onSuccess={handleActionSuccess}
                    />
                  )}
                  {activeTab === 'repay' && (
                    <RepayDebt
                      market={market}
                      itpId={itpInfo.itpId}
                      onSuccess={handleActionSuccess}
                    />
                  )}
                  {activeTab === 'withdraw' && (
                    <WithdrawCollateral
                      market={market}
                      onSuccess={handleActionSuccess}
                    />
                  )}
                </div>

                {/* History */}
                <LendingHistory market={market} />
              </div>
            </ErrorBoundary>
          )}
        </div>
      </SpringModal>
    </SpringBackdrop>
  )
}
