'use client'

import { useState, useEffect, useMemo } from 'react'
import { useTranslations } from 'next-intl'
import { formatUnits } from 'viem'
import { DepositCollateral } from './DepositCollateral'
import { BorrowUsdc } from './BorrowUsdc'
import { RepayDebt } from './RepayDebt'
import { WithdrawCollateral } from './WithdrawCollateral'
import type { MorphoMarketEntry } from '@/lib/contracts/morpho-markets-registry'
import type { UserPosition } from '@/lib/types/morpho'

type TabId = 'supply' | 'withdraw' | 'borrow' | 'repay'

export interface SelectedMarket {
  name: string
  symbol: string
  itpId: string
  collateralToken: string
  borrowApy: number
  lltv: number
  available: number
  market: MorphoMarketEntry
}

interface MarketActionPanelProps {
  selectedMarket: SelectedMarket | null
  position: UserPosition | null
  positionLoading: boolean
  onSuccess: () => void
}

/**
 * Right-column action panel for the two-column lending layout.
 * Receives everything from the parent — fetches nothing itself.
 */
export function MarketActionPanel({
  selectedMarket,
  position,
  positionLoading,
  onSuccess,
}: MarketActionPanelProps) {
  const t = useTranslations('lending')
  const [activeTab, setActiveTab] = useState<TabId>('supply')

  const hasCollateral = position != null && position.collateralAmount > 0n
  const hasDebt = position != null && position.debtAmount > 0n
  const hasPosition = hasCollateral || hasDebt
  const healthFactor = position?.healthFactor ?? Infinity

  // Determine which tabs to show
  const tabs = useMemo<{ id: TabId; label: string; group: 'collateral' | 'debt' }[]>(() => {
    if (!hasPosition) {
      return [
        { id: 'supply', label: t('market_modal.tab_supply'), group: 'collateral' },
        { id: 'borrow', label: t('lend_modal.tab_borrow'), group: 'debt' },
      ]
    }
    return [
      { id: 'supply', label: t('market_modal.tab_supply'), group: 'collateral' },
      { id: 'withdraw', label: t('market_modal.tab_withdraw'), group: 'collateral' },
      { id: 'borrow', label: t('lend_modal.tab_borrow'), group: 'debt' },
      { id: 'repay', label: t('lend_modal.tab_repay'), group: 'debt' },
    ]
  }, [hasPosition, t])

  // Auto-select the most relevant tab when position state changes
  useEffect(() => {
    if (!selectedMarket) return

    if (healthFactor < 1.2 && hasDebt) {
      setActiveTab('repay')
    } else if (hasDebt) {
      setActiveTab('borrow')
    } else if (hasCollateral) {
      setActiveTab('borrow')
    } else {
      setActiveTab('supply')
    }
  }, [selectedMarket, hasCollateral, hasDebt, healthFactor])

  // If the active tab is no longer in the visible set, reset
  useEffect(() => {
    const tabIds = tabs.map(t => t.id)
    if (!tabIds.includes(activeTab)) {
      setActiveTab(tabIds[0])
    }
  }, [tabs, activeTab])

  // Health factor color
  const healthColor =
    healthFactor >= 1.5
      ? 'text-color-up'
      : healthFactor >= 1.0
        ? 'text-color-warning'
        : 'text-color-down'

  // ── Empty state ──────────────────────────────────────────────────────
  if (!selectedMarket) {
    return (
      <div className="border border-border-light bg-white">
        <div className="min-h-[300px] flex flex-col items-center justify-center gap-2 px-6">
          {/* Arrow pointing left toward the table */}
          <svg
            className="w-6 h-6 text-text-muted"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={1.5}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
          </svg>
          <p className="text-sm text-text-muted">Select a market</p>
          <p className="text-xs text-text-muted">Click a market row to manage your position</p>
        </div>
      </div>
    )
  }

  const collateral = position ? formatUnits(position.collateralAmount, 18) : null
  const debt = position ? formatUnits(position.debtAmount, 18) : null

  return (
    <div className="border border-border-light bg-white">
      {/* ── Header: market identity + key rates ────────────────────────── */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-border-light">
        <div className="w-8 h-8 bg-muted rounded-full flex items-center justify-center shrink-0">
          <span className="text-text-primary text-[10px] font-bold leading-none">
            {selectedMarket.symbol.slice(0, 3)}
          </span>
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-text-primary leading-tight truncate">
            {selectedMarket.name}
          </p>
          <p className="text-xs text-text-muted font-mono">
            ${selectedMarket.symbol}
          </p>
        </div>
        <div className="flex items-center gap-3 shrink-0 text-xs font-mono tabular-nums">
          <div className="text-right">
            <span className="text-text-muted block text-[10px] uppercase tracking-wide">APY</span>
            <span className="text-text-primary font-semibold">
              {selectedMarket.borrowApy.toFixed(2)}%
            </span>
          </div>
          <div className="text-right">
            <span className="text-text-muted block text-[10px] uppercase tracking-wide">LLTV</span>
            <span className="text-text-primary font-semibold">
              {selectedMarket.lltv.toFixed(0)}%
            </span>
          </div>
        </div>
      </div>

      {/* ── Position summary ─────────────────────────────────────────── */}
      {hasPosition && !positionLoading && (
        <div className="flex items-center gap-4 px-4 py-2.5 border-b border-border-light text-xs font-mono tabular-nums">
          <div>
            <span className="text-text-muted uppercase tracking-wide mr-1">
              {t('position_card.collateral')}
            </span>
            <span className="text-text-primary font-semibold">
              {parseFloat(collateral!).toFixed(4)}
            </span>
          </div>
          <div>
            <span className="text-text-muted uppercase tracking-wide mr-1">
              {t('position_card.debt')}
            </span>
            <span className="text-text-primary font-semibold">
              {parseFloat(debt!).toFixed(2)}
            </span>
          </div>
          <div>
            <span className="text-text-muted uppercase tracking-wide mr-1">HF</span>
            <span className={`font-bold ${healthColor}`}>
              {healthFactor === Infinity ? '\u221e' : healthFactor.toFixed(2)}
            </span>
          </div>
        </div>
      )}

      {/* ── Tabs ─────────────────────────────────────────────────────── */}
      <div className="flex border-b border-border-light">
        {tabs.map((tab, i) => {
          // Insert extra gap between collateral-side and debt-side tabs
          const prevGroup = i > 0 ? tabs[i - 1].group : null
          const gapBefore = prevGroup != null && prevGroup !== tab.group

          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`px-4 py-2 text-sm font-medium transition-colors relative ${
                gapBefore ? 'ml-px border-l border-border-light' : ''
              } ${
                activeTab === tab.id
                  ? 'text-text-primary'
                  : 'text-text-muted hover:text-text-secondary'
              }`}
            >
              {tab.label}
              {activeTab === tab.id && (
                <span className="absolute bottom-0 left-0 right-0 h-[2px] bg-black" />
              )}
            </button>
          )
        })}
      </div>

      {/* ── Tab content ──────────────────────────────────────────────── */}
      <div className="p-5">
        {activeTab === 'supply' && (
          <DepositCollateral
            market={selectedMarket.market}
            itpId={selectedMarket.itpId}
            onSuccess={onSuccess}
          />
        )}
        {activeTab === 'withdraw' && (
          <WithdrawCollateral
            market={selectedMarket.market}
            onSuccess={onSuccess}
          />
        )}
        {activeTab === 'borrow' && (
          <BorrowUsdc
            market={selectedMarket.market}
            onSuccess={onSuccess}
          />
        )}
        {activeTab === 'repay' && (
          <RepayDebt
            market={selectedMarket.market}
            itpId={selectedMarket.itpId}
            onSuccess={onSuccess}
          />
        )}
      </div>
    </div>
  )
}
