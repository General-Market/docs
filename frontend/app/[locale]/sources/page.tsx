import type { Metadata } from 'next'
import SourcesPageClient from './SourcesPageClient'

export const metadata: Metadata = {
  title: 'Source Monitoring',
  description: 'Live health status of all data sources feeding market prices on General Market.',
}

export default function SourcesPage() {
  return <SourcesPageClient />
}
