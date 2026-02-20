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
import { MarketsSection } from '@/components/domain/MarketsSection'

type ActivePage = 'investment' | 'vision'

export default function Home() {
  const [activePage, setActivePage] = useState<ActivePage>('investment')
  const [deployHoldings, setDeployHoldings] = useState<{ symbol: string; weight: number }[] | null>(null)

  const handleDeployIndex = useCallback((holdings: { symbol: string; weight: number }[]) => {
    setDeployHoldings(holdings)
    document.getElementById('create')?.scrollIntoView({ behavior: 'smooth' })
  }, [])

  return (
    <main className="min-h-screen bg-page flex flex-col">
      <Header activePage={activePage} onPageChange={setActivePage} />

      <div className="flex-1">
        {activePage === 'investment' && (
          <>
            {/* Markets */}
            <section id="markets" className="py-12">
              <div className="max-w-site mx-auto px-6 lg:px-12 space-y-8">
                <ItpListing />
                <MarketsSection />
              </div>
            </section>

            {/* Portfolio */}
            <section id="portfolio" className="py-12 border-t border-border-light">
              <div className="max-w-site mx-auto px-6 lg:px-12">
                <PortfolioSection expanded={true} onToggle={() => {}} />
              </div>
            </section>

            {/* Create */}
            <section id="create" className="py-12 border-t border-border-light">
              <div className="max-w-site mx-auto px-6 lg:px-12">
                <CreateItpSection
                  expanded={true}
                  onToggle={() => {}}
                  initialHoldings={deployHoldings}
                />
              </div>
            </section>

            {/* Lend */}
            <section id="lend" className="py-12 border-t border-border-light">
              <div className="max-w-site mx-auto px-6 lg:px-12">
                <VaultModal inline onClose={() => {}} />
              </div>
            </section>

            {/* Backtest */}
            <section id="backtest" className="py-12 border-t border-border-light">
              <div className="max-w-site mx-auto px-6 lg:px-12">
                <BacktestSection
                  expanded={true}
                  onToggle={() => {}}
                  onDeployIndex={handleDeployIndex}
                />
              </div>
            </section>

            {/* System */}
            <section id="system" className="py-12 border-t border-border-light">
              <div className="max-w-site mx-auto px-6 lg:px-12">
                <SystemStatusSection expanded={true} onToggle={() => {}} />
              </div>
            </section>
          </>
        )}

        {activePage === 'vision' && (
          <div className="max-w-site mx-auto px-6 lg:px-12 py-12">
            <div className="text-center py-16">
              <p className="text-xs font-medium uppercase tracking-widest text-text-muted mb-2">Coming Soon</p>
              <h2 className="text-2xl font-bold text-text-primary mb-4">Vision</h2>
              <p className="text-text-secondary">AI-powered market intelligence — Leaderboard & Markets</p>
            </div>
          </div>
        )}
      </div>

      <Footer />
    </main>
  )
}
