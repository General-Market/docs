import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { Header } from '@/components/layout/Header'
import { Footer } from '@/components/layout/Footer'
import { SourceDetail } from '@/components/domain/vision/detail/SourceDetail'
import { getSource, getSourceIds } from '@/lib/vision/sources'
import { getCategoryLabel } from '@/lib/vision/source-categories'

interface Props {
  params: Promise<{ locale: string; sourceId: string }>
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { sourceId } = await params
  const source = getSource(sourceId)

  if (!source) {
    return { title: 'Source Not Found' }
  }

  const category = getCategoryLabel(source.category)
  const description = `${source.name} — live market data feed with ${source.prefixes.length} market series. Category: ${category}. Trade predictions on Vision.`

  return {
    title: `${source.name} | Vision`,
    description,
    openGraph: {
      title: `${source.name} — Vision Data Source`,
      description,
    },
  }
}

export function generateStaticParams() {
  return getSourceIds().map((sourceId) => ({ sourceId }))
}

export default async function SourcePage({ params }: Props) {
  const { sourceId } = await params
  const source = getSource(sourceId)

  if (!source) {
    notFound()
  }

  return (
    <main className="min-h-screen bg-page flex flex-col">
      <Header />
      <div className="flex-1 overflow-x-clip">
        <SourceDetail sourceId={sourceId} />
      </div>
      <Footer />
    </main>
  )
}
