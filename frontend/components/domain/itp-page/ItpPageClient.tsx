'use client'

import { useState, useMemo } from 'react'
import { useItpNav } from '@/hooks/useItpNav'
import { getItpPageConfig } from '@/lib/itp-page-config'
import { HeroSection } from './HeroSection'
import { TabNavigation } from './TabNavigation'
import { KeyStatsBar } from './sections/KeyStatsBar'
import { RebalanceSection } from './RebalanceSection'
import { BuyItpModal } from '@/components/domain/BuyItpModal'
import type { ItpEnrichment } from '@/lib/itp-enrichment-types'

interface Props {
  itpId: string
  name: string
  symbol: string
  nav: number
  aum: number
  assetCount: number
  enrichment: ItpEnrichment | null
}

export function ItpPageClient({ itpId, name, symbol, nav: serverNav, aum, assetCount, enrichment }: Props) {
  const [buyModalOpen, setBuyModalOpen] = useState(false)
  const { navPerShare } = useItpNav(itpId)

  const nav = navPerShare > 0 ? navPerShare : serverNav
  const sinceInception = nav > 0 ? (nav - 1) * 100 : 0
  // Enrichment resolves all on-chain assets; data-node assets_total only counts priced ones
  const resolvedAssetCount = enrichment && enrichment.holdings.length > assetCount
    ? enrichment.holdings.length
    : assetCount

  const config = getItpPageConfig(itpId)

  const sectionProps = useMemo(() => ({
    itpId, name, symbol, nav, aum, assetCount: resolvedAssetCount, sinceInception, enrichment, createdAt: config.createdAt,
  }), [itpId, name, symbol, nav, aum, resolvedAssetCount, sinceInception, enrichment, config.createdAt])

  return (
    <>
      <HeroSection
        label={config.label}
        symbol={symbol}
        name={name}
        onBuy={() => setBuyModalOpen(true)}
      />

      <KeyStatsBar
        itpId={itpId}
        name={name}
        symbol={symbol}
        nav={nav}
        aum={aum}
        assetCount={resolvedAssetCount}
        sinceInception={sinceInception}
        enrichment={enrichment}
        createdAt={config.createdAt}
      />

      <TabNavigation
        config={config}
        sectionProps={sectionProps}
      />

      <RebalanceSection
        itpId={itpId}
        enrichment={enrichment}
      />

      {buyModalOpen && (
        <BuyItpModal
          itpId={itpId}
          onClose={() => setBuyModalOpen(false)}
        />
      )}
    </>
  )
}
