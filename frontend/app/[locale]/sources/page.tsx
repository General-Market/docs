import type { Metadata } from 'next'
import { VISION_SOURCES } from '@/lib/vision/sources'
import SourcesPageClient from './SourcesPageClient'

export const metadata: Metadata = {
  title: 'Data Source Health — Live Status | General Market',
  description: `Live health monitoring for ${VISION_SOURCES.length} data sources feeding prediction markets on General Market. Real-time status, asset counts, and update frequency.`,
  alternates: {
    canonical: '/sources',
  },
}

export default function SourcesPage() {
  const dataCatalogJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'DataCatalog',
    name: 'General Market Data Source Health Monitor',
    description: `Live health status of ${VISION_SOURCES.length} data sources feeding market prices on General Market.`,
    url: 'https://www.generalmarket.io/sources',
    creator: {
      '@type': 'Organization',
      name: 'General Market',
      url: 'https://www.generalmarket.io',
    },
  }

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(dataCatalogJsonLd) }}
      />
      <SourcesPageClient />
    </>
  )
}
