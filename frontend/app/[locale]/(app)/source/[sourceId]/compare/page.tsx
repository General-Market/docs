import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { AppShell } from '@/components/layout/AppShell'
import { SourceSearch } from '@/components/layout/SourceSearch'
import { SourceSidebarApple } from '@/components/domain/vision/detail/SourceSidebarApple'
import { SourceTabNav } from '@/components/domain/vision/detail/SourceTabNav'
import { PolymarketComparison } from '@/components/domain/vision/detail/PolymarketComparison'
import { getSourceDisplayServer } from '@/lib/vision/sources-server'

export const revalidate = 20

interface Props {
  params: Promise<{ locale: string; sourceId: string }>
}

const SUPPORTED_SOURCE = 'polymarket'

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { sourceId } = await params
  if (sourceId !== SUPPORTED_SOURCE) return { title: 'Comparison unavailable' }

  const title = 'Polymarket vs Vision · Same window, different leverage'
  const description =
    'Side-by-side: Polymarket implied probabilities and Vision payouts from the same five-minute round. The numbers do not flatter Polymarket.'
  const path = `/source/${sourceId}/compare`

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
    keywords: ['Polymarket', 'Vision', 'comparison', 'leverage', 'parimutuel', 'implied probability', 'General Market'],
  }
}

export default async function ComparePage({ params }: Props) {
  const { sourceId } = await params
  if (sourceId !== SUPPORTED_SOURCE) notFound()

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
            { '@type': 'ListItem', position: 4, name: 'Compare' },
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
          <SourceTabNav sourceId={sourceId} activeTab="compare" />
          <div className="px-4 sm:px-6 lg:px-10 py-6 lg:py-10 pb-16">
            <header className="mb-6 max-w-[734px]">
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
                Same window. Different leverage.
              </h1>
              <p
                className="mt-3"
                style={{
                  fontFamily: 'var(--apple-font-text)',
                  fontSize: 'var(--apple-fs-17)',
                  letterSpacing: 'var(--apple-track-tight)',
                  lineHeight: 1.47,
                  color: 'var(--apple-text-secondary)',
                  margin: 0,
                }}
              >
                The same Polymarket questions. The five minutes you would have spent waiting. On one side, prices that
                barely flinched. On the other, multipliers Vision paid out before the round closed.
              </p>
            </header>
            <PolymarketComparison />
          </div>
        </div>
      </AppShell>
    </>
  )
}
