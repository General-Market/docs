'use client'

import { useState, useEffect } from 'react'
import { useAccount } from 'wagmi'
import { useTranslations } from 'next-intl'
import { ErrorBoundary } from '@/components/ui/ErrorBoundary'
import { LendingStatsBanner } from './LendingStatsBanner'
import { YourPositions } from './YourPositions'
import { MarketsTable } from './MarketsTable'
import { MarketActionModal } from './MarketActionModal'
import { VaultSupplySection } from './VaultSupplySection'
import type { MorphoMarketEntry } from '@/lib/contracts/morpho-markets-registry'

interface SelectedMarket {
  market: MorphoMarketEntry
  itpInfo: { name: string; symbol: string; itpId: string; settlementAddress: string }
  initialTab?: 'supply' | 'borrow' | 'repay' | 'withdraw'
}

const ErrorFallback = (
  <div className="bg-surface-down border border-color-down/30 rounded-lg p-6 text-center">
    <h3 className="text-color-down font-bold mb-2">Module failed to load</h3>
    <p className="text-text-muted text-sm">Refresh the page to retry.</p>
  </div>
)

export function LendingPage() {
  const t = useTranslations('lending')
  const { isConnected } = useAccount()
  const [selected, setSelected] = useState<SelectedMarket | null>(null)

  const handleSelectMarket = (
    market: MorphoMarketEntry,
    itpInfo: { name: string; symbol: string; itpId: string; settlementAddress: string },
    initialTab?: 'supply' | 'borrow' | 'repay' | 'withdraw'
  ) => {
    setSelected({ market, itpInfo, initialTab })
  }

  // Listen for lending-refresh to trigger re-renders
  const [refreshKey, setRefreshKey] = useState(0)
  useEffect(() => {
    const handler = () => setRefreshKey(k => k + 1)
    window.addEventListener('lending-refresh', handler)
    return () => window.removeEventListener('lending-refresh', handler)
  }, [])

  return (
    <div className="space-y-6" key={refreshKey}>
      {/* Page header */}
      <div className="pt-10 mb-2">
        <p className="text-label font-semibold tracking-[0.08em] uppercase text-text-muted mb-1.5">{t('heading.label')}</p>
        <h2 className="text-display font-black text-black">{t('heading.title')}</h2>
        <p className="text-body text-text-secondary mt-1.5">{t('heading.description')}</p>
      </div>

      <ErrorBoundary fallback={ErrorFallback}>
        {/* Stats banner */}
        <LendingStatsBanner />

        {/* Your active positions (only when connected + has positions) */}
        {isConnected && (
          <YourPositions onSelectMarket={handleSelectMarket} />
        )}

        {/* Markets table — the primary interface */}
        <MarketsTable onSelectMarket={handleSelectMarket} />

        {/* Vault supply section — for USDC lenders */}
        <VaultSupplySection />
      </ErrorBoundary>

      {/* Per-market action modal */}
      {selected && (
        <MarketActionModal
          market={selected.market}
          itpInfo={selected.itpInfo}
          isOpen={true}
          onClose={() => setSelected(null)}
          initialTab={selected.initialTab}
        />
      )}
    </div>
  )
}
