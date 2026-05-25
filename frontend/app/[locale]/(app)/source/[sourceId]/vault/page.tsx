import type { Metadata } from 'next'
import { QueryClient, dehydrate, HydrationBoundary } from '@tanstack/react-query'
import { AppShell } from '@/components/layout/AppShell'
import { SourceSearch } from '@/components/layout/SourceSearch'
import { SourceSidebarApple } from '@/components/domain/vision/detail/SourceSidebarApple'
import { SourceTabNav } from '@/components/domain/vision/detail/SourceTabNav'
import { FeaturedVaultHero } from '@/components/domain/vision/detail/FeaturedVaultHero'
import { VaultShowcase } from '@/components/domain/vision/detail/VaultShowcase'
import { getSourceDisplayServer } from '@/lib/vision/sources-server'
import { getCategoryLabel } from '@/lib/vision/source-categories'
import { hasVaultForSource } from '@/lib/vision/sources-vaults'
import { prefetchSourceSnapshot, prefetchBatchConfigBySource, prefetchSnapshotMeta } from '@/lib/vision/prefetch'
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
  const title = `${source.name} · Vault | Vision`
  const description = `Vaults running strategies on the ${source.name} data source. Category: ${category}.`
  const path = `/source/${sourceId}/vault`

  return {
    title,
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
      title,
      description,
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
    },
    keywords: [source.name, category, 'vault', 'strategy', 'Vision', 'General Market'],
  }
}

export default async function SourceVaultPage({ params }: Props) {
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
  ])

  const hasVault = hasVaultForSource(sourceId)

  const jsonLd = source
    ? [
        {
          '@context': 'https://schema.org',
          '@type': 'BreadcrumbList',
          itemListElement: [
            { '@type': 'ListItem', position: 1, name: 'Home', item: 'https://www.generalmarket.io' },
            { '@type': 'ListItem', position: 2, name: 'Data Sources', item: 'https://www.generalmarket.io/sources' },
            { '@type': 'ListItem', position: 3, name: source.name, item: `https://www.generalmarket.io/source/${sourceId}` },
            { '@type': 'ListItem', position: 4, name: 'Vault' },
          ],
        },
      ]
    : []

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      {jsonLd.map((ld, i) => (
        <script key={i} type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(ld) }} />
      ))}
      <AppShell
        search={<SourceSearch />}
        sidebar={<SourceSidebarApple sourceId={sourceId} category={source?.category} />}
      >
        <div className="flex flex-col">
          <SourceTabNav sourceId={sourceId} activeTab="vault" />
          <div className="px-4 sm:px-6 lg:px-10 py-6 lg:py-10">
            <header className="mb-8">
              <h1
                style={{
                  fontFamily: 'var(--apple-font-display)',
                  fontSize: 'clamp(32px, 3.5vw, 40px)',
                  letterSpacing: 'var(--apple-track-tighter)',
                  lineHeight: 1.1,
                  fontWeight: 600,
                  color: 'var(--apple-text)',
                  margin: 0,
                }}
              >
                {source?.name ? `${source.name} vaults` : 'Vaults'}
              </h1>
              <p
                className="mt-2"
                style={{
                  fontFamily: 'var(--apple-font-text)',
                  fontSize: 'var(--apple-fs-17)',
                  letterSpacing: 'var(--apple-track-tight)',
                  color: 'var(--apple-text-secondary)',
                }}
              >
                Strategies that trade this source on your behalf.
              </p>
            </header>

            {hasVault ? (
              <div className="flex flex-col gap-6">
                <FeaturedVaultHero sourceId={sourceId} />
                <VaultShowcase sourceId={sourceId} />
              </div>
            ) : (
              <p
                style={{
                  fontFamily: 'var(--apple-font-text)',
                  fontSize: 'var(--apple-fs-17)',
                  letterSpacing: 'var(--apple-track-tight)',
                  color: 'var(--apple-text-secondary)',
                }}
              >
                No vault for this source yet.
              </p>
            )}
          </div>
        </div>
      </AppShell>
    </HydrationBoundary>
  )
}
