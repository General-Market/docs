'use client'

import { useState, useCallback } from 'react'
import { Header } from '@/components/layout/Header'
import { Footer } from '@/components/layout/Footer'
import { ItpListing } from '@/components/domain/ItpListing'
import { CreateItpSection } from '@/components/domain/CreateItpSection'
import { PortfolioSection } from '@/components/domain/PortfolioSection'
import { SystemStatusSection } from '@/components/domain/SystemStatusSection'
import { VaultModal } from '@/components/domain/VaultModal'
import { BacktestSection } from '@/components/domain/simulation/BacktestSection'

type Tab = 'markets' | 'portfolio' | 'create' | 'lend' | 'backtest' | 'system'

export default function Home() {
  const [activeTab, setActiveTab] = useState<Tab>('markets')
  const [deployHoldings, setDeployHoldings] = useState<{ symbol: string; weight: number }[] | null>(null)

  const handleDeployIndex = useCallback((holdings: { symbol: string; weight: number }[]) => {
    setDeployHoldings(holdings)
    setActiveTab('create')
  }, [])

  return (
    <main className="min-h-screen bg-page flex flex-col">
      <Header activeTab={activeTab} onTabChange={setActiveTab} />

      <div className="flex-1">
        <div className="max-w-site mx-auto px-6 lg:px-12 py-6">
          {activeTab === 'markets' && (
            <ItpListing
              onCreateClick={() => setActiveTab('create')}
              onLendingClick={() => setActiveTab('lend')}
            />
          )}
          {activeTab === 'portfolio' && (
            <PortfolioSection expanded={true} onToggle={() => {}} />
          )}
          {activeTab === 'create' && (
            <CreateItpSection
              expanded={true}
              onToggle={() => {}}
              initialHoldings={deployHoldings}
            />
          )}
          {activeTab === 'lend' && (
            // TODO Task 9: Add inline prop to VaultModal so it renders as page content, not overlay
            <VaultModal onClose={() => setActiveTab('markets')} />
          )}
          {activeTab === 'backtest' && (
            <BacktestSection
              expanded={true}
              onToggle={() => {}}
              onDeployIndex={handleDeployIndex}
            />
          )}
          {activeTab === 'system' && (
            <SystemStatusSection expanded={true} onToggle={() => {}} />
          )}
        </div>
      </div>

      <Footer />
    </main>
  )
}
