'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { useAccount } from 'wagmi'
import { useTranslations } from 'next-intl'
import { formatUnits } from 'viem'
import { ErrorBoundary } from '@/components/ui/ErrorBoundary'
import { LendingStatsBanner } from './LendingStatsBanner'
import { MarketsTable, type MarketRow } from './MarketsTable'
import { MarketActionPanel } from './MarketActionPanel'
import { VaultSupplySection } from './VaultSupplySection'
import type { MorphoMarketEntry } from '@/lib/contracts/morpho-markets-registry'

const ErrorFallback = (
  <div className="bg-surface-down border border-color-down/30 rounded-lg p-6 text-center">
    <h3 className="text-color-down font-bold mb-2">Module failed to load</h3>
    <p className="text-text-muted text-sm">Refresh the page to retry.</p>
  </div>
)

export function LendingPage() {
  const t = useTranslations('lending')
  const { isConnected } = useAccount()
  const [selectedRow, setSelectedRow] = useState<MarketRow | null>(null)

  // Listen for lending-refresh to trigger re-renders
  const [refreshKey, setRefreshKey] = useState(0)
  useEffect(() => {
    const handler = () => setRefreshKey(k => k + 1)
    window.addEventListener('lending-refresh', handler)
    return () => window.removeEventListener('lending-refresh', handler)
  }, [])

  const handleSelectRow = useCallback((row: MarketRow) => {
    setSelectedRow(row)
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

        {/* Inline action panel — replaces the modal */}
        {isConnected && (
          <MarketActionPanel
            selectedRow={selectedRow}
            onSelectRow={handleSelectRow}
          />
        )}

        {/* Markets table — compact Aave-style list */}
        <MarketsTable
          onSelectRow={handleSelectRow}
          selectedCollateralToken={selectedRow?.collateralToken ?? null}
        />

        {/* Vault supply section — for USDC lenders */}
        <VaultSupplySection />
      </ErrorBoundary>
    </div>
  )
}
