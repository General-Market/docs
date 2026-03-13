'use client'

import { useState, useEffect, useRef } from 'react'
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

// Anchor nav labels
const NAV_ITEMS = [
  { id: 'overview', label: 'Overview' },
  { id: 'performance', label: 'Performance' },
  { id: 'holdings', label: 'Holdings' },
  { id: 'key-facts', label: 'Key Facts' },
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
  const [activeAnchor, setActiveAnchor] = useState('overview')
  const navRef = useRef<HTMLDivElement>(null)

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

  const scrollTo = (id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  return (
    <>
      {/* Sticky anchor nav */}
      <div ref={navRef} className="sticky top-16 z-10 bg-white border-b border-border-light mb-8">
        <div role="navigation" aria-label="Page sections" className="flex gap-0 overflow-x-auto">
          {NAV_ITEMS.map(item => (
            <button
              key={item.id}
              onClick={() => scrollTo(item.id)}
              className={`px-6 py-3 text-sm font-semibold whitespace-nowrap transition-colors focus:outline-none focus:ring-2 focus:ring-inset focus:ring-text-primary ${
                activeAnchor === item.id
                  ? 'border-b-2 border-text-primary text-text-primary'
                  : 'text-text-muted hover:text-text-secondary'
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>

      {/* All sections rendered in scroll order */}
      {(() => {
        let lastAnchor = ''
        return allSections.map(({ sectionId, anchorId }, i) => {
          const Section = REGISTRY[sectionId]
          if (!Section) return null
          // Place anchor id on first section of each group
          const showAnchor = anchorId !== lastAnchor
          lastAnchor = anchorId
          return (
            <div key={sectionId}>
              {i > 0 && <hr className="border-border-light my-8" />}
              {showAnchor && <div id={anchorId} className="scroll-mt-32" />}
              <Section {...sectionProps} />
            </div>
          )
        })
      })()}
    </>
  )
}
