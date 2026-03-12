import { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { getTranslations } from 'next-intl/server'
import { getItpDetail, getItpSummaries } from '@/lib/api/server-data'
import { BreadcrumbJsonLd } from '@/components/seo/JsonLd'
import { ItpPageClient } from '@/components/domain/itp-page/ItpPageClient'
import type { ItpEnrichment } from '@/lib/itp-enrichment-types'

export const revalidate = 60

interface Props {
  params: Promise<{ locale: string; itpId: string }>
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale, itpId } = await params
  const [itp, t] = await Promise.all([
    getItpDetail(itpId),
    getTranslations({ locale, namespace: 'seo.pages.itp' }),
  ])

  if (!itp) {
    return { title: t('not_found') }
  }

  const description = t('description', {
    name: itp.name,
    symbol: itp.symbol,
    count: itp.assetCount,
    nav: itp.nav.toFixed(4),
  })

  const ogTitle = t('og_title', { name: itp.name })

  return {
    title: t('title', { name: itp.name, symbol: itp.symbol }),
    description,
    openGraph: {
      title: ogTitle,
      description,
      url: `https://generalmarket.io/itp/${itpId}`,
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
    // Use internal absolute URL for server-side fetch
    const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'
    const res = await fetch(
      `${baseUrl}/api/itp-enrichment?itp_id=${encodeURIComponent(itpId)}`,
      { next: { revalidate: 300 } }
    )
    if (!res.ok) return null
    return await res.json()
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

  if (!itp) {
    notFound()
  }

  return (
    <main className="min-h-screen bg-page">
      <BreadcrumbJsonLd items={[
        { name: tBreadcrumbs('home'), url: 'https://generalmarket.io' },
        { name: tBreadcrumbs('markets'), url: 'https://generalmarket.io/#markets' },
        { name: itp.name, url: `https://generalmarket.io/itp/${itpId}` },
      ]} />

      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "FinancialProduct",
            "category": "Index Fund",
            name: itp.name,
            tickerSymbol: itp.symbol,
            description: t('description', {
              name: itp.name,
              symbol: itp.symbol,
              count: itp.assetCount,
              nav: itp.nav.toFixed(4),
            }),
            url: `https://generalmarket.io/itp/${itpId}`,
            provider: {
              "@type": "Organization",
              name: "General Market",
              url: "https://generalmarket.io",
            },
          }).replace(/</g, '\\u003c'),
        }}
      />

      <div className="px-6 lg:px-12 py-12">
        <div className="max-w-5xl mx-auto">
          <nav className="text-sm text-text-muted mb-6">
            <a href="/" className="hover:text-black transition-colors">{tBreadcrumbs('home')}</a>
            <span className="mx-2">/</span>
            <a href="/#markets" className="hover:text-black transition-colors">{tBreadcrumbs('markets')}</a>
            <span className="mx-2">/</span>
            <span className="text-text-primary">{itp.name}</span>
          </nav>

          <header className="mb-8">
            <h1 className="text-3xl font-black tracking-tight text-black mb-2">
              {itp.name}
            </h1>
            <p className="text-lg text-text-secondary">
              {t('subtitle', { symbol: itp.symbol })}
            </p>
          </header>

          <ItpPageClient
            itpId={itpId}
            name={itp.name}
            symbol={itp.symbol}
            nav={itp.nav}
            aum={itp.aum}
            assetCount={itp.assetCount}
            enrichment={enrichment}
          />

          <p className="mt-8 text-[13px] text-text-secondary leading-relaxed">
            NAV is calculated from live price feeds. Data updates every 60 seconds.
          </p>
        </div>
      </div>
    </main>
  )
}
