import type { ItpEnrichment } from '@/lib/itp-enrichment-types'

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
  createdAt?: string
}
