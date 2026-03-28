'use client'

import { useState, useCallback, useRef, useEffect, useMemo } from 'react'
import { motion, LayoutGroup } from 'framer-motion'
import { Header } from '@/components/layout/Header'
import { Footer } from '@/components/layout/Footer'
import { ItpListing, DeployedItpRef } from '@/components/domain/ItpListing'
import { PortfolioSection } from '@/components/domain/PortfolioSection'
import { CreateItpSection } from '@/components/domain/CreateItpSection'
import { LendingPage } from '@/components/lending/LendingPage'
import { BacktestSection } from '@/components/domain/simulation/BacktestSection'
import { RebalanceModal } from '@/components/domain/RebalanceModal'
import { SystemStatusSection } from '@/components/domain/SystemStatusSection'
import { VaultTradesFeed } from '@/components/domain/VaultTradesFeed'
import { useTranslations } from 'next-intl'
import { useRouter } from 'next/navigation'
import { useSectionTimeTracker } from '@/hooks/useSectionTimeTracker'
import { usePostHogTracker } from '@/hooks/usePostHog'
import { usePrefersReducedMotion } from '@/hooks/useMediaQueries'

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

const NAV_SECTION_IDS = ['markets', 'portfolio', 'create', 'lend', 'backtest', 'system']

/* ── Motion springs — theatrical ── */
const SPRING_BLOB = { type: 'spring' as const, stiffness: 170, damping: 22, mass: 0.8 }
const SPRING_ACCENT = { type: 'spring' as const, stiffness: 250, damping: 25 }
const INSTANT = { duration: 0 }

export function HomeClient() {
  const t = useTranslations('pages')
  const { capture } = usePostHogTracker()
  const reduced = usePrefersReducedMotion()
  const router = useRouter()

  const NAV_GROUPS: NavGroup[] = useMemo(() => [
    {
      label: t('home.nav_group_core'),
      items: [
        { id: 'markets', label: t('home.nav_markets') },
        { id: 'portfolio', label: t('home.nav_portfolio') },
        { id: 'create', label: t('home.nav_create_index') },
      ],
    },
    {
      label: t('home.nav_group_tools'),
      items: [
        { id: 'lend', label: t('home.nav_lending') },
        { id: 'backtest', label: t('home.nav_backtesting') },
      ],
    },
    {
      label: t('home.nav_group_monitoring'),
      items: [
        { id: 'system', label: t('home.nav_system') },
      ],
    },
  ], [t])
  const [activeSection, setActiveSection] = useState('markets')
  const [exitingSection, setExitingSection] = useState<string | null>(null)
  const [direction, setDirection] = useState(1)
  const exitTimer = useRef<ReturnType<typeof setTimeout>>(undefined)
  const [deployHoldings, setDeployHoldings] = useState<{ symbol: string; weight: number }[] | null>(null)
  const [deployedItps, setDeployedItps] = useState<DeployedItpRef[]>([])
  const [rebalanceModal, setRebalanceModal] = useState<{
    itpId: string; name: string; holdings: { symbol: string; weight: number }[]
  } | null>(null)

  const sidebarLightRef = useRef<HTMLDivElement>(null)

  const handleSidebarMouseMove = useCallback((e: React.MouseEvent<HTMLElement>) => {
    if (reduced || !sidebarLightRef.current) return
    const rect = e.currentTarget.getBoundingClientRect()
    const x = e.clientX - rect.left
    const y = e.clientY - rect.top
    sidebarLightRef.current.style.background =
      `radial-gradient(300px circle at ${x}px ${y}px, rgba(255,255,255,0.06), transparent 70%)`
    sidebarLightRef.current.style.opacity = '1'
  }, [reduced])

  const handleSidebarMouseLeave = useCallback(() => {
    if (!sidebarLightRef.current) return
    sidebarLightRef.current.style.opacity = '0'
  }, [])

  useSectionTimeTracker(NAV_SECTION_IDS)

  useEffect(() => {
    return () => clearTimeout(exitTimer.current)
  }, [])

  useEffect(() => {
    const hash = window.location.hash.slice(1)
    if (hash && NAV_SECTION_IDS.includes(hash)) {
      setActiveSection(hash)
    }
  }, [])

  const switchTo = useCallback((id: string) => {
    if (id === 'system') {
      capture('section_navigated', { section_name: id })
      router.push('/explorer')
      return
    }
    if (id === activeSection) return
    const prevIdx = NAV_SECTION_IDS.indexOf(activeSection)
    const nextIdx = NAV_SECTION_IDS.indexOf(id)
    setDirection(nextIdx > prevIdx ? 1 : -1)
    setExitingSection(activeSection)
    setActiveSection(id)
    capture('section_navigated', { section_name: id })
    window.scrollTo({ top: 0 })
    clearTimeout(exitTimer.current)
    exitTimer.current = setTimeout(() => setExitingSection(null), reduced ? 0 : 650)
  }, [activeSection, capture, reduced, router])

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

  const sectionState = (id: string): 'active' | 'exiting' | 'hidden' => {
    if (id === activeSection) return 'active'
    if (id === exitingSection) return 'exiting'
    return 'hidden'
  }

  return (
    <>
      <Header />

      <div className="flex min-h-[calc(100vh-64px)]">
        {/* ── Sidebar — desktop ── */}
        <LayoutGroup id="nav-desktop">
          <aside
            onMouseMove={handleSidebarMouseMove}
            onMouseLeave={handleSidebarMouseLeave}
            className="hidden lg:flex flex-col w-[240px] shrink-0 bg-zinc-950 border-r border-white/[0.06] sticky top-16 h-[calc(100vh-64px)] select-none overflow-hidden"
          >
            {/* ── Cursor-tracked ambient light ── */}
            <div
              ref={sidebarLightRef}
              className="absolute inset-0 opacity-0 transition-opacity duration-500 pointer-events-none z-0"
            />

            <nav className="relative z-10 flex-1 pt-6 pb-4 flex flex-col">
              {NAV_GROUPS.map((group, gi) => (
                <div key={group.label} className={gi > 0 ? 'mt-2' : ''}>
                  {/* Group label — aligned with icon column */}
                  <div className="pl-7 pr-6 mb-2">
                    <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-white/55">
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
                          className={`group relative w-full flex items-center gap-3 pl-4 pr-3 py-[9px] rounded text-[13px] text-left ${
                            isActive
                              ? 'text-white font-semibold'
                              : 'text-white/75 hover:text-white hover:bg-white/[0.05]'
                          }`}
                        >
                          {/* ── Morphing blob background ── */}
                          {isActive && (
                            <motion.div
                              layoutId="nav-blob"
                              className="absolute inset-0 rounded bg-white/[0.07]"
                              transition={reduced ? INSTANT : SPRING_BLOB}
                              style={{ originX: 0.5, originY: 0.5 }}
                            />
                          )}

                          {/* ── Accent bar removed ── */}

                          <span className={`relative z-10 shrink-0 w-4 h-4 flex items-center justify-center transition-colors duration-200 ${
                            isActive ? 'text-white' : 'text-white/65 group-hover:text-white'
                          }`}>
                            {Icon && <Icon active={isActive} />}
                          </span>
                          <span className="relative z-10 truncate">{item.label}</span>
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
            <div className="relative z-10 px-6 py-4 border-t border-white/[0.06]">
              <div className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-[#00A36C]" />
                <span className="text-[10px] font-mono text-white/30 tracking-wide">Index L3</span>
              </div>
            </div>
          </aside>
        </LayoutGroup>

        {/* ── Mobile bottom bar — glass slider ── */}
        <LayoutGroup id="nav-mobile">
          <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-40 glass-nav shadow-[0_-4px_30px_rgba(0,0,0,0.08)] safe-area-bottom">
            <div className="flex items-center justify-center overflow-x-auto scrollbar-hide h-[60px] px-2 gap-1 snap-x snap-mandatory">
              {NAV_GROUPS.flatMap(g => g.items).map((item) => {
                const isActive = activeSection === item.id
                const Icon = ICON_MAP[item.id]
                return (
                  <button
                    key={item.id}
                    onClick={() => switchTo(item.id)}
                    className={`relative flex flex-col items-center justify-center gap-[3px] min-w-[64px] px-3 py-1.5 rounded-xl snap-center transition-all duration-200 ${
                      isActive
                        ? 'text-black'
                        : 'text-black/30 active:scale-95'
                    }`}
                  >
                    {/* ── Glass pill behind active tab ── */}
                    {isActive && (
                      <motion.div
                        layoutId="mobile-pill"
                        className="absolute inset-0 rounded-xl bg-black/[0.06] border border-black/[0.08]"
                        transition={reduced ? INSTANT : SPRING_ACCENT}
                      />
                    )}
                    <span className="relative z-10">
                      {Icon && <Icon active={isActive} />}
                    </span>
                    <span className={`relative z-10 text-[9px] font-semibold truncate max-w-[60px] ${
                      isActive ? 'text-black' : 'text-black/35'
                    }`}>
                      {item.label}
                    </span>
                  </button>
                )
              })}
            </div>
          </nav>
        </LayoutGroup>

        {/* ── Main — theatrical section transitions ── */}
        <main className="flex-1 min-w-0 pb-16 lg:pb-0 relative overflow-x-hidden">
          {NAV_SECTION_IDS.map((id) => {
            const state = sectionState(id)
            const isActive = state === 'active'
            const isExiting = state === 'exiting'
            const isVisible = isActive || isExiting

            return (
              <motion.div
                id={id}
                key={id}
                initial={false}
                custom={direction}
                animate={state}
                variants={{
                  active: {
                    opacity: 1,
                    y: 0,
                    scale: 1,
                    filter: 'blur(0px)',
                    transition: reduced ? INSTANT : {
                      opacity: { duration: 0.55, ease: [0.22, 1, 0.36, 1] },
                      y: { type: 'spring', stiffness: 120, damping: 18, mass: 0.8 },
                      scale: { type: 'spring', stiffness: 120, damping: 18, mass: 0.8 },
                      filter: { duration: 0.5 },
                    },
                  },
                  exiting: (dir: number) => ({
                    opacity: 0,
                    y: dir * -40,
                    scale: 0.97,
                    filter: 'blur(8px)',
                    transition: reduced ? INSTANT : {
                      opacity: { duration: 0.45, ease: [0.22, 1, 0.36, 1] },
                      y: { type: 'spring', stiffness: 100, damping: 18, mass: 0.8 },
                      scale: { duration: 0.4 },
                      filter: { duration: 0.35 },
                    },
                  }),
                  hidden: {
                    opacity: 0,
                    y: 0,
                    scale: 0.96,
                    filter: 'blur(8px)',
                    transition: INSTANT,
                  },
                }}
                className={isVisible ? '' : 'invisible h-0 overflow-hidden'}
                style={{
                  position: isActive ? 'relative' : 'absolute',
                  top: 0,
                  left: 0,
                  right: 0,
                  zIndex: isActive ? 1 : 0,
                  pointerEvents: isActive ? 'auto' : 'none',
                  willChange: isVisible ? 'transform, opacity, filter' : 'auto',
                }}
              >
                {id === 'markets' && <ItpListing onItpsLoaded={handleItpsLoaded} />}
                {id === 'portfolio' && (
                  <div className="px-6 lg:px-12 py-8">
                    <PortfolioSection expanded={true} onToggle={() => {}} deployedItps={deployedItps} />
                  </div>
                )}
                {id === 'create' && (
                  <div className="px-6 lg:px-12 py-8">
                    <CreateItpSection expanded={true} onToggle={() => {}} initialHoldings={deployHoldings} />
                  </div>
                )}
                {id === 'lend' && (
                  <div className="px-6 lg:px-12 py-8">
                    <LendingPage />
                  </div>
                )}
                {id === 'backtest' && (
                  <div className="px-6 lg:px-12 py-8">
                    <BacktestSection
                      expanded={true}
                      onToggle={() => {}}
                      onDeployIndex={handleDeployIndex}
                      deployedItps={deployedItps}
                      onRebalanceItp={handleRebalanceItp}
                    />
                  </div>
                )}
                {id === 'system' && (
                  <div className="px-6 lg:px-12 py-8 space-y-8">
                    <SystemStatusSection deployedItps={deployedItps} />
                    <div className="border-t border-border-medium" />
                    <VaultTradesFeed deployedItps={deployedItps} />
                  </div>
                )}
              </motion.div>
            )
          })}
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
