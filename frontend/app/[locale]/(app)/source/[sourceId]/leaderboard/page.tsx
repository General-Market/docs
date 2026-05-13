import type { Metadata } from 'next'
import { QueryClient, dehydrate, HydrationBoundary } from '@tanstack/react-query'
import { AppShell } from '@/components/layout/AppShell'
import { SourceSearch } from '@/components/layout/SourceSearch'
import { LeaderboardApple } from '@/components/domain/vision/LeaderboardApple'
import { SourceSidebarApple } from '@/components/domain/vision/detail/SourceSidebarApple'
import { SourceTabNav } from '@/components/domain/vision/detail/SourceTabNav'
import { getSourceDisplayServer } from '@/lib/vision/sources-server'
import { getCategoryLabel } from '@/lib/vision/source-categories'
import { prefetchLeaderboard } from '@/lib/vision/prefetch'

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
  const title = `${source.name} · Leaderboard | Vision`
  const description = `Top traders on the ${source.name} data source. Category: ${category}.`
  const path = `/source/${sourceId}/leaderboard`

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
    keywords: [source.name, category, 'leaderboard', 'top traders', 'prediction market', 'Vision'],
  }
}

export default async function LeaderboardPage({ params }: Props) {
  const { sourceId } = await params
  const source = await getSourceDisplayServer(sourceId)

  const queryClient = new QueryClient()
  await queryClient.prefetchQuery({
    queryKey: ['vision-leaderboard', undefined, sourceId],
    queryFn: () => prefetchLeaderboard(sourceId),
  })

  const jsonLd = source
    ? [
        {
          '@context': 'https://schema.org',
          '@type': 'BreadcrumbList',
          itemListElement: [
            { '@type': 'ListItem', position: 1, name: 'Home', item: 'https://www.generalmarket.io' },
            { '@type': 'ListItem', position: 2, name: 'Data Sources', item: 'https://www.generalmarket.io/sources' },
            { '@type': 'ListItem', position: 3, name: source.name, item: `https://www.generalmarket.io/source/${sourceId}` },
            { '@type': 'ListItem', position: 4, name: 'Leaderboard' },
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
          <SourceTabNav sourceId={sourceId} activeTab="leaderboard" />
          <div className="px-4 sm:px-6 lg:px-10 py-6 lg:py-10 pb-16">
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
                Leaderboard
              </h1>
              {source && (
                <p
                  className="mt-3"
                  style={{
                    fontFamily: 'var(--apple-font-text)',
                    fontSize: 15,
                    lineHeight: 1.47,
                    letterSpacing: 'var(--apple-track-tight)',
                    color: 'var(--apple-text-secondary)',
                  }}
                >
                  Bots and vaults trading {source.name}. Nothing else.
                </p>
              )}
            </header>
            <LeaderboardApple sourceId={sourceId} />
          </div>
        </div>
      </AppShell>
    </HydrationBoundary>
  )
}
