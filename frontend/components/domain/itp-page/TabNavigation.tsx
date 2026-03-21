'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useTranslations } from 'next-intl'
import { SpringTabs, SpringTab } from '@/components/ui/spring'
import type { SectionId, ItpPageConfig } from '@/lib/itp-page-config'
import type { SectionProps } from './SectionRenderer'
import { KeyStatsBar } from './sections/KeyStatsBar'
import { PerformanceChart } from './sections/PerformanceChart'
import { HoldingsTable } from './sections/HoldingsTable'
import { PortfolioBreakdown } from './sections/PortfolioBreakdown'
import { ConcentrationMetrics } from './sections/ConcentrationMetrics'
import { FounderDemographics } from './sections/FounderDemographics'
import { DefiHealth } from './sections/DefiHealth'
import { FundingOverview } from './sections/FundingOverview'
import { FundFacts } from './sections/FundFacts'
import { TradeCta } from './sections/TradeCta'
import { InvestmentObjective } from './sections/InvestmentObjective'

const REGISTRY: Record<SectionId, React.ComponentType<SectionProps>> = {
  'key-stats': KeyStatsBar,
  'performance': PerformanceChart,
  'holdings': HoldingsTable,
  'breakdown': PortfolioBreakdown,
  'concentration': ConcentrationMetrics,
  'founders': FounderDemographics,
  'defi-health': DefiHealth,
  'funding': FundingOverview,
  'fund-facts': FundFacts,
  'trade-cta': TradeCta,
  'investment-objective': InvestmentObjective,
}

// Anchor nav label keys (resolved via i18n)
const NAV_ITEMS = [
  { id: 'overview', key: 'tabs.overview' },
  { id: 'performance', key: 'tabs.performance' },
  { id: 'holdings', key: 'tabs.holdings' },
  { id: 'key-facts', key: 'tabs.key_facts' },
] as const

// All sections in scroll order for each ITP type
function getAllSections(config: ItpPageConfig): { sectionId: SectionId; anchorId: string }[] {
  const result: { sectionId: SectionId; anchorId: string }[] = []
  // Overview sections
  for (const id of config.tabs.overview) result.push({ sectionId: id, anchorId: 'overview' })
  // Performance
  for (const id of config.tabs.performance) result.push({ sectionId: id, anchorId: 'performance' })
  // Holdings
  for (const id of config.tabs.holdings) result.push({ sectionId: id, anchorId: 'holdings' })
  // Key Facts
  for (const id of config.tabs['key-facts']) result.push({ sectionId: id, anchorId: 'key-facts' })
  return result
}

interface Props {
  config: ItpPageConfig
  sectionProps: SectionProps
}

export function TabNavigation({ config, sectionProps }: Props) {
  const t = useTranslations('markets.itp_page')
  const [activeAnchor, setActiveAnchor] = useState('overview')
  const navRef = useRef<HTMLDivElement>(null)
  const contentRef = useRef<HTMLDivElement>(null)
  const progBarRef = useRef<HTMLDivElement>(null)

  const allSections = getAllSections(config)

  // Observe which anchor section is in view
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setActiveAnchor(entry.target.id)
          }
        }
      },
      { rootMargin: '-20% 0px -60% 0px' }
    )

    for (const item of NAV_ITEMS) {
      const el = document.getElementById(item.id)
      if (el) observer.observe(el)
    }

    return () => observer.disconnect()
  }, [])

  // Scroll progress bar — direct DOM update, no state re-render
  useEffect(() => {
    const el = contentRef.current
    if (!el) return
    let ticking = false
    const onScroll = () => {
      if (ticking) return
      ticking = true
      requestAnimationFrame(() => {
        const rect = el.getBoundingClientRect()
        const top = -rect.top
        const total = rect.height - window.innerHeight
        const prog = total > 0 ? Math.max(0, Math.min(1, top / total)) : 0
        if (progBarRef.current) {
          progBarRef.current.style.width = `${prog * 100}%`
        }
        ticking = false
      })
    }
    window.addEventListener('scroll', onScroll, { passive: true })
    onScroll()
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  // Section reveal via IntersectionObserver on data-fade-in elements
  useEffect(() => {
    const el = contentRef.current
    if (!el) return
    const targets = el.querySelectorAll('[data-fade-in]')
    if (targets.length === 0) return
    const obs = new IntersectionObserver((entries) => {
      entries.forEach(e => {
        if (e.isIntersecting) {
          e.target.classList.add('is-visible')
          obs.unobserve(e.target)
        }
      })
    }, { threshold: 0.08, rootMargin: '0px 0px -40px 0px' })
    targets.forEach(t => obs.observe(t))
    return () => obs.disconnect()
  }, [allSections.length])

  const scrollTo = useCallback((id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }, [])

  return (
    <>
      {/* Sticky anchor nav with progress bar */}
      <div ref={navRef} className="sticky top-16 z-10 bg-white border-b border-border-light mb-8">
        {/* Scroll progress */}
        <div
          ref={progBarRef}
          className="absolute top-0 left-0 h-[2px] bg-black"
          style={{
            width: '0%',
            transition: 'width 80ms linear',
          }}
        />
        <SpringTabs className="flex gap-0 overflow-x-auto">
          {NAV_ITEMS.map(item => (
            <SpringTab
              key={item.id}
              isActive={activeAnchor === item.id}
              onClick={() => scrollTo(item.id)}
              className="px-6 py-3 text-sm font-semibold whitespace-nowrap transition-colors focus:outline-none focus:ring-2 focus:ring-inset focus:ring-text-primary"
              layoutId="itp-tab-indicator"
            >
              {t(item.key)}
            </SpringTab>
          ))}
        </SpringTabs>
      </div>

      {/* All sections rendered in scroll order — each reveals on scroll */}
      <div ref={contentRef}>
        {(() => {
          let lastAnchor = ''
          return allSections.map(({ sectionId, anchorId }, i) => {
            const Section = REGISTRY[sectionId]
            if (!Section) return null
            const showAnchor = anchorId !== lastAnchor
            lastAnchor = anchorId
            return (
              <div key={sectionId} data-fade-in style={{ '--stagger-delay': 0 } as React.CSSProperties}>
                {i > 0 && <hr className="border-border-light my-8" />}
                {showAnchor && <div id={anchorId} className="scroll-mt-32" />}
                <Section {...sectionProps} />
              </div>
            )
          })
        })()}
      </div>
    </>
  )
}
