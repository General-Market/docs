import type { Metadata } from 'next'
import { AppShell } from '@/components/layout/AppShell'
import { SourceSearch } from '@/components/layout/SourceSearch'
import { BatchVaultResults } from '@/components/domain/vision/detail/BatchVaultResults'
import { ActivityRecentBets } from '@/components/domain/vision/detail/ActivityRecentBets'
import { LiveRoundsCard } from '@/components/domain/vision/detail/LiveRoundsCard'
import { SourceSidebarApple } from '@/components/domain/vision/detail/SourceSidebarApple'
import { SourceTabNav } from '@/components/domain/vision/detail/SourceTabNav'
import { getSourceDisplayServer } from '@/lib/vision/sources-server'
import { getCategoryLabel } from '@/lib/vision/source-categories'

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
  const title = `${source.name} · Activity | Vision`
  const description = `Round history and live bets on ${source.name}. Category: ${category}.`
  const path = `/source/${sourceId}/activity`

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
    openGraph: { title, description },
    twitter: { card: 'summary_large_image', title, description },
    keywords: [source.name, category, 'activity', 'recent bets', 'round history', 'Vision'],
  }
}

export default async function ActivityPage({ params }: Props) {
  const { sourceId } = await params
  const source = await getSourceDisplayServer(sourceId)

  const jsonLd = source
    ? [
        {
          '@context': 'https://schema.org',
          '@type': 'BreadcrumbList',
          itemListElement: [
            { '@type': 'ListItem', position: 1, name: 'Home', item: 'https://www.generalmarket.io' },
            { '@type': 'ListItem', position: 2, name: 'Data Sources', item: 'https://www.generalmarket.io/sources' },
            { '@type': 'ListItem', position: 3, name: source.name, item: `https://www.generalmarket.io/source/${sourceId}` },
            { '@type': 'ListItem', position: 4, name: 'Activity' },
          ],
        },
      ]
    : []

  return (
    <>
      {jsonLd.map((ld, i) => (
        <script key={i} type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(ld) }} />
      ))}
      <AppShell
        search={<SourceSearch />}
        sidebar={<SourceSidebarApple sourceId={sourceId} category={source?.category} />}
      >
        <div className="flex flex-col">
          <SourceTabNav sourceId={sourceId} activeTab="activity" />
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
                Activity
              </h1>
            </header>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
              <div className="flex flex-col gap-6">
                <LiveRoundsCard sourceId={sourceId} />
                <BatchVaultResults sourceId={sourceId} />
              </div>
              <ActivityRecentBets />
            </div>
          </div>
        </div>
      </AppShell>
    </>
  )
}
