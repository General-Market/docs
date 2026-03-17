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

const VaultTradesFeed = dynamic(
  () => import('@/components/domain/VaultTradesFeed').then(mod => ({ default: mod.VaultTradesFeed })),
  { ssr: false, loading: SectionSkeleton }
)

const SECTION_IDS = ['markets', 'portfolio', 'create', 'lend', 'backtest', 'system', 'ap-feed']

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

      <div className="flex-1 overflow-x-clip pb-14 lg:pb-0 lg:pl-[140px]">
        {/* ── Markets — hero section, owns its own padding ── */}
        <section id="markets">
          <ItpListing onItpsLoaded={handleItpsLoaded} />
        </section>

        {/* ── Portfolio — surface bg creates natural break from Markets ── */}
        <section id="portfolio" className="bg-surface border-t border-border-light">
          <div className="px-6 lg:px-12">
            <div className="max-w-site mx-auto py-10">
              <PortfolioSection expanded={true} onToggle={() => {}} deployedItps={deployedItps} />
            </div>
          </div>
        </section>

        {/* ── Create — back to white, border-top as lighter separator ── */}
        <section id="create" className="border-t border-border-light">
          <div className="px-6 lg:px-12">
            <div className="max-w-site mx-auto py-10">
              <CreateItpSection
                expanded={true}
                onToggle={() => {}}
                initialHoldings={deployHoldings}
              />
            </div>
          </div>
        </section>

        {/* ── Single divider — context shift: from building to lending ── */}
        <div className="section-divider" />

        {/* ── Lend — surface bg ── */}
        <section id="lend" className="bg-surface">
          <div className="px-6 lg:px-12">
            <div className="max-w-site mx-auto py-8">
              <VaultModal inline onClose={() => {}} />
            </div>
          </div>
        </section>

        {/* ── Backtest — white, border separator ── */}
        <section id="backtest" className="border-t border-border-light">
          <div className="px-6 lg:px-12">
            <div className="max-w-site mx-auto py-10">
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

        {/* ── Monitoring — System + AP Feed grouped, compact, surface bg ── */}
        <div className="bg-surface border-t border-border-light">
          <div className="px-6 lg:px-12">
            <div className="max-w-site mx-auto">
              <section id="system" className="py-6">
                <SystemStatusSection deployedItps={deployedItps} />
              </section>
              <div className="border-t border-border-medium" />
              <section id="ap-feed" className="py-6">
                <VaultTradesFeed deployedItps={deployedItps} />
              </section>
            </div>
          </div>
        </div>
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
