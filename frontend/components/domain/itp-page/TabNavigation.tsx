'use client'

import { useState } from 'react'
import type { TabId, SectionId, ItpPageConfig } from '@/lib/itp-page-config'
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

const TAB_IDS: TabId[] = ['overview', 'performance', 'key-facts', 'holdings']

const TAB_LABELS: Record<TabId, string> = {
  overview: 'Overview',
  performance: 'Performance',
  'key-facts': 'Key Facts',
  holdings: 'Holdings',
}

interface Props {
  config: ItpPageConfig
  sectionProps: SectionProps
}

export function TabNavigation({ config, sectionProps }: Props) {
  const [activeTab, setActiveTab] = useState<TabId>('overview')

  const handleKeyDown = (e: React.KeyboardEvent, index: number) => {
    if (e.key === 'ArrowRight' && index < TAB_IDS.length - 1) {
      setActiveTab(TAB_IDS[index + 1])
    } else if (e.key === 'ArrowLeft' && index > 0) {
      setActiveTab(TAB_IDS[index - 1])
    } else if (e.key === 'Home') {
      setActiveTab(TAB_IDS[0])
    } else if (e.key === 'End') {
      setActiveTab(TAB_IDS[TAB_IDS.length - 1])
    }
  }

  return (
    <>
      {/* Tab bar — NOT sticky, scrolls with page */}
      <div className="border-b border-border-light mb-8">
        <div role="tablist" className="flex gap-0 overflow-x-auto">
          {TAB_IDS.map((id, index) => (
            <button
              key={id}
              role="tab"
              aria-selected={activeTab === id}
              aria-controls={`tabpanel-${id}`}
              tabIndex={activeTab === id ? 0 : -1}
              onClick={() => setActiveTab(id)}
              onKeyDown={(e) => handleKeyDown(e, index)}
              className={`px-6 py-3 text-sm font-semibold whitespace-nowrap transition-colors focus:outline-none focus:ring-2 focus:ring-inset focus:ring-text-primary ${
                activeTab === id
                  ? 'border-b-2 border-text-primary text-text-primary'
                  : 'text-text-muted hover:text-text-secondary'
              }`}
            >
              {TAB_LABELS[id]}
            </button>
          ))}
        </div>
      </div>

      {/* Tab panel — min height prevents layout jump */}
      <div
        id={`tabpanel-${activeTab}`}
        role="tabpanel"
        aria-labelledby={`tab-${activeTab}`}
        className="min-h-[400px]"
      >
        {config.tabs[activeTab].map((sectionId, i) => {
          const Section = REGISTRY[sectionId]
          if (!Section) return null
          return (
            <div key={sectionId}>
              {i > 0 && <hr className="border-border-light my-8" />}
              <Section {...sectionProps} />
            </div>
          )
        })}
      </div>
    </>
  )
}
