'use client'

import type { SectionId, ItpPageConfig } from '@/lib/itp-page-config'
import type { ItpEnrichment } from '@/lib/itp-enrichment-types'
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

// Every section receives the same props bag. Each decides what it needs.
export interface SectionProps {
  itpId: string
  name: string
  symbol: string
  nav: number
  aum: number
  assetCount: number
  sinceInception: number
  enrichment: ItpEnrichment | null
}

// Registry: SectionId → component
const REGISTRY: Record<SectionId, React.ComponentType<SectionProps>> = {
  'key-stats':      KeyStatsBar,
  'performance':    PerformanceChart,
  'holdings':       HoldingsTable,
  'breakdown':      PortfolioBreakdown,
  'concentration':  ConcentrationMetrics,
  'founders':       FounderDemographics,
  'defi-health':    DefiHealth,
  'funding':        FundingOverview,
  'fund-facts':     FundFacts,
  'trade-cta':      TradeCta,
}

interface Props {
  config: ItpPageConfig
  sectionProps: SectionProps
}

export function SectionRenderer({ config, sectionProps }: Props) {
  return (
    <div className="space-y-8">
      {config.sections.map(id => {
        const Section = REGISTRY[id]
        if (!Section) return null
        return <Section key={id} {...sectionProps} />
      })}
    </div>
  )
}
