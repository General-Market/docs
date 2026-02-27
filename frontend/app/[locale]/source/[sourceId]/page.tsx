import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { Header } from '@/components/layout/Header'
import { Footer } from '@/components/layout/Footer'
import { SourceDetailCategoryNav } from '@/components/domain/vision/detail/SourceDetailCategoryNav'
import { SourceDetail } from '@/components/domain/vision/detail/SourceDetail'
import { BreadcrumbJsonLd } from '@/components/seo/JsonLd'
import { getSource, getSourceIds } from '@/lib/vision/sources'
import { getCategoryLabel } from '@/lib/vision/source-categories'
import { Link } from '@/i18n/routing'

export const revalidate = 300

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
  const description = `${source.description} Category: ${category}. Trade predictions on General Market Vision.`

  return {
    title: `${source.name} — Live Data Feed | General Market`,
    description,
    alternates: {
      canonical: `/source/${sourceId}`,
    },
    openGraph: {
      title: `${source.name} — Vision Data Source`,
      description,
      url: `https://www.generalmarket.io/source/${sourceId}`,
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

  const category = getCategoryLabel(source.category)

  const datasetJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Dataset',
    name: source.name,
    description: source.description,
    url: `https://www.generalmarket.io/source/${sourceId}`,
    creator: {
      '@type': 'Organization',
      name: 'General Market',
      url: 'https://www.generalmarket.io',
    },
    keywords: [source.category, category, 'prediction markets', 'live data'],
    isAccessibleForFree: true,
    license: 'https://www.generalmarket.io/terms',
  }

  return (
    <main className="min-h-screen bg-page flex flex-col">
      <Header />

      <BreadcrumbJsonLd items={[
        { name: 'Home', url: 'https://www.generalmarket.io' },
        { name: 'Data Sources', url: 'https://www.generalmarket.io/data' },
        { name: source.name, url: `https://www.generalmarket.io/source/${sourceId}` },
      ]} />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(datasetJsonLd) }}
      />

      {/* Static SEO content */}
      <section className="max-w-site mx-auto px-6 lg:px-12 pt-8 pb-4">
        <nav className="text-[12px] text-text-muted mb-4">
          <Link href="/" className="hover:text-black transition-colors">Home</Link>
          <span className="mx-1.5">/</span>
          <Link href="/data" className="hover:text-black transition-colors">Data Sources</Link>
          <span className="mx-1.5">/</span>
          <span className="text-text-primary">{source.name}</span>
        </nav>
        <p className="text-[13px] text-text-secondary leading-relaxed max-w-2xl">
          {source.description}{' '}
          <span className="inline-flex items-center px-2 py-0.5 bg-surface rounded text-[11px] font-semibold text-text-muted uppercase tracking-wider">
            {category}
          </span>
        </p>
      </section>

      <SourceDetailCategoryNav sourceCategory={source.category} />
      <div className="flex-1 overflow-x-clip">
        <SourceDetail sourceId={sourceId} />
      </div>
      <Footer />
    </main>
  )
}
