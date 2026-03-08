import type { Metadata } from 'next'
import ExplorerPageClient from './ExplorerPageClient'

export const metadata: Metadata = {
  title: 'Explorer — Issuer Network',
  description: 'Real-time monitoring of the issuer consensus network.',
}

export default function ExplorerPage() {
  return <ExplorerPageClient />
}
