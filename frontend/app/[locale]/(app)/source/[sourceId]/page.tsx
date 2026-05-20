import type { Metadata } from 'next'
import { notFound, redirect } from 'next/navigation'
import { QueryClient, dehydrate, HydrationBoundary } from '@tanstack/react-query'
import { AppShell } from '@/components/layout/AppShell'
import { SourceSearch } from '@/components/layout/SourceSearch'
import { SourceSidebarApple } from '@/components/domain/vision/detail/SourceSidebarApple'
import { SourceDetailV2 } from '@/components/domain/vision/detail/SourceDetailV2'
import { SourceDetailHumanTrading } from '@/components/domain/vision/detail/SourceDetailHumanTrading'
import { HomeOnboardingCompass } from '@/components/domain/vision/HomeOnboardingCompass'
import { getSourceDisplayServer } from '@/lib/vision/sources-server'
import { getCategoryLabel } from '@/lib/vision/source-categories'
import { hasVaultForSource } from '@/lib/vision/sources-vaults'
import { prefetchSourceSnapshot, prefetchBatchConfigBySource, prefetchSnapshotMeta, prefetchBatches, prefetchRounds, prefetchSourceHistory } from '@/lib/vision/prefetch'
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
  const description = `${source.name} — live market data feed with ${prefixCount} market series. Category: ${category}. Trade predictions on Vision.`
  const path = `/source/${sourceId}`

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
      title: `${source.name} — Vision Data Source`,
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

// Legacy source IDs that have been split into more specific pages. The old
// /source/<id> URLs (shared links, bookmarks, search results) redirect to
// the new canonical destination instead of 404'ing.
const REDIRECTS: Record<string, string> = {
  defillama: 'defillama-tvl-all',
}

export default async function SourcePage({ params }: Props) {
  const { sourceId } = await params

  if (REDIRECTS[sourceId]) {
    redirect(`/source/${REDIRECTS[sourceId]}`)
  }

  // Sources without a vault are hidden from every UI listing. A direct
  // deep-link (old share, stale bookmark) shouldn't resurrect them as
  // an empty "no vault has stepped forward" placeholder — 404 instead.
  if (!hasVaultForSource(sourceId)) {
    notFound()
  }

  const source = await getSourceDisplayServer(sourceId)

  // Server-side prefetch: snapshot + batch config + meta in parallel.
  // Hydrated into React Query cache — client hooks find warm data on mount.
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
    queryClient.prefetchQuery({
      queryKey: ['source-history', sourceId, 1],
      queryFn: () => prefetchSourceHistory(sourceId),
    }),
  ])

  const category = source ? getCategoryLabel(source.category) : undefined

  const jsonLd = source ? [
    {
      '@context': 'https://schema.org',
      '@type': 'Dataset',
      name: `${source.name} — Vision Market Data`,
      description: `Live prediction market data feed for ${source.name}. ${source.prefixes?.length ?? 0} market series in the ${category} category. Updated in real-time on Vision (General Market).`,
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
      {jsonLd.map((ld, i) => (
        <script key={i} type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(ld) }} />
      ))}
      <AppShell
        search={<SourceSearch />}
        sidebar={<SourceSidebarApple sourceId={sourceId} category={source?.category} />}
      >
        <div className="overflow-x-clip">
          {source?.audience === 'human' ? (
            <SourceDetailHumanTrading sourceId={sourceId} initialSource={source} hideSidebar />
          ) : (
            <SourceDetailV2 sourceId={sourceId} initialSource={source} hideSidebar />
          )}
        </div>
        <HomeOnboardingCompass />
      </AppShell>
    </HydrationBoundary>
  )
}
