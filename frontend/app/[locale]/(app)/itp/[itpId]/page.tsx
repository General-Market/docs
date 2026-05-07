import { Metadata } from 'next'
import { getTranslations } from 'next-intl/server'
import { getItpDetail, getItpSummaries } from '@/lib/api/server-data'
import { BreadcrumbJsonLd } from '@/components/seo/JsonLd'
import { ItpPageClient } from '@/components/domain/itp-page/ItpPageClient'
import { AppShell } from '@/components/layout/AppShell'
import { SourceSearch } from '@/components/layout/SourceSearch'
import { ItpSidebarApple, type ItpSidebarPeer } from '@/components/domain/itp/ItpSidebarApple'
import { Link } from '@/i18n/routing'
import { computeEnrichment } from '@/lib/api/itp-enrichment'
import type { ItpEnrichment } from '@/lib/itp-enrichment-types'
import itpIdNames from '@/lib/itp-id-names.json'

const ITP_NAMES = itpIdNames as Record<string, { name: string; ticker: string }>

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
  const override = ITP_NAMES[itpId.toLowerCase()]
  const name = itp?.name || override?.name || `DTF #${num}`
  const symbol = itp?.symbol || override?.ticker || `DTF${num}`
  const assetCount = itp?.assetCount || 0
  const nav = itp?.nav || 0

  const description = t('description', {
    name,
    symbol,
    count: assetCount,
    nav: nav.toFixed(4),
  })

  return {
    title: t('title', { name, symbol }),
    description,
  }
}

export async function generateStaticParams() {
  const itps = await getItpSummaries()
  return itps.map((itp) => ({ itpId: itp.itpId }))
}

async function fetchEnrichment(
  itpId: string,
  holdings?: { symbol: string; weight: number; price: number }[],
): Promise<ItpEnrichment | null> {
  try {
    const result = await Promise.race([
      computeEnrichment(itpId, holdings),
      new Promise<null>((resolve) => setTimeout(() => resolve(null), 5000)),
    ])
    return result
  } catch {
    return null
  }
}

export default async function ItpPage({ params }: Props) {
  const { locale, itpId } = await params
  const [itp, summaries, t, tBreadcrumbs] = await Promise.all([
    getItpDetail(itpId),
    getItpSummaries(),
    getTranslations({ locale, namespace: 'seo.pages.itp' }),
    getTranslations({ locale, namespace: 'seo.breadcrumbs' }),
  ])
  const enrichment = await fetchEnrichment(itpId, itp?.holdings)

  // Fallback when data-node is unreachable — render shell, client hooks fill real data
  const itpNum = parseItpNum(itpId)
  const pageOverride = ITP_NAMES[itpId.toLowerCase()]
  const data = itp ?? {
    itpId,
    name: pageOverride?.name || `DTF #${itpNum}`,
    symbol: pageOverride?.ticker || `DTF${itpNum}`,
    nav: 0,
    aum: 0,
    assetCount: 0,
    holdings: [],
  }

  // Top peers by AUM, excluding current. Six is the visual ceiling — beyond that
  // the column starts arguing with the content.
  const peerItps: ItpSidebarPeer[] = summaries
    .filter((s) => s.itpId.toLowerCase() !== itpId.toLowerCase())
    .sort((a, b) => (b.aum ?? 0) - (a.aum ?? 0))
    .slice(0, 6)
    .map((s) => ({ itpId: s.itpId, name: s.name, symbol: s.symbol }))

  return (
    <AppShell
      search={<SourceSearch />}
      sidebar={
        <ItpSidebarApple
          itpId={itpId}
          name={data.name}
          symbol={data.symbol}
          peerItps={peerItps}
        />
      }
    >
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
            "category": t('json_ld_category'),
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

      <div className="px-4 sm:px-6 lg:px-10 py-6 lg:py-10">
        <div className="max-w-6xl mx-auto">
          <nav
            className="mb-6"
            style={{
              fontFamily: 'var(--apple-font-text)',
              fontSize: 'var(--apple-fs-12)',
              letterSpacing: 'var(--apple-track-tight)',
              color: 'var(--apple-text-tertiary)',
            }}
          >
            <Link href="/" style={{ color: 'var(--apple-text-secondary)' }}>{tBreadcrumbs('home')}</Link>
            <span style={{ margin: '0 8px', color: 'var(--apple-text-tertiary)' }}>/</span>
            <Link href="/index" style={{ color: 'var(--apple-text-secondary)' }}>{tBreadcrumbs('markets')}</Link>
            <span style={{ margin: '0 8px', color: 'var(--apple-text-tertiary)' }}>/</span>
            <span style={{ color: 'var(--apple-text)' }}>{data.name}</span>
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

          <p
            className="mt-12"
            style={{
              fontFamily: 'var(--apple-font-text)',
              fontSize: '11px',
              lineHeight: 1.5,
              color: 'var(--apple-text-tertiary)',
              letterSpacing: 'var(--apple-track-tight)',
            }}
          >
            {t('disclaimer')}
          </p>
        </div>
      </div>
    </AppShell>
  )
}
