import type { Metadata } from 'next'
import { Header } from '@/components/layout/Header'
import { Footer } from '@/components/layout/Footer'
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

export default async function SourcePage({ params }: Props) {
  const { sourceId } = await params
  const source = await getSourceDisplayServer(sourceId)

  return (
    <main className="min-h-screen bg-page flex flex-col">
      <Header />
      <div className="flex-1 overflow-x-clip">
        <div className="px-6 lg:px-12 py-24">
          <div className="max-w-site mx-auto text-center text-text-muted">
            {/* Source detail UI is waiting on the Solana rebuild. */}
            {source ? source.name : 'Source'}
          </div>
        </div>
      </div>
      <Footer />
    </main>
  )
}
