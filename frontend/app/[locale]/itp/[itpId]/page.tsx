import { Metadata } from 'next'
import { getTranslations } from 'next-intl/server'
import { getItpDetail, getItpSummaries } from '@/lib/api/server-data'
import { BreadcrumbJsonLd } from '@/components/seo/JsonLd'
import { ItpPageClient } from '@/components/domain/itp-page/ItpPageClient'
import { Header } from '@/components/layout/Header'
import { Footer } from '@/components/layout/Footer'
import { Link } from '@/i18n/routing'
import { computeEnrichment } from '@/lib/api/itp-enrichment'
import type { ItpEnrichment } from '@/lib/itp-enrichment-types'

export const revalidate = 300

interface Props {
  params: Promise<{ locale: string; itpId: string }>
}

function parseItpNum(itpId: string): number {
  return parseInt((itpId?.startsWith('0x') ? itpId.slice(2) : itpId || '0'), 16) || 0
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale, itpId } = await params
  const [itp, t] = await Promise.all([
    getItpDetail(itpId),
    getTranslations({ locale, namespace: 'seo.pages.itp' }),
  ])

  const num = parseItpNum(itpId)
  const name = itp?.name || `ITP #${num}`
  const symbol = itp?.symbol || `ITP${num}`
  const assetCount = itp?.assetCount || 0
  const nav = itp?.nav || 0

  const description = t('description', {
    name,
    symbol,
    count: assetCount,
    nav: nav.toFixed(4),
  })

  const ogTitle = t('og_title', { name })

  return {
    title: t('title', { name, symbol }),
    description,
    openGraph: {
      title: ogTitle,
      description,
      url: `https://www.generalmarket.io/itp/${itpId}`,
    },
    twitter: {
      card: 'summary_large_image',
      title: ogTitle,
      description,
    },
  }
}

export async function generateStaticParams() {
  const itps = await getItpSummaries()
  return itps.map((itp) => ({ itpId: itp.itpId }))
}

async function fetchEnrichment(itpId: string): Promise<ItpEnrichment | null> {
  try {
    const result = await Promise.race([
      computeEnrichment(itpId),
      new Promise<null>((resolve) => setTimeout(() => resolve(null), 5000)),
    ])
    return result
  } catch {
    return null
  }
}

export default async function ItpPage({ params }: Props) {
  const { locale, itpId } = await params
  const [itp, t, tBreadcrumbs, enrichment] = await Promise.all([
    getItpDetail(itpId),
    getTranslations({ locale, namespace: 'seo.pages.itp' }),
    getTranslations({ locale, namespace: 'seo.breadcrumbs' }),
    fetchEnrichment(itpId),
  ])

  // Fallback when data-node is unreachable — render shell, client hooks fill real data
  const itpNum = parseItpNum(itpId)
  const data = itp ?? {
    itpId,
    name: `ITP #${itpNum}`,
    symbol: `ITP${itpNum}`,
    nav: 0,
    aum: 0,
    assetCount: 0,
    holdings: [],
  }

  return (
    <main className="min-h-screen bg-page flex flex-col">
      <Header />

      <BreadcrumbJsonLd items={[
        { name: tBreadcrumbs('home'), url: 'https://www.generalmarket.io' },
        { name: tBreadcrumbs('markets'), url: 'https://www.generalmarket.io/index' },
        { name: data.name, url: `https://www.generalmarket.io/itp/${itpId}` },
      ]} />

      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "FinancialProduct",
            "category": "Index Fund",
            name: data.name,
            tickerSymbol: data.symbol,
            description: t('description', {
              name: data.name,
              symbol: data.symbol,
              count: data.assetCount,
              nav: data.nav.toFixed(4),
            }),
            url: `https://www.generalmarket.io/itp/${itpId}`,
            provider: {
              "@type": "Organization",
              name: "General Market",
              url: "https://www.generalmarket.io",
            },
          }).replace(/</g, '\\u003c'),
        }}
      />

      <div className="flex-1 px-6 lg:px-12 py-8">
        <div className="max-w-6xl mx-auto">
          <nav className="text-sm text-text-muted mb-4">
            <Link href="/" className="hover:text-text-primary transition-colors">{tBreadcrumbs('home')}</Link>
            <span className="mx-2">/</span>
            <Link href="/index" className="hover:text-text-primary transition-colors">{tBreadcrumbs('markets')}</Link>
            <span className="mx-2">/</span>
            <span className="text-text-primary">{data.name}</span>
          </nav>

          <ItpPageClient
            itpId={itpId}
            name={data.name}
            symbol={data.symbol}
            nav={data.nav}
            aum={data.aum}
            assetCount={data.assetCount}
            enrichment={enrichment}
          />

          <p className="mt-12 text-[11px] text-text-muted leading-relaxed">
            NAV is calculated from live price feeds. Data updates every 60 seconds. Past performance is not indicative of future results.
          </p>
        </div>
      </div>

      <Footer />
    </main>
  )
}
