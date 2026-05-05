import type { Metadata } from 'next'
import { QueryClient, dehydrate, HydrationBoundary } from '@tanstack/react-query'
import { AppShell } from '@/components/layout/AppShell'
import { SourceSearch } from '@/components/layout/SourceSearch'
import { SourceSidebarApple } from '@/components/domain/vision/detail/SourceSidebarApple'
import { SourceTabNav } from '@/components/domain/vision/detail/SourceTabNav'
import { AssetDetailView } from '@/components/domain/vision/detail/AssetDetailView'
import { getSourceDisplayServer } from '@/lib/vision/sources-server'
import { getCategoryLabel } from '@/lib/vision/source-categories'
import { prefetchSourceSnapshot } from '@/lib/vision/prefetch'
import { toInternalId } from '@/lib/vision/source-ids'

export const revalidate = 60

interface Props {
  params: Promise<{ locale: string; sourceId: string; assetId: string }>
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { sourceId, assetId } = await params
  const source = await getSourceDisplayServer(sourceId)
  const decoded = decodeURIComponent(assetId)
  const marketName = decoded.replace(/_/g, ' ')

  if (!source) return { title: 'Market Not Found' }

  const category = getCategoryLabel(source.category)
  const description = `${marketName} — price history on ${source.name}. ${category} on Vision.`

  return {
    title: `${marketName} | ${source.name} | Vision`,
    description,
    openGraph: {
      title: `${marketName} — ${source.name}`,
      description,
    },
    twitter: {
      card: 'summary_large_image',
      title: `${marketName} — ${source.name}`,
      description,
    },
  }
}

export default async function MarketPage({ params }: Props) {
  const { sourceId, assetId } = await params
  const source = await getSourceDisplayServer(sourceId)
  const decodedAssetId = decodeURIComponent(assetId)

  const queryClient = new QueryClient()
  const dataNodeId = toInternalId(sourceId)
  await Promise.allSettled([
    queryClient.prefetchQuery({
      queryKey: ['source-snapshot', dataNodeId],
      queryFn: () => prefetchSourceSnapshot(dataNodeId),
    }),
  ])

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <AppShell
        search={<SourceSearch />}
        sidebar={<SourceSidebarApple sourceId={sourceId} category={source?.category} />}
      >
        <div className="flex flex-col">
          <SourceTabNav sourceId={sourceId} activeTab="markets" />
          <div className="px-4 sm:px-6 lg:px-10 py-6 lg:py-10">
            <AssetDetailView
              sourceId={sourceId}
              dataNodeSourceId={dataNodeId}
              assetId={decodedAssetId}
              sourceName={source?.name ?? sourceId}
            />
          </div>
        </div>
      </AppShell>
    </HydrationBoundary>
  )
}
