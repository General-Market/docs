import type { Metadata } from 'next'
import { Header } from '@/components/layout/Header'
import { Footer } from '@/components/layout/Footer'
import ExplorerPageClient from './ExplorerPageClient'

export const metadata: Metadata = {
  title: 'Explorer — Oracle Network',
  description: 'Real-time monitoring of the oracle consensus network.',
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
