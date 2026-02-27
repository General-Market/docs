import type { Metadata } from 'next'
import { getTranslations } from 'next-intl/server'
import { Header } from '@/components/layout/Header'
import { Footer } from '@/components/layout/Footer'
import { Link } from '@/i18n/routing'
import { VISION_SOURCES } from '@/lib/vision/sources'
import {
  SOURCE_CATEGORIES,
  getCategoryCounts,
  getSourcesByCategory,
} from '@/lib/vision/source-categories'
import DataExplorerClient from './DataExplorerClient'

export const revalidate = 300

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>
}): Promise<Metadata> {
  const { locale } = await params
  const t = await getTranslations({ locale, namespace: 'seo.pages.data' })
  return {
    title: t('title'),
    description: t('description'),
    alternates: {
      canonical: '/data',
    },
    robots: {
      index: true,
      follow: true,
    },
    openGraph: {
      title: t('title'),
      description: t('description'),
      url: 'https://www.generalmarket.io/data',
      type: 'website',
    },
    twitter: {
      card: 'summary_large_image',
      title: t('title'),
      description: t('description'),
    },
  }
}

export default async function DataPage() {
  const counts = getCategoryCounts()

  // ── JSON-LD: DataCatalog ──
  const dataCatalogJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'DataCatalog',
    name: 'General Market Data Sources',
    description:
      'Real-time data sources powering AI prediction markets on General Market. 79 feeds across finance, economic, geophysical, transport, nature, space, and more.',
    url: 'https://www.generalmarket.io/data',
    creator: {
      '@type': 'Organization',
      name: 'General Market',
      url: 'https://www.generalmarket.io',
    },
    dataset: VISION_SOURCES.map(source => ({
      '@type': 'Dataset',
      name: source.name,
      description: source.description,
      url: `https://www.generalmarket.io/source/${source.id}`,
    })),
  }

  // ── JSON-LD: Breadcrumbs ──
  const breadcrumbJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      {
        '@type': 'ListItem',
        position: 1,
        name: 'Home',
        item: 'https://www.generalmarket.io',
      },
      { '@type': 'ListItem', position: 2, name: 'Data Sources' },
    ],
  }

  return (
    <main className="min-h-screen bg-page flex flex-col">
      <Header />

      {/* JSON-LD */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(dataCatalogJsonLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }}
      />

      {/* Breadcrumb nav */}
      <nav
        aria-label="Breadcrumb"
        className="max-w-site mx-auto px-6 lg:px-12 pt-8"
      >
        <ol className="flex items-center gap-1.5 text-[12px] text-text-muted">
          <li>
            <Link href="/" className="hover:text-black transition-colors">
              Home
            </Link>
          </li>
          <li aria-hidden="true">/</li>
          <li className="font-semibold text-black">Data Sources</li>
        </ol>
      </nav>

      {/* Hero */}
      <section className="max-w-site mx-auto px-6 lg:px-12 pt-6 pb-8">
        <h1 className="text-[28px] md:text-[36px] font-black tracking-[-0.02em] text-black leading-[1.1]">
          Data Sources
        </h1>
        <p className="text-[14px] text-text-secondary mt-3 max-w-2xl leading-relaxed">
          General Market ingests real-time data from {counts.all} sources across{' '}
          {SOURCE_CATEGORIES.length} categories — finance, economics,
          geophysics, transport, nature, space, and more. Every source feeds
          live prediction markets that AI agents trade around the clock.
        </p>
      </section>

      {/* Stats row */}
      <section className="max-w-site mx-auto px-6 lg:px-12 pb-8">
        <div className="grid grid-cols-3 gap-6 max-w-lg">
          <div>
            <p className="text-[10px] uppercase tracking-[0.12em] text-text-secondary font-semibold">
              Sources
            </p>
            <p className="text-[22px] font-bold text-black mt-1 font-mono tabular-nums">
              {counts.all}
            </p>
          </div>
          <div>
            <p className="text-[10px] uppercase tracking-[0.12em] text-text-secondary font-semibold">
              Categories
            </p>
            <p className="text-[22px] font-bold text-black mt-1 font-mono tabular-nums">
              {SOURCE_CATEGORIES.length}
            </p>
          </div>
          <div>
            <p className="text-[10px] uppercase tracking-[0.12em] text-text-secondary font-semibold">
              Status
            </p>
            <div className="flex items-center gap-1.5 mt-1">
              <span className="w-2 h-2 rounded-full bg-color-up" />
              <p className="text-[16px] font-bold text-color-up">Live</p>
            </div>
          </div>
        </div>
      </section>

      {/* Divider */}
      <div className="max-w-site mx-auto px-6 lg:px-12">
        <div className="border-t border-border-light" />
      </div>

      {/* Category breakdown */}
      <section className="max-w-site mx-auto px-6 lg:px-12 py-10">
        <h2 className="text-[20px] md:text-[24px] font-black tracking-[-0.02em] text-black mb-6">
          Coverage by Category
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
          {SOURCE_CATEGORIES.map(cat => {
            const catSources = getSourcesByCategory(cat.key)
            return (
              <div
                key={cat.key}
                className="bg-white rounded-xl border border-border-light p-5"
              >
                <div className="flex items-center justify-between mb-3">
                  <p className="text-[10px] uppercase tracking-[0.12em] text-text-secondary font-semibold">
                    {cat.label}
                  </p>
                  <span className="text-[13px] font-bold text-black font-mono tabular-nums">
                    {counts[cat.key]}
                  </span>
                </div>
                <ul className="space-y-1">
                  {catSources.map(src => (
                    <li key={src.id}>
                      <Link
                        href={`/source/${src.id}`}
                        className="text-[12px] text-text-secondary hover:text-black hover:underline transition-colors leading-snug block"
                      >
                        {src.name}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            )
          })}
        </div>
      </section>

      {/* Divider */}
      <div className="max-w-site mx-auto px-6 lg:px-12">
        <div className="border-t border-border-light" />
      </div>

      {/* Full source grid (filterable) */}
      <section className="max-w-site mx-auto px-6 lg:px-12 py-10">
        <h2 className="text-[20px] md:text-[24px] font-black tracking-[-0.02em] text-black mb-6">
          All Sources
        </h2>
        <DataExplorerClient
          sources={VISION_SOURCES}
          categories={SOURCE_CATEGORIES}
          categoryCounts={counts}
        />
      </section>

      {/* Divider */}
      <div className="max-w-site mx-auto px-6 lg:px-12">
        <div className="border-t border-border-light" />
      </div>

      {/* Internal links */}
      <section className="max-w-site mx-auto px-6 lg:px-12 py-10">
        <h2 className="text-[20px] md:text-[24px] font-black tracking-[-0.02em] text-black mb-6">
          Related
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
          <Link
            href="/about"
            className="bg-white rounded-xl border border-border-light p-5 hover:shadow-md hover:border-black/15 transition-all"
          >
            <p className="text-[10px] uppercase tracking-[0.12em] text-text-secondary font-semibold mb-1">
              About
            </p>
            <p className="text-[15px] font-bold text-black">
              About General Market
            </p>
            <p className="text-[12px] text-text-secondary mt-1">
              The team and technology behind the protocol.
            </p>
          </Link>
          <Link
            href="/fear-and-greed"
            className="bg-white rounded-xl border border-border-light p-5 hover:shadow-md hover:border-black/15 transition-all"
          >
            <p className="text-[10px] uppercase tracking-[0.12em] text-text-secondary font-semibold mb-1">
              Sentiment
            </p>
            <p className="text-[15px] font-bold text-black">
              Fear & Greed Index
            </p>
            <p className="text-[12px] text-text-secondary mt-1">
              Live crypto market sentiment gauge.
            </p>
          </Link>
          <Link
            href="/learn/what-are-itps"
            className="bg-white rounded-xl border border-border-light p-5 hover:shadow-md hover:border-black/15 transition-all"
          >
            <p className="text-[10px] uppercase tracking-[0.12em] text-text-secondary font-semibold mb-1">
              Learn
            </p>
            <p className="text-[15px] font-bold text-black">
              What Are ITPs?
            </p>
            <p className="text-[12px] text-text-secondary mt-1">
              The on-chain equivalent of ETFs. A single token, a basket of
              assets.
            </p>
          </Link>
        </div>
      </section>

      <div className="flex-1" />
      <Footer />
    </main>
  )
}
