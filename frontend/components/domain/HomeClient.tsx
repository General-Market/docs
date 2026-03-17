'use client'

import { useState, useCallback } from 'react'
import dynamic from 'next/dynamic'
import { useTranslations } from 'next-intl'
import { Header } from '@/components/layout/Header'
import { Footer } from '@/components/layout/Footer'
import { ItpListing, DeployedItpRef } from '@/components/domain/ItpListing'
import { useSectionTimeTracker } from '@/hooks/useSectionTimeTracker'
import { usePostHogTracker } from '@/hooks/usePostHog'

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

const NAV_ITEMS = [
  { id: 'markets', label: 'Markets' },
  { id: 'portfolio', label: 'Portfolio' },
  { id: 'create', label: 'Create' },
  { id: 'lend', label: 'Lend' },
  { id: 'backtest', label: 'Backtest' },
  { id: 'system', label: 'System' },
  { id: 'ap-feed', label: 'AP Feed' },
]

export function HomeClient() {
  const t = useTranslations('common')
  const { capture } = usePostHogTracker()
  const [activeSection, setActiveSection] = useState('markets')
  const [deployHoldings, setDeployHoldings] = useState<{ symbol: string; weight: number }[] | null>(null)
  const [deployedItps, setDeployedItps] = useState<DeployedItpRef[]>([])
  const [rebalanceModal, setRebalanceModal] = useState<{
    itpId: string; name: string; holdings: { symbol: string; weight: number }[]
  } | null>(null)

  useSectionTimeTracker(SECTION_IDS)

  const handleSectionChange = useCallback((id: string) => {
    setActiveSection(id)
    capture('section_navigated', { section_name: id })
  }, [capture])

  const handleDeployIndex = useCallback((holdings: { symbol: string; weight: number }[]) => {
    setDeployHoldings(holdings)
    setActiveSection('create')
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

      <div className="flex min-h-[calc(100vh-64px)]">
        {/* ── Morpho-style sidebar — dark, permanent, desktop only ── */}
        <aside className="hidden lg:flex flex-col w-[200px] shrink-0 bg-zinc-950 border-r border-white/[0.06] sticky top-16 h-[calc(100vh-64px)]">
          {/* Nav items */}
          <nav className="flex-1 py-4 px-3 flex flex-col gap-0.5">
            {NAV_ITEMS.map((item) => (
              <button
                key={item.id}
                onClick={() => handleSectionChange(item.id)}
                className={`group flex items-center gap-3 px-3 py-2.5 rounded-md text-[13px] font-medium transition-all duration-150 text-left ${
                  activeSection === item.id
                    ? 'bg-white/[0.08] text-white'
                    : 'text-white/40 hover:text-white/70 hover:bg-white/[0.04]'
                }`}
              >
                {/* Active indicator — left bar */}
                <span className={`w-[3px] h-4 rounded-full transition-all duration-150 shrink-0 ${
                  activeSection === item.id ? 'bg-white' : 'bg-transparent group-hover:bg-white/20'
                }`} />
                {item.label}
              </button>
            ))}
          </nav>

          {/* Bottom — subtle branding */}
          <div className="px-5 py-4 border-t border-white/[0.06]">
            <span className="text-[10px] font-mono text-white/20 uppercase tracking-[0.1em]">General Market</span>
          </div>
        </aside>

        {/* ── Mobile bottom bar — dark to match sidebar ── */}
        <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-zinc-950 border-t border-white/[0.06] safe-area-bottom">
          <div className="flex items-center justify-around h-14 px-2">
            {NAV_ITEMS.map((item) => (
              <button
                key={item.id}
                onClick={() => handleSectionChange(item.id)}
                className={`flex flex-col items-center gap-0.5 px-2 py-1.5 rounded transition-all duration-150 min-w-0 ${
                  activeSection === item.id
                    ? 'text-white'
                    : 'text-white/30'
                }`}
              >
                <span className={`w-1 h-1 rounded-full transition-all ${
                  activeSection === item.id ? 'bg-white' : 'bg-transparent'
                }`} />
                <span className="text-[9px] font-semibold truncate">{item.label}</span>
              </button>
            ))}
          </div>
        </nav>

        {/* ── Main content — single active section ── */}
        <main className="flex-1 min-w-0 pb-16 lg:pb-0">
          {activeSection === 'markets' && (
            <section id="markets" className="animate-fade-in">
              <ItpListing onItpsLoaded={handleItpsLoaded} />
            </section>
          )}

          {activeSection === 'portfolio' && (
            <section id="portfolio" className="animate-fade-in">
              <div className="px-6 lg:px-12 py-8">
                <PortfolioSection expanded={true} onToggle={() => {}} deployedItps={deployedItps} />
              </div>
            </section>
          )}

          {activeSection === 'create' && (
            <section id="create" className="animate-fade-in">
              <div className="px-6 lg:px-12 py-8">
                <CreateItpSection
                  expanded={true}
                  onToggle={() => {}}
                  initialHoldings={deployHoldings}
                />
              </div>
            </section>
          )}

          {activeSection === 'lend' && (
            <section id="lend" className="animate-fade-in">
              <div className="px-6 lg:px-12 py-8">
                <VaultModal inline onClose={() => {}} />
              </div>
            </section>
          )}

          {activeSection === 'backtest' && (
            <section id="backtest" className="animate-fade-in">
              <div className="px-6 lg:px-12 py-8">
                <BacktestSection
                  expanded={true}
                  onToggle={() => {}}
                  onDeployIndex={handleDeployIndex}
                  deployedItps={deployedItps}
                  onRebalanceItp={handleRebalanceItp}
                />
              </div>
            </section>
          )}

          {activeSection === 'system' && (
            <section id="system" className="animate-fade-in">
              <div className="px-6 lg:px-12 py-8">
                <SystemStatusSection deployedItps={deployedItps} />
              </div>
            </section>
          )}

          {activeSection === 'ap-feed' && (
            <section id="ap-feed" className="animate-fade-in">
              <div className="px-6 lg:px-12 py-8">
                <VaultTradesFeed deployedItps={deployedItps} />
              </div>
            </section>
          )}
        </main>
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
