'use client'

import { useState, useMemo } from 'react'
import { useItpNav } from '@/hooks/useItpNav'
import { getItpPageConfig } from '@/lib/itp-page-config'
import { HeroSection } from './HeroSection'
import { TabNavigation } from './TabNavigation'
import { KeyStatsBar } from './sections/KeyStatsBar'
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

  const config = getItpPageConfig(itpId)

  const sectionProps = useMemo(() => ({
    itpId, name, symbol, nav, aum, assetCount, sinceInception, enrichment, createdAt: config.createdAt,
  }), [itpId, name, symbol, nav, aum, assetCount, sinceInception, enrichment, config.createdAt])

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
        assetCount={assetCount}
        sinceInception={sinceInception}
        enrichment={enrichment}
        createdAt={config.createdAt}
      />

      <TabNavigation
        config={config}
        sectionProps={sectionProps}
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
