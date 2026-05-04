import type { Metadata } from 'next'
import { QueryClient, dehydrate, HydrationBoundary } from '@tanstack/react-query'
import { Header } from '@/components/layout/Header'
import { Footer } from '@/components/layout/Footer'
import { TopPlayers } from '@/components/domain/vision/detail/TopPlayers'
import { getSourceDisplayServer } from '@/lib/vision/sources-server'
import { getCategoryLabel } from '@/lib/vision/source-categories'
import { prefetchLeaderboard } from '@/lib/vision/prefetch'

// TODO: import SourceSidebarApple from '@/components/domain/vision/detail/SourceSidebarApple'
// TODO: import SourceTabNav from '@/components/domain/vision/detail/SourceTabNav'
// Wiring pass will reconcile once Slice 1 files exist.

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
          {/* TODO: Replace with SourceSidebarApple + SourceTabNav shell once Slice 1 exists */}
          <div className="mx-auto max-w-[var(--apple-content-max,1680px)] px-5 lg:px-10">
            {/* Tab nav stub */}
            <nav
              aria-label="Source tabs"
              className="flex gap-6 pt-6 pb-0 border-b border-[var(--apple-divider,#e8e8ed)] mb-8"
              style={{ fontFamily: 'var(--apple-font-text,"SF Pro Text",Helvetica,Arial,sans-serif)', fontSize: 14 }}
            >
              {(['Overview', 'Vaults', 'Bots', 'Markets', 'Activity', 'Leaderboard'] as const).map((tab) => (
                <a
                  key={tab}
                  href={
                    tab === 'Overview'
                      ? `/source/${sourceId}`
                      : tab === 'Vaults'
                        ? `/source/${sourceId}/vaults`
                        : tab === 'Bots'
                          ? `/source/${sourceId}/bots`
                          : `/source/${sourceId}/${tab.toLowerCase()}`
                  }
                  aria-current={tab === 'Leaderboard' ? 'page' : undefined}
                  className={
                    tab === 'Leaderboard'
                      ? 'pb-3 text-[var(--apple-text,#1d1d1f)] font-semibold border-b-[1.5px] border-[var(--apple-text,#1d1d1f)] -mb-px'
                      : 'pb-3 text-[var(--apple-text-secondary,#6e6e73)] hover:text-[var(--apple-text,#1d1d1f)] transition-colors'
                  }
                  style={{ letterSpacing: 'var(--apple-track-tight,-0.022em)' }}
                >
                  {tab}
                </a>
              ))}
            </nav>

            {/* Page heading */}
            <div className="py-10 lg:py-12">
              <h1
                className="text-[var(--apple-text,#1d1d1f)] font-semibold"
                style={{
                  fontFamily: 'var(--apple-font-display,"SF Pro Display",Helvetica,Arial,sans-serif)',
                  fontSize: 'clamp(32px, 3.5vw, 40px)',
                  letterSpacing: 'var(--apple-track-tighter,-0.016em)',
                  lineHeight: 1.1,
                }}
              >
                Leaderboard
              </h1>
            </div>

            {/* TopPlayers — renders top-5 global leaderboard (per-source is a follow-up) */}
            <div className="pb-16">
              <TopPlayers sourceId={sourceId} />
            </div>
          </div>
        </div>

        <Footer />
      </main>
    </HydrationBoundary>
  )
}
