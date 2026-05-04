import type { Metadata } from 'next'
import { QueryClient, dehydrate, HydrationBoundary } from '@tanstack/react-query'
import { Header } from '@/components/layout/Header'
import { Footer } from '@/components/layout/Footer'
import { TopPlayers } from '@/components/domain/vision/detail/TopPlayers'
import { SourceSidebarApple } from '@/components/domain/vision/detail/SourceSidebarApple'
import { SourceTabNav } from '@/components/domain/vision/detail/SourceTabNav'
import { getSourceDisplayServer } from '@/lib/vision/sources-server'
import { getCategoryLabel } from '@/lib/vision/source-categories'
import { prefetchLeaderboard } from '@/lib/vision/prefetch'

// NOTE: TopPlayers does not accept a `fullList` prop — it renders top-5 by
// design (global leaderboard; per-source tracking is a future feature).
// Documented limitation: the wiring pass or a follow-up can extend TopPlayers
// to accept a `limit` prop and pass `Infinity` / a large number here.

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
    queryKey: ['vision-leaderboard'],
    queryFn: prefetchLeaderboard,
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
      <main className="min-h-screen bg-page flex flex-col">
        <Header />
        {jsonLd.map((ld, i) => (
          <script key={i} type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(ld) }} />
        ))}

        <div className="flex-1 overflow-x-clip">
          <div className="flex">
            <SourceSidebarApple sourceId={sourceId} category={source?.category} />
            <div className="flex-1 min-w-0 flex flex-col">
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
                </header>
                <TopPlayers sourceId={sourceId} />
              </div>
            </div>
          </div>
        </div>

        <Footer />
      </main>
    </HydrationBoundary>
  )
}
