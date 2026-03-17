'use client'

import { useState, useCallback } from 'react'
import { Header } from '@/components/layout/Header'
import { Footer } from '@/components/layout/Footer'
import { ItpListing, DeployedItpRef } from '@/components/domain/ItpListing'
import { PortfolioSection } from '@/components/domain/PortfolioSection'
import { CreateItpSection } from '@/components/domain/CreateItpSection'
import { VaultModal } from '@/components/domain/VaultModal'
import { BacktestSection } from '@/components/domain/simulation/BacktestSection'
import { RebalanceModal } from '@/components/domain/RebalanceModal'
import { SystemStatusSection } from '@/components/domain/SystemStatusSection'
import { VaultTradesFeed } from '@/components/domain/VaultTradesFeed'
import { useSectionTimeTracker } from '@/hooks/useSectionTimeTracker'
import { usePostHogTracker } from '@/hooks/usePostHog'

/* ── Icons — 16px monoline ── */
function IconMarkets({ active }: { active: boolean }) {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={active ? '1.75' : '1.25'} strokeLinecap="round" strokeLinejoin="round">
      <path d="M2 12V8" /><path d="M5.5 12V4" /><path d="M9 12V7" /><path d="M12.5 12V2.5" />
    </svg>
  )
}
function IconPortfolio({ active }: { active: boolean }) {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={active ? '1.75' : '1.25'} strokeLinecap="round" strokeLinejoin="round">
      <rect x="1.5" y="4.5" width="13" height="9" rx="1.5" /><path d="M5 4.5V3a2 2 0 012-2h2a2 2 0 012 2v1.5" />
    </svg>
  )
}
function IconCreate({ active }: { active: boolean }) {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={active ? '1.75' : '1.25'} strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="2" width="12" height="12" rx="2" /><path d="M8 5v6" /><path d="M5 8h6" />
    </svg>
  )
}
function IconLend({ active }: { active: boolean }) {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={active ? '1.75' : '1.25'} strokeLinecap="round" strokeLinejoin="round">
      <rect x="1.5" y="6" width="13" height="8.5" rx="1.5" /><path d="M4 6V4.5a4 4 0 018 0V6" /><circle cx="8" cy="10.5" r="1.25" />
    </svg>
  )
}
function IconBacktest({ active }: { active: boolean }) {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={active ? '1.75' : '1.25'} strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 2.5v3h3" /><path d="M3 5.5A5.5 5.5 0 1 1 2.5 9" />
    </svg>
  )
}
function IconSystem({ active }: { active: boolean }) {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={active ? '1.75' : '1.25'} strokeLinecap="round" strokeLinejoin="round">
      <path d="M2 4h12" /><path d="M2 8h12" /><path d="M2 12h12" /><circle cx="10" cy="4" r="1.5" fill="currentColor" /><circle cx="5" cy="8" r="1.5" fill="currentColor" /><circle cx="11" cy="12" r="1.5" fill="currentColor" />
    </svg>
  )
}

const ICON_MAP: Record<string, (props: { active: boolean }) => React.ReactNode> = {
  markets: IconMarkets,
  portfolio: IconPortfolio,
  create: IconCreate,
  lend: IconLend,
  backtest: IconBacktest,
  system: IconSystem,
}

type NavGroup = {
  label: string
  items: { id: string; label: string }[]
}

const NAV_GROUPS: NavGroup[] = [
  {
    label: 'Core',
    items: [
      { id: 'markets', label: 'Markets' },
      { id: 'portfolio', label: 'Portfolio' },
      { id: 'create', label: 'Create Index' },
    ],
  },
  {
    label: 'Tools',
    items: [
      { id: 'lend', label: 'Lending' },
      { id: 'backtest', label: 'Backtesting' },
    ],
  },
  {
    label: 'Monitoring',
    items: [
      { id: 'system', label: 'System' },
    ],
  },
]

const ALL_SECTION_IDS = NAV_GROUPS.flatMap(g => g.items.map(i => i.id))

export function HomeClient() {
  const { capture } = usePostHogTracker()
  const [activeSection, setActiveSection] = useState('markets')
  const [deployHoldings, setDeployHoldings] = useState<{ symbol: string; weight: number }[] | null>(null)
  const [deployedItps, setDeployedItps] = useState<DeployedItpRef[]>([])
  const [rebalanceModal, setRebalanceModal] = useState<{
    itpId: string; name: string; holdings: { symbol: string; weight: number }[]
  } | null>(null)

  useSectionTimeTracker(ALL_SECTION_IDS)

  const switchTo = useCallback((id: string) => {
    setActiveSection(id)
    capture('section_navigated', { section_name: id })
    // Scroll main content to top on tab switch
    window.scrollTo({ top: 0 })
  }, [capture])

  const handleDeployIndex = useCallback((holdings: { symbol: string; weight: number }[]) => {
    setDeployHoldings(holdings)
    switchTo('create')
  }, [switchTo])

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
        {/* ── Sidebar — desktop ── */}
        <aside className="hidden lg:flex flex-col w-[240px] shrink-0 bg-zinc-950 border-r border-white/[0.06] sticky top-16 h-[calc(100vh-64px)] select-none">
          <nav className="flex-1 pt-6 pb-4 flex flex-col">
            {NAV_GROUPS.map((group, gi) => (
              <div key={group.label} className={gi > 0 ? 'mt-2' : ''}>
                {/* Group label */}
                <div className="px-6 mb-2">
                  <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-white/20">
                    {group.label}
                  </span>
                </div>

                {/* Items */}
                <div className="px-3 space-y-px">
                  {group.items.map((item) => {
                    const isActive = activeSection === item.id
                    const Icon = ICON_MAP[item.id]
                    return (
                      <button
                        key={item.id}
                        onClick={() => switchTo(item.id)}
                        className={`group relative w-full flex items-center gap-3 pl-4 pr-3 py-[9px] rounded text-[13px] transition-all duration-200 text-left ${
                          isActive
                            ? 'bg-white/[0.07] text-white font-semibold'
                            : 'text-white/40 hover:text-white/70 hover:bg-white/[0.03]'
                        }`}
                      >
                        {/* Left accent */}
                        <span
                          className={`absolute left-0 top-1/2 -translate-y-1/2 w-[2px] rounded-full transition-all duration-200 ${
                            isActive ? 'h-5 bg-[#00A36C]' : 'h-0 bg-transparent'
                          }`}
                        />
                        <span className={`shrink-0 transition-colors duration-200 ${
                          isActive ? 'text-white' : 'text-white/25 group-hover:text-white/50'
                        }`}>
                          {Icon && <Icon active={isActive} />}
                        </span>
                        <span className="truncate">{item.label}</span>
                      </button>
                    )
                  })}
                </div>

                {/* Divider between groups */}
                {gi < NAV_GROUPS.length - 1 && (
                  <div className="mx-5 mt-3 border-t border-white/[0.06]" />
                )}
              </div>
            ))}
          </nav>

          {/* Bottom */}
          <div className="px-6 py-4 border-t border-white/[0.06]">
            <div className="flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-[#00A36C]" />
              <span className="text-[10px] font-mono text-white/30 tracking-wide">Index L3</span>
            </div>
          </div>
        </aside>

        {/* ── Mobile bottom bar ── */}
        <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-zinc-950/95 backdrop-blur-sm border-t border-white/[0.06] safe-area-bottom">
          <div className="flex items-center justify-around h-[56px] px-1">
            {NAV_GROUPS.flatMap(g => g.items).map((item) => {
              const isActive = activeSection === item.id
              const Icon = ICON_MAP[item.id]
              return (
                <button
                  key={item.id}
                  onClick={() => switchTo(item.id)}
                  className={`flex flex-col items-center justify-center gap-[3px] px-1 py-1 min-w-0 transition-all duration-200 ${
                    isActive ? 'text-white' : 'text-white/25'
                  }`}
                >
                  {Icon && <Icon active={isActive} />}
                  <span className={`text-[8px] font-semibold truncate ${isActive ? 'text-white' : 'text-white/30'}`}>
                    {item.label}
                  </span>
                </button>
              )
            })}
          </div>
        </nav>

        {/* ── Main — all sections preloaded, only active is visible ── */}
        <main className="flex-1 min-w-0 pb-16 lg:pb-0">
          <div className={activeSection === 'markets' ? '' : 'hidden'}>
            <ItpListing onItpsLoaded={handleItpsLoaded} />
          </div>

          <div className={activeSection === 'portfolio' ? '' : 'hidden'}>
            <div className="px-6 lg:px-12 py-8">
              <PortfolioSection expanded={true} onToggle={() => {}} deployedItps={deployedItps} />
            </div>
          </div>

          <div className={activeSection === 'create' ? '' : 'hidden'}>
            <div className="px-6 lg:px-12 py-8">
              <CreateItpSection
                expanded={true}
                onToggle={() => {}}
                initialHoldings={deployHoldings}
              />
            </div>
          </div>

          <div className={activeSection === 'lend' ? '' : 'hidden'}>
            <div className="px-6 lg:px-12 py-8">
              <VaultModal inline onClose={() => {}} />
            </div>
          </div>

          <div className={activeSection === 'backtest' ? '' : 'hidden'}>
            <div className="px-6 lg:px-12 py-8">
              <BacktestSection
                expanded={true}
                onToggle={() => {}}
                onDeployIndex={handleDeployIndex}
                deployedItps={deployedItps}
                onRebalanceItp={handleRebalanceItp}
              />
            </div>
          </div>

          <div className={activeSection === 'system' ? '' : 'hidden'}>
            <div className="px-6 lg:px-12 py-8 space-y-8">
              <SystemStatusSection deployedItps={deployedItps} />
              <div className="border-t border-border-medium" />
              <VaultTradesFeed deployedItps={deployedItps} />
            </div>
          </div>
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
