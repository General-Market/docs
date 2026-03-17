'use client'

import { useState, useCallback, useEffect, useRef } from 'react'
import dynamic from 'next/dynamic'
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

/* ── Icons — monoline, 18px, institutional ── */
const icons: Record<string, React.ReactNode> = {
  markets: (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 13V9" /><path d="M7 13V5" /><path d="M11 13V8" /><path d="M15 13V3" />
    </svg>
  ),
  portfolio: (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="5" width="14" height="10" rx="1.5" /><path d="M6 5V3.5A1.5 1.5 0 017.5 2h3A1.5 1.5 0 0112 3.5V5" />
    </svg>
  ),
  create: (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="9" cy="9" r="7" /><path d="M9 6v6" /><path d="M6 9h6" />
    </svg>
  ),
  lend: (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="7" width="14" height="9" rx="1.5" /><path d="M4 7V5a5 5 0 0110 0v2" /><circle cx="9" cy="11.5" r="1.5" />
    </svg>
  ),
  backtest: (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="9" cy="9" r="7" /><path d="M9 5v4l2.5 2.5" />
    </svg>
  ),
  system: (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="9" cy="9" r="2.5" /><path d="M9 2v2" /><path d="M9 14v2" /><path d="M2 9h2" /><path d="M14 9h2" /><path d="M4.05 4.05l1.41 1.41" /><path d="M12.54 12.54l1.41 1.41" /><path d="M4.05 13.95l1.41-1.41" /><path d="M12.54 5.46l1.41-1.41" />
    </svg>
  ),
  'ap-feed': (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M2 9h2l2-5 3 10 2.5-7L14 9h2" />
    </svg>
  ),
}

const NAV_ITEMS = [
  { id: 'markets', label: 'Markets' },
  { id: 'portfolio', label: 'Portfolio' },
  { id: 'create', label: 'Create' },
  { id: 'lend', label: 'Lend' },
  { id: 'backtest', label: 'Backtest' },
  { id: 'system', label: 'System' },
]

const SECTION_IDS = NAV_ITEMS.map(n => n.id)

export function HomeClient() {
  const { capture } = usePostHogTracker()
  const [activeSection, setActiveSection] = useState('markets')
  const [deployHoldings, setDeployHoldings] = useState<{ symbol: string; weight: number }[] | null>(null)
  const [deployedItps, setDeployedItps] = useState<DeployedItpRef[]>([])
  const [rebalanceModal, setRebalanceModal] = useState<{
    itpId: string; name: string; holdings: { symbol: string; weight: number }[]
  } | null>(null)
  const isScrollingRef = useRef(false)

  useSectionTimeTracker(SECTION_IDS)

  // IntersectionObserver — track which section is visible
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (isScrollingRef.current) return
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setActiveSection(entry.target.id)
          }
        }
      },
      { rootMargin: '-30% 0px -60% 0px' }
    )

    for (const id of SECTION_IDS) {
      const el = document.getElementById(id)
      if (el) observer.observe(el)
    }

    return () => observer.disconnect()
  }, [])

  const scrollTo = useCallback((id: string) => {
    setActiveSection(id)
    capture('section_navigated', { section_name: id })
    isScrollingRef.current = true
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' })
    // Re-enable observer after scroll settles
    setTimeout(() => { isScrollingRef.current = false }, 800)
  }, [capture])

  const handleDeployIndex = useCallback((holdings: { symbol: string; weight: number }[]) => {
    setDeployHoldings(holdings)
    scrollTo('create')
  }, [scrollTo])

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
        {/* ── Morpho sidebar — dark, permanent, desktop ── */}
        <aside className="hidden lg:flex flex-col w-[220px] shrink-0 bg-zinc-950 border-r border-white/[0.06] sticky top-16 h-[calc(100vh-64px)]">
          <nav className="flex-1 py-5 px-3 flex flex-col gap-0.5">
            {NAV_ITEMS.map((item) => (
              <button
                key={item.id}
                onClick={() => scrollTo(item.id)}
                className={`group flex items-center gap-3 px-3 py-2.5 rounded-md text-[13px] font-medium transition-all duration-200 text-left ${
                  activeSection === item.id
                    ? 'bg-white/[0.08] text-white'
                    : 'text-white/40 hover:text-white/70 hover:bg-white/[0.04]'
                }`}
              >
                <span className={`shrink-0 transition-all duration-200 ${
                  activeSection === item.id ? 'text-white' : 'text-white/30 group-hover:text-white/50'
                }`}>
                  {icons[item.id]}
                </span>
                {item.label}
              </button>
            ))}
          </nav>

          <div className="px-5 py-4 border-t border-white/[0.06]">
            <span className="text-[10px] font-mono text-white/20 uppercase tracking-[0.1em]">General Market</span>
          </div>
        </aside>

        {/* ── Mobile bottom bar ── */}
        <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-zinc-950 border-t border-white/[0.06] safe-area-bottom">
          <div className="flex items-center justify-around h-14 px-1">
            {NAV_ITEMS.map((item) => (
              <button
                key={item.id}
                onClick={() => scrollTo(item.id)}
                className={`flex flex-col items-center gap-1 px-2 py-1 rounded transition-all duration-200 min-w-0 ${
                  activeSection === item.id
                    ? 'text-white'
                    : 'text-white/30'
                }`}
              >
                <span className="shrink-0">{icons[item.id]}</span>
                <span className="text-[8px] font-semibold truncate">{item.label}</span>
              </button>
            ))}
          </div>
        </nav>

        {/* ── Main content — all sections, scroll-based ── */}
        <main className="flex-1 min-w-0 pb-16 lg:pb-0">
          <section id="markets">
            <ItpListing onItpsLoaded={handleItpsLoaded} />
          </section>

          <section id="portfolio" className="bg-surface border-t border-border-light">
            <div className="px-6 lg:px-12 py-10">
              <PortfolioSection expanded={true} onToggle={() => {}} deployedItps={deployedItps} />
            </div>
          </section>

          <section id="create" className="border-t border-border-light">
            <div className="px-6 lg:px-12 py-10">
              <CreateItpSection
                expanded={true}
                onToggle={() => {}}
                initialHoldings={deployHoldings}
              />
            </div>
          </section>

          <div className="section-divider" />

          <section id="lend" className="bg-surface">
            <div className="px-6 lg:px-12 py-8">
              <VaultModal inline onClose={() => {}} />
            </div>
          </section>

          <section id="backtest" className="border-t border-border-light">
            <div className="px-6 lg:px-12 py-10">
              <BacktestSection
                expanded={true}
                onToggle={() => {}}
                onDeployIndex={handleDeployIndex}
                deployedItps={deployedItps}
                onRebalanceItp={handleRebalanceItp}
              />
            </div>
          </section>

          <section id="system" className="bg-surface border-t border-border-light">
            <div className="px-6 lg:px-12 py-8 space-y-6">
              <SystemStatusSection deployedItps={deployedItps} />
              <div className="border-t border-border-medium" />
              <VaultTradesFeed deployedItps={deployedItps} />
            </div>
          </section>
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
