import type { Metadata } from 'next'
import { QueryClient, dehydrate, HydrationBoundary } from '@tanstack/react-query'
import { Header } from '@/components/layout/Header'
import { Footer } from '@/components/layout/Footer'
import { SourceDetail } from '@/components/domain/vision/detail/SourceDetail'
import { getSourceDisplayServer } from '@/lib/vision/sources-server'
import { prefetchSourceSnapshot, prefetchBatchConfigBySource, prefetchSnapshotMeta, prefetchBatches, prefetchRounds, prefetchSourceHistory } from '@/lib/vision/prefetch'
import { toInternalId } from '@/lib/vision/source-ids'

// Legacy V1 source detail page — kept accessible for comparison/regression debugging.
// The live page lives at /source/[sourceId] and renders SourceDetailV2.
// This route is not indexed and not linked from anywhere in the app.

export const revalidate = 60

interface Props {
  params: Promise<{ locale: string; sourceId: string }>
}

export const metadata: Metadata = {
  title: 'Legacy Source View',
  robots: { index: false, follow: false },
}

export default async function LegacySourcePage({ params }: Props) {
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
    queryClient.prefetchQuery({
      queryKey: ['source-history', sourceId, 1],
      queryFn: () => prefetchSourceHistory(sourceId),
    }),
  ])

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <main className="min-h-screen bg-page flex flex-col">
        <Header />
        <div className="flex-1 overflow-x-clip">
          <SourceDetail sourceId={sourceId} initialSource={source} />
        </div>
        <Footer />
      </main>
    </HydrationBoundary>
  )
}
