'use client'

import { useState, useCallback } from 'react'
import dynamic from 'next/dynamic'
import { Header } from '@/components/layout/Header'
import { Footer } from '@/components/layout/Footer'
import { PageSection } from '@/components/layout/PageSection'
import { ItpListing, DeployedItpRef } from '@/components/domain/ItpListing'
import { ErrorBoundary } from '@/components/ui/ErrorBoundary'
import { useSectionTimeTracker } from '@/hooks/useSectionTimeTracker'
import { useScrollReveal } from '@/hooks/useScrollReveal'
import { OnboardingModal } from '@/components/domain/OnboardingModal'

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

const VaultTradesFeed = dynamic(
  () => import('@/components/domain/VaultTradesFeed').then(mod => ({ default: mod.VaultTradesFeed })),
  { ssr: false, loading: SectionSkeleton }
)

const SectionFallback = () => (
  <div className="py-8 text-center border border-border-light rounded-card bg-surface">
    <div className="font-mono text-micro font-bold tracking-[0.08em] uppercase text-text-muted mb-2">Section Error</div>
    <p className="text-text-secondary text-sm">This section encountered an error. Refresh the page to retry.</p>
  </div>
)

const SECTION_IDS = ['markets', 'portfolio', 'create', 'lend', 'backtest', 'system', 'ap-feed']

export function HomeClient() {
  const [deployHoldings, setDeployHoldings] = useState<{ symbol: string; weight: number }[] | null>(null)
  const [deployedItps, setDeployedItps] = useState<DeployedItpRef[]>([])
  const [rebalanceModal, setRebalanceModal] = useState<{
    itpId: string; name: string; holdings: { symbol: string; weight: number }[]
  } | null>(null)

  useSectionTimeTracker(SECTION_IDS)
  const revealRef = useScrollReveal()

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
      <OnboardingModal />

      <div ref={revealRef} className="flex-1 overflow-x-clip">
        <section id="markets" data-fade-in>
          <ErrorBoundary fallback={<SectionFallback />}>
            <ItpListing onItpsLoaded={handleItpsLoaded} />
          </ErrorBoundary>
        </section>

        <div className="section-divider" />
        <PageSection id="portfolio" data-fade-in>
          <ErrorBoundary fallback={<SectionFallback />}>
            <PortfolioSection expanded={true} onToggle={() => {}} deployedItps={deployedItps} />
          </ErrorBoundary>
        </PageSection>

        <div className="section-divider" />
        <PageSection id="create" data-fade-in>
          <ErrorBoundary fallback={<SectionFallback />}>
            <CreateItpSection
              expanded={true}
              onToggle={() => {}}
              initialHoldings={deployHoldings}
            />
          </ErrorBoundary>
        </PageSection>

        <div className="section-divider" />
        <PageSection id="lend" data-fade-in>
          <ErrorBoundary fallback={<SectionFallback />}>
            <VaultModal inline onClose={() => {}} />
          </ErrorBoundary>
        </PageSection>

        <div className="section-divider" />
        <PageSection id="backtest" data-fade-in>
          <ErrorBoundary fallback={<SectionFallback />}>
            <BacktestSection
              expanded={true}
              onToggle={() => {}}
              onDeployIndex={handleDeployIndex}
              deployedItps={deployedItps}
              onRebalanceItp={handleRebalanceItp}
            />
          </ErrorBoundary>
        </PageSection>

        <div className="section-divider" />
        <PageSection id="system" data-fade-in>
          <ErrorBoundary fallback={<SectionFallback />}>
            <SystemStatusSection deployedItps={deployedItps} />
          </ErrorBoundary>
        </PageSection>

        <div className="section-divider" />
        <PageSection id="ap-feed" data-fade-in>
          <ErrorBoundary fallback={<SectionFallback />}>
            <VaultTradesFeed deployedItps={deployedItps} />
          </ErrorBoundary>
        </PageSection>
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
