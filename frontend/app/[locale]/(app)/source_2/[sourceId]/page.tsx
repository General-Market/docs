import type { Metadata } from 'next'
import { QueryClient, dehydrate, HydrationBoundary } from '@tanstack/react-query'
import { Header } from '@/components/layout/Header'
import { Footer } from '@/components/layout/Footer'
import { SourceDetailV2 } from '@/components/domain/vision/detail/SourceDetailV2'
import { getSourceDisplayServer } from '@/lib/vision/sources-server'
import { getCategoryLabel } from '@/lib/vision/source-categories'
import { prefetchSourceSnapshot, prefetchBatchConfigBySource, prefetchSnapshotMeta, prefetchBatches, prefetchRounds } from '@/lib/vision/prefetch'
import { toInternalId } from '@/lib/vision/source-ids'

export const revalidate = 60

interface Props {
  params: Promise<{ locale: string; sourceId: string }>
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { sourceId } = await params
  const source = await getSourceDisplayServer(sourceId)

  if (!source) {
    return { title: 'Source Not Found' }
  }

  const category = getCategoryLabel(source.category)
  const prefixCount = source.prefixes?.length ?? 0
  const description = `${source.name} — ${prefixCount} prediction markets across ${category}. Place bets, track results, deploy strategies on Vision.`
  const path = `/source_2/${sourceId}`

  return {
    title: `${source.name} | Vision`,
    description,
    alternates: {
      canonical: path,
      languages: {
        en: path,
        ko: `/ko${path}`,
        ja: `/ja${path}`,
        zh: `/zh${path}`,
        'x-default': path,
      },
    },
    openGraph: {
      title: `${source.name} — Prediction Markets | Vision`,
      description,
    },
    twitter: {
      card: 'summary_large_image',
      title: `${source.name} — Vision`,
      description,
    },
    keywords: [source.name, category, 'prediction market', 'market data', 'Vision', 'General Market'],
  }
}

export default async function SourceV2Page({ params }: Props) {
  const { sourceId } = await params
  const source = await getSourceDisplayServer(sourceId)

  const queryClient = new QueryClient()
  const dataNodeId = toInternalId(sourceId)
  await Promise.allSettled([
    queryClient.prefetchQuery({
      queryKey: ['source-snapshot', dataNodeId],
      queryFn: () => prefetchSourceSnapshot(dataNodeId),
    }),
    queryClient.prefetchQuery({
      queryKey: ['batch-config-source', sourceId],
      queryFn: () => prefetchBatchConfigBySource(sourceId),
    }),
    queryClient.prefetchQuery({
      queryKey: ['market-snapshot-meta'],
      queryFn: prefetchSnapshotMeta,
    }),
    queryClient.prefetchQuery({
      queryKey: ['vision-batches'],
      queryFn: prefetchBatches,
    }),
    queryClient.prefetchQuery({
      queryKey: ['vision-rounds', sourceId],
      queryFn: () => prefetchRounds(sourceId),
    }),
  ])

  const category = source ? getCategoryLabel(source.category) : undefined

  const jsonLd = source ? [
    {
      '@context': 'https://schema.org',
      '@type': 'Dataset',
      name: `${source.name} — Vision Prediction Markets`,
      description: `${source.prefixes?.length ?? 0} prediction markets for ${source.name} in the ${category} category. Bet on real outcomes, track results live.`,
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
    <HydrationBoundary state={dehydrate(queryClient)}>
      <main className="min-h-screen bg-page flex flex-col">
        <Header />
        {jsonLd.map((ld, i) => (
          <script key={i} type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(ld) }} />
        ))}
        <div className="flex-1 overflow-x-clip">
          <SourceDetailV2 sourceId={sourceId} initialSource={source} />
        </div>
        <Footer />
      </main>
    </HydrationBoundary>
  )
}
