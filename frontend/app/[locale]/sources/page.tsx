import type { Metadata } from 'next'
import { Header } from '@/components/layout/Header'
import { Footer } from '@/components/layout/Footer'
import SourcesPageClient from './SourcesPageClient'

export const metadata: Metadata = {
  title: 'Source Monitoring',
  description: 'Live health status of all data sources feeding market prices on General Market.',
}

export default function SourcesPage() {
  return (
    <main className="min-h-screen bg-page flex flex-col">
      <Header />
      <SourcesPageClient />
      <div className="flex-1" />
      <Footer />
    </main>
  )
}
