import type { Metadata } from 'next'
import { getTranslations } from 'next-intl/server'
import { Header } from '@/components/layout/Header'
import { Footer } from '@/components/layout/Footer'
import { SourceDetail } from '@/components/domain/vision/detail/SourceDetail'
import { getSourceDisplayServer } from '@/lib/vision/sources-server'
import { getCategoryLabel } from '@/lib/vision/source-categories'

export const dynamic = 'force-dynamic'

interface Props {
  params: Promise<{ locale: string; sourceId: string }>
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale, sourceId } = await params
  const [source, t] = await Promise.all([
    getSourceDisplayServer(sourceId),
    getTranslations({ locale, namespace: 'seo.pages.source_detail' }),
  ])

  if (!source) {
    return { title: t('title_not_found') }
  }

  const category = getCategoryLabel(source.category)
  const description = t('description', { name: source.name, count: source.prefixes.length, category })

  return {
    title: t('title', { name: source.name }),
    description,
    openGraph: {
      title: t('og_title', { name: source.name }),
      description,
    },
  }
}

export default async function SourcePage({ params }: Props) {
  const { locale, sourceId } = await params
  const [source, tBreadcrumbs] = await Promise.all([
    getSourceDisplayServer(sourceId),
    getTranslations({ locale, namespace: 'seo.breadcrumbs' }),
  ])

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
        { '@type': 'ListItem', position: 1, name: tBreadcrumbs('home'), item: 'https://www.generalmarket.io' },
        { '@type': 'ListItem', position: 2, name: tBreadcrumbs('data_sources'), item: 'https://www.generalmarket.io/sources' },
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
      <div className="flex-1 overflow-x-clip">
        <SourceDetail sourceId={sourceId} initialSource={source} />
      </div>
      <Footer />
    </main>
  )
}
