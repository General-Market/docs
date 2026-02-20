'use client'

import { useState, useCallback } from 'react'
import dynamic from 'next/dynamic'
import { Header } from '@/components/layout/Header'
import { Footer } from '@/components/layout/Footer'
import { ItpListing } from '@/components/domain/ItpListing'
import { MarketsSection } from '@/components/domain/MarketsSection'

// Lazy-load below-the-fold sections to reduce First Load JS
const SectionSkeleton = () => (
  <div className="animate-pulse bg-muted rounded-xl h-48" />
)

const PortfolioSection = dynamic(
  () => import('@/components/domain/PortfolioSection').then(mod => ({ default: mod.PortfolioSection })),
  { ssr: false, loading: SectionSkeleton }
)

const CreateItpSection = dynamic(
  () => import('@/components/domain/CreateItpSection').then(mod => ({ default: mod.CreateItpSection })),
  { ssr: false, loading: SectionSkeleton }
)

const VaultModal = dynamic(
  () => import('@/components/domain/VaultModal').then(mod => ({ default: mod.VaultModal })),
  { ssr: false, loading: SectionSkeleton }
)

const BacktestSection = dynamic(
  () => import('@/components/domain/simulation/BacktestSection').then(mod => ({ default: mod.BacktestSection })),
  { ssr: false, loading: SectionSkeleton }
)

const SystemStatusSection = dynamic(
  () => import('@/components/domain/SystemStatusSection').then(mod => ({ default: mod.SystemStatusSection })),
  { ssr: false, loading: SectionSkeleton }
)

const VisionPage = dynamic(
  () => import('@/components/domain/vision/VisionPage').then(mod => ({ default: mod.VisionPage })),
  { ssr: false, loading: SectionSkeleton }
)

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

        {activePage === 'vision' && <VisionPage />}
      </div>

      <Footer />
    </main>
  )
}
