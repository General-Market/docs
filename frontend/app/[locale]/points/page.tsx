import type { Metadata } from 'next'
import PointsPageClient from './PointsPageClient'

export const metadata: Metadata = {
  title: 'Points — Season 1',
  description: 'Earn points by providing liquidity across Vision prediction batches. Points convert to tokens at end of season.',
}

export default function PointsPage() {
  return <PointsPageClient />
}
