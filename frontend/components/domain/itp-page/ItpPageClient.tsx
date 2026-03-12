'use client'

import { useItpNav } from '@/hooks/useItpNav'
import { useItpMetadata } from '@/hooks/useItpMetadata'
import { getItpPageConfig } from '@/lib/itp-page-config'
import { SectionRenderer } from './SectionRenderer'
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
  const { navPerShare } = useItpNav(itpId)
  const { metadata } = useItpMetadata(itpId as `0x${string}`)

  const nav = navPerShare > 0 ? navPerShare : serverNav
  const sinceInception = ((nav - 1) / 1) * 100

  const config = getItpPageConfig(itpId)

  return (
    <>
      {metadata?.description && (
        <p className="text-sm text-text-secondary leading-relaxed max-w-2xl mb-8">
          {metadata.description}
        </p>
      )}
      <SectionRenderer
        config={config}
        sectionProps={{ itpId, name, symbol, nav, aum, assetCount, sinceInception, enrichment }}
      />
    </>
  )
}
