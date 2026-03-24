'use client'

import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { useTranslations } from 'next-intl'
import { useAccount } from 'wagmi'
import { formatUnits } from 'viem'
import { useMorphoPosition } from '@/hooks/useMorphoPosition'
import { useSSENav, useSSEBalances } from '@/hooks/useSSE'
import { getMorphoMarketForItp } from '@/lib/contracts/morpho-markets-registry'
import { DepositCollateral } from './DepositCollateral'
import { BorrowUsdc } from './BorrowUsdc'
import { RepayDebt } from './RepayDebt'
import { WithdrawCollateral } from './WithdrawCollateral'
import type { MarketRow } from './MarketsTable'
import type { MorphoMarketEntry } from '@/lib/contracts/morpho-markets-registry'

type TabId = 'supply' | 'borrow' | 'repay' | 'withdraw'

interface MarketActionPanelProps {
  selectedRow: MarketRow | null
  onSelectRow: (row: MarketRow) => void
}

/**
 * Inline action panel at the top of the lending page.
 * Replaces the old modal. Has an ITP selector dropdown and tabs for actions.
 */
export function MarketActionPanel({ selectedRow, onSelectRow }: MarketActionPanelProps) {
  const t = useTranslations('lending')
  const { isConnected } = useAccount()
  const [activeTab, setActiveTab] = useState<TabId>('borrow')
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  // Build list of eligible ITPs for the selector
  const navSnapshots = useSSENav()
  const balances = useSSEBalances()

  const eligibleItps = useMemo(() => {
    if (!balances?.itp_shares || navSnapshots.length === 0) return []

    const items: { itpId: string; name: string; symbol: string; settlementAddress: string; balance: bigint; nav: number; market: MorphoMarketEntry }[] = []

    for (const [itpId, balStr] of Object.entries(balances.itp_shares)) {
      const bal = BigInt(balStr || '0')
      if (bal === 0n) continue

      const nav = navSnapshots.find(n => n.itp_id.toLowerCase() === itpId.toLowerCase())
      if (!nav?.settlement_address) continue

      const market = getMorphoMarketForItp(nav.settlement_address)
      if (!market) continue

      items.push({
        itpId: nav.itp_id,
        name: nav.name,
        symbol: nav.symbol,
        settlementAddress: nav.settlement_address,
        balance: bal,
        nav: nav.nav_per_share,
        market,
      })
    }

    items.sort((a, b) => (b.balance > a.balance ? 1 : b.balance < a.balance ? -1 : 0))
    return items
  }, [navSnapshots, balances])

  // Auto-select first eligible ITP if none selected
  useEffect(() => {
    if (!selectedRow && eligibleItps.length > 0) {
      const first = eligibleItps[0]
      onSelectRow({
        collateralToken: first.settlementAddress,
        name: first.name,
        symbol: first.symbol,
        itpId: first.itpId,
        settlementAddress: first.settlementAddress,
        borrowApy: 0,
        available: 0,
        lltv: 0,
        hasPosition: false,
        market: first.market,
      })
    }
  }, [eligibleItps, selectedRow, onSelectRow])

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const market = selectedRow?.market ?? null
  const { position, isLoading: posLoading, refetch: refetchPosition } = useMorphoPosition(market)

  useEffect(() => {
    const handler = () => refetchPosition()
    window.addEventListener('lending-refresh', handler)
    return () => window.removeEventListener('lending-refresh', handler)
  }, [refetchPosition])

  const handleActionSuccess = useCallback(() => {
    refetchPosition()
  }, [refetchPosition])

  const hasPosition = position && (position.collateralAmount > 0n || position.debtAmount > 0n)
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

  if (!isConnected) return null

  // No eligible ITPs — show placeholder
  if (eligibleItps.length === 0 && !selectedRow) {
    return (
      <div className="border border-border-light p-6 text-center">
        <p className="text-text-secondary text-sm">{t('collateral_selector.no_itps')}</p>
        <p className="text-text-muted text-xs mt-1">{t('collateral_selector.no_itps_hint')}</p>
      </div>
    )
  }

  const handleSelectFromDropdown = (item: typeof eligibleItps[number]) => {
    onSelectRow({
      collateralToken: item.settlementAddress,
      name: item.name,
      symbol: item.symbol,
      itpId: item.itpId,
      settlementAddress: item.settlementAddress,
      borrowApy: 0,
      available: 0,
      lltv: 0,
      hasPosition: false,
      market: item.market,
    })
    setDropdownOpen(false)
  }

  return (
    <div className="border border-border-light">
      {/* ITP selector + position summary */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-4 py-3 border-b border-border-light">
        {/* ITP dropdown */}
        <div className="relative" ref={dropdownRef}>
          <button
            type="button"
            onClick={() => setDropdownOpen(v => !v)}
            className="flex items-center gap-2 hover:bg-muted/30 rounded px-2 py-1 transition-colors"
          >
            <div className="w-7 h-7 bg-muted rounded-full flex items-center justify-center shrink-0">
              <span className="text-text-primary text-micro font-bold">
                {selectedRow?.symbol?.slice(0, 3) || '?'}
              </span>
            </div>
            <div className="text-left">
              <p className="text-sm font-semibold text-text-primary leading-tight">
                {selectedRow?.name || 'Select ITP'}
              </p>
              <p className="text-xs text-text-muted font-mono">
                ${selectedRow?.symbol || ''}
              </p>
            </div>
            <svg className={`w-4 h-4 text-text-muted transition-transform ${dropdownOpen ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
            </svg>
          </button>

          {/* Dropdown list */}
          {dropdownOpen && (
            <div className="absolute top-full left-0 mt-1 z-50 bg-white border border-border-light shadow-lg rounded max-h-64 overflow-y-auto min-w-[280px]">
              {eligibleItps.map(item => (
                <button
                  key={item.itpId}
                  type="button"
                  onClick={() => handleSelectFromDropdown(item)}
                  className={`w-full flex items-center justify-between gap-3 px-3 py-2 hover:bg-muted/50 transition-colors text-left ${
                    selectedRow?.itpId === item.itpId ? 'bg-muted/30' : ''
                  }`}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <div className="w-6 h-6 bg-muted rounded-full flex items-center justify-center shrink-0">
                      <span className="text-text-primary text-[9px] font-bold">{item.symbol.slice(0, 3)}</span>
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs font-semibold text-text-primary truncate">{item.name}</p>
                      <p className="text-[10px] text-text-muted font-mono">${item.symbol}</p>
                    </div>
                  </div>
                  <span className="text-xs font-mono tabular-nums text-text-muted shrink-0">
                    {parseFloat(formatUnits(item.balance, 18)).toFixed(2)}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Position summary — compact inline */}
        {hasPosition && !posLoading && (
          <div className="flex items-center gap-4 text-xs font-mono tabular-nums">
            <div>
              <span className="text-text-muted uppercase tracking-wide mr-1">{t('position_card.collateral')}</span>
              <span className="text-text-primary font-semibold">{parseFloat(collateral!).toFixed(4)}</span>
            </div>
            <div>
              <span className="text-text-muted uppercase tracking-wide mr-1">{t('position_card.debt')}</span>
              <span className="text-text-primary font-semibold">{parseFloat(debt!).toFixed(2)}</span>
            </div>
            <div>
              <span className="text-text-muted uppercase tracking-wide mr-1">HF</span>
              <span className={`font-bold ${healthColor}`}>
                {healthFactor === Infinity ? '∞' : healthFactor.toFixed(2)}
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Tabs */}
      <div className="flex border-b border-border-light">
        {tabs.map(tab => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id)}
            className={`px-4 py-2 text-sm font-medium transition-colors relative ${
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
        ))}
      </div>

      {/* Tab content */}
      {market && (
        <div className="p-4">
          {activeTab === 'supply' && (
            <DepositCollateral
              market={market}
              itpId={selectedRow?.itpId ?? ''}
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
              itpId={selectedRow?.itpId ?? ''}
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
      )}
    </div>
  )
}
