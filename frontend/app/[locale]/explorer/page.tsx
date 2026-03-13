import type { Metadata } from 'next'
import { Header } from '@/components/layout/Header'
import { Footer } from '@/components/layout/Footer'
import ExplorerPageClient from './ExplorerPageClient'

export const metadata: Metadata = {
  title: 'Explorer — Issuer Network',
  description: 'Real-time monitoring of the issuer consensus network.',
}

export default function ExplorerPage() {
  return (
    <>
      <Header />
      <ExplorerPageClient />
      <Footer />
    </>
  )
}
