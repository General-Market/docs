'use client'

import { useState, useCallback } from 'react'
import dynamic from 'next/dynamic'
import { Header } from '@/components/layout/Header'
import { Footer } from '@/components/layout/Footer'
import { ItpListing, DeployedItpRef } from '@/components/domain/ItpListing'
import { useSectionTimeTracker } from '@/hooks/useSectionTimeTracker'

const SectionSkeleton = () => (
  <div className="animate-pulse bg-surface rounded-md h-48" />
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

const RebalanceModal = dynamic(
  () => import('@/components/domain/RebalanceModal').then(mod => ({ default: mod.RebalanceModal })),
  { ssr: false }
)

const SystemStatusSection = dynamic(
  () => import('@/components/domain/SystemStatusSection').then(mod => ({ default: mod.SystemStatusSection })),
  { ssr: false, loading: SectionSkeleton }
)

const SECTION_IDS = ['markets', 'portfolio', 'create', 'lend', 'backtest', 'system']

export function HomeClient() {
  const [deployHoldings, setDeployHoldings] = useState<{ symbol: string; weight: number }[] | null>(null)
  const [deployedItps, setDeployedItps] = useState<DeployedItpRef[]>([])
  const [rebalanceModal, setRebalanceModal] = useState<{
    itpId: string; name: string; holdings: { symbol: string; weight: number }[]
  } | null>(null)

  useSectionTimeTracker(SECTION_IDS)

  const handleDeployIndex = useCallback((holdings: { symbol: string; weight: number }[]) => {
    setDeployHoldings(holdings)
    document.getElementById('create')?.scrollIntoView({ behavior: 'smooth' })
  }, [])

  const handleItpsLoaded = useCallback((itps: DeployedItpRef[]) => {
    setDeployedItps(itps)
  }, [])

  const handleRebalanceItp = useCallback((itpId: string, holdings: { symbol: string; weight: number }[]) => {
    const itp = deployedItps.find(i => i.itpId === itpId)
    setRebalanceModal({
      itpId,
      name: itp?.name || itp?.symbol || itpId.slice(0, 10),
      holdings,
    })
  }, [deployedItps])

  return (
    <>
      <Header />

      <div className="flex-1 overflow-x-clip">
        <section id="markets">
          <ItpListing onItpsLoaded={handleItpsLoaded} />
        </section>

        <div className="section-divider" />
        <section id="portfolio">
          <div className="px-6 lg:px-12">
            <div className="max-w-site mx-auto">
              <PortfolioSection expanded={true} onToggle={() => {}} deployedItps={deployedItps} />
            </div>
          </div>
        </section>

        <div className="section-divider" />
        <section id="create">
          <div className="px-6 lg:px-12">
            <div className="max-w-site mx-auto">
              <CreateItpSection
                expanded={true}
                onToggle={() => {}}
                initialHoldings={deployHoldings}
              />
            </div>
          </div>
        </section>

        <div className="section-divider" />
        <section id="lend">
          <div className="px-6 lg:px-12">
            <div className="max-w-site mx-auto">
              <VaultModal inline onClose={() => {}} />
            </div>
          </div>
        </section>

        <div className="section-divider" />
        <section id="backtest">
          <div className="px-6 lg:px-12">
            <div className="max-w-site mx-auto">
              <BacktestSection
                expanded={true}
                onToggle={() => {}}
                onDeployIndex={handleDeployIndex}
                deployedItps={deployedItps}
                onRebalanceItp={handleRebalanceItp}
              />
            </div>
          </div>
        </section>

        <div className="section-divider" />
        <section id="system">
          <div className="px-6 lg:px-12">
            <div className="max-w-site mx-auto">
              <SystemStatusSection deployedItps={deployedItps} />
            </div>
          </div>
        </section>
      </div>

      {rebalanceModal && (
        <RebalanceModal
          itpId={rebalanceModal.itpId}
          itpName={rebalanceModal.name}
          initialHoldings={rebalanceModal.holdings}
          onClose={() => setRebalanceModal(null)}
        />
      )}

      <Footer />
    </>
  )
}
