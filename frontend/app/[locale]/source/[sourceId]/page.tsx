import type { Metadata } from 'next'
import { Header } from '@/components/layout/Header'
import { Footer } from '@/components/layout/Footer'
import { SourceDetailCategoryNav } from '@/components/domain/vision/detail/SourceDetailCategoryNav'
import { SourceDetail } from '@/components/domain/vision/detail/SourceDetail'
import { getSource } from '@/lib/vision/sources'
import { getCategoryLabel } from '@/lib/vision/source-categories'

export const dynamic = 'force-dynamic'

interface Props {
  params: Promise<{ locale: string; sourceId: string }>
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { sourceId } = await params
  const source = getSource(sourceId)

  if (!source) {
    return { title: 'Source Not Found' }
  }

  const category = getCategoryLabel(source.category)
  const description = `${source.name} — live market data feed with ${source.prefixes.length} market series. Category: ${category}. Trade predictions on Vision.`

  return {
    title: `${source.name} | Vision`,
    description,
    openGraph: {
      title: `${source.name} — Vision Data Source`,
      description,
    },
  }
}

export default async function SourcePage({ params }: Props) {
  const { sourceId } = await params
  const source = getSource(sourceId)

  const category = source ? getCategoryLabel(source.category) : undefined

  const jsonLd = source ? [
    {
      '@context': 'https://schema.org',
      '@type': 'Dataset',
      name: `${source.name} — Vision Market Data`,
      description: `Live prediction market data feed for ${source.name}. ${source.prefixes.length} market series in the ${category} category. Updated in real-time on Vision (General Market).`,
      creator: {
        '@type': 'Organization',
        name: 'General Market',
        url: 'https://www.generalmarket.io',
      },
      temporalCoverage: '2025/..',
      license: 'https://www.generalmarket.io/terms',
      keywords: [source.name, category, 'prediction market', 'market data', 'Vision'],
    },
    {
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'Home', item: 'https://www.generalmarket.io' },
        { '@type': 'ListItem', position: 2, name: 'Data Sources', item: 'https://www.generalmarket.io/sources' },
        { '@type': 'ListItem', position: 3, name: source.name },
      ],
    },
  ] : []

  return (
    <main className="min-h-screen bg-page flex flex-col">
      <Header />
      {jsonLd.map((ld, i) => (
        <script key={i} type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(ld) }} />
      ))}
      {source && <SourceDetailCategoryNav sourceCategory={source.category} />}
      <div className="flex-1 overflow-x-clip">
        <SourceDetail sourceId={sourceId} />
      </div>
      <Footer />
    </main>
  )
}
