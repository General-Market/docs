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

  return (
    <>
      {/* Tab bar — NOT sticky, scrolls with page */}
      <div className="border-b border-gray-200 mb-8">
        <div className="flex gap-0 overflow-x-auto">
          {(Object.keys(TAB_LABELS) as TabId[]).map(id => (
            <button
              key={id}
              onClick={() => setActiveTab(id)}
              className={`px-6 py-3 text-sm font-semibold whitespace-nowrap transition-colors ${
                activeTab === id
                  ? 'border-b-2 border-gray-900 text-gray-900'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              {TAB_LABELS[id]}
            </button>
          ))}
        </div>
      </div>

      {/* Tab panel — min height prevents layout jump */}
      <div className="min-h-[400px]">
        {config.tabs[activeTab].map((sectionId, i) => {
          const Section = REGISTRY[sectionId]
          if (!Section) return null
          return (
            <div key={sectionId}>
              {i > 0 && <hr className="border-gray-200 my-8" />}
              <Section {...sectionProps} />
            </div>
          )
        })}
      </div>
    </>
  )
}
