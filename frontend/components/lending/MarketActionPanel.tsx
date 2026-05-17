'use client'

import { useState, useEffect, useMemo, useRef } from 'react'
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

const panelStyle: React.CSSProperties = {
  background: 'var(--apple-panel)',
  border: '1px solid var(--apple-line)',
  borderRadius: 12,
  overflow: 'hidden',
}

const labelMicro: React.CSSProperties = {
  fontFamily: 'var(--apple-font-text)',
  fontSize: 10,
  fontWeight: 600,
  letterSpacing: 'var(--apple-track-loose)',
  textTransform: 'uppercase',
  color: 'var(--apple-text-tertiary)',
}

const valueText: React.CSSProperties = {
  fontFamily: 'var(--apple-font-text)',
  fontSize: 13,
  fontWeight: 600,
  letterSpacing: 'var(--apple-track-tight)',
  color: 'var(--apple-text)',
  fontVariantNumeric: 'tabular-nums',
}

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

  const marketKey = selectedMarket?.collateralToken ?? ''
  const prevMarketKey = useRef(marketKey)
  useEffect(() => {
    if (!selectedMarket) return
    if (prevMarketKey.current === marketKey) return
    prevMarketKey.current = marketKey

    if (healthFactor < 1.2 && hasDebt) {
      setActiveTab('repay')
    } else if (hasDebt) {
      setActiveTab('borrow')
    } else if (hasCollateral) {
      setActiveTab('borrow')
    } else {
      setActiveTab('supply')
    }
  }, [marketKey, selectedMarket, hasCollateral, hasDebt, healthFactor])

  useEffect(() => {
    const tabIds = tabs.map(t => t.id)
    if (!tabIds.includes(activeTab)) {
      setActiveTab(tabIds[0])
    }
  }, [tabs, activeTab])

  const healthColor =
    healthFactor >= 1.5
      ? '#16a34a'
      : healthFactor >= 1.0
        ? '#b45309'
        : '#dc2626'

  if (!selectedMarket) {
    return (
      <div style={panelStyle}>
        <div
          className="flex flex-col items-center justify-center gap-3"
          style={{ minHeight: 300, padding: 24 }}
        >
          <svg
            width="28"
            height="28"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={1.5}
            style={{ color: 'var(--apple-text-tertiary)' }}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
          </svg>
          <p
            style={{
              fontFamily: 'var(--apple-font-text)',
              fontSize: 15,
              fontWeight: 500,
              letterSpacing: 'var(--apple-track-tight)',
              color: 'var(--apple-text)',
              margin: 0,
            }}
          >
            Select a market
          </p>
          <p
            style={{
              fontFamily: 'var(--apple-font-text)',
              fontSize: 12,
              letterSpacing: 'var(--apple-track-tight)',
              color: 'var(--apple-text-secondary)',
              margin: 0,
            }}
          >
            Click a market row to manage your position.
          </p>
        </div>
      </div>
    )
  }

  const collateral = position ? formatUnits(position.collateralAmount, 18) : null
  const debt = position ? formatUnits(position.debtAmount, 18) : null

  return (
    <div style={panelStyle}>
      <div
        className="flex items-center gap-3"
        style={{
          padding: '14px 16px',
          borderBottom: '1px solid var(--apple-line)',
        }}
      >
        <div
          className="flex items-center justify-center shrink-0"
          style={{
            width: 32,
            height: 32,
            borderRadius: 999,
            background: 'var(--apple-surface)',
            fontFamily: 'var(--apple-font-text)',
            fontSize: 10,
            fontWeight: 700,
            letterSpacing: 'var(--apple-track-loose)',
            color: 'var(--apple-text)',
          }}
        >
          {selectedMarket.symbol.slice(0, 3)}
        </div>
        <div className="min-w-0 flex-1">
          <p
            className="truncate"
            style={{
              fontFamily: 'var(--apple-font-text)',
              fontSize: 14,
              fontWeight: 600,
              letterSpacing: 'var(--apple-track-tight)',
              color: 'var(--apple-text)',
              margin: 0,
            }}
          >
            {selectedMarket.name}
          </p>
          <p
            style={{
              fontFamily: 'var(--apple-font-text)',
              fontSize: 11,
              letterSpacing: 'var(--apple-track-tight)',
              color: 'var(--apple-text-tertiary)',
              margin: 0,
            }}
          >
            ${selectedMarket.symbol}
          </p>
        </div>
        <div className="flex items-center gap-4 shrink-0">
          <div className="text-right">
            <span className="block" style={labelMicro}>APY</span>
            <span style={valueText}>{selectedMarket.borrowApy.toFixed(2)}%</span>
          </div>
          <div className="text-right">
            <span className="block" style={labelMicro}>LLTV</span>
            <span style={valueText}>{selectedMarket.lltv.toFixed(0)}%</span>
          </div>
        </div>
      </div>

      {hasPosition && !positionLoading && (
        <div
          className="flex items-center gap-5"
          style={{
            padding: '10px 16px',
            borderBottom: '1px solid var(--apple-line)',
            background: 'var(--apple-surface)',
          }}
        >
          <div>
            <span className="mr-1.5" style={labelMicro}>
              {t('position_card.collateral')}
            </span>
            <span style={valueText}>{parseFloat(collateral!).toFixed(4)}</span>
          </div>
          <div>
            <span className="mr-1.5" style={labelMicro}>
              {t('position_card.debt')}
            </span>
            <span style={valueText}>{parseFloat(debt!).toFixed(2)}</span>
          </div>
          <div>
            <span className="mr-1.5" style={labelMicro}>HF</span>
            <span style={{ ...valueText, color: healthColor, fontWeight: 700 }}>
              {healthFactor === Infinity ? '∞' : healthFactor.toFixed(2)}
            </span>
          </div>
        </div>
      )}

      <div
        className="flex"
        style={{ borderBottom: '1px solid var(--apple-line)' }}
      >
        {tabs.map((tab, i) => {
          const prevGroup = i > 0 ? tabs[i - 1].group : null
          const gapBefore = prevGroup != null && prevGroup !== tab.group
          const isActive = activeTab === tab.id
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              style={{
                position: 'relative',
                padding: '10px 16px',
                fontFamily: 'var(--apple-font-text)',
                fontSize: 13,
                fontWeight: isActive ? 600 : 500,
                letterSpacing: 'var(--apple-track-tight)',
                color: isActive ? 'var(--apple-text)' : 'var(--apple-text-secondary)',
                background: 'transparent',
                border: 'none',
                cursor: 'pointer',
                borderLeft: gapBefore ? '1px solid var(--apple-line)' : 'none',
                transition: 'color 180ms var(--apple-ease-default)',
              }}
            >
              {tab.label}
              {isActive && (
                <span
                  style={{
                    position: 'absolute',
                    left: 12,
                    right: 12,
                    bottom: -1,
                    height: 2,
                    background: '#0071e3',
                    borderRadius: 2,
                  }}
                />
              )}
            </button>
          )
        })}
      </div>

      <div style={{ padding: 20 }}>
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
