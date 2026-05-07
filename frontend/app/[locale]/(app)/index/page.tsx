import { Metadata } from 'next'
import { getTranslations } from 'next-intl/server'
import { getItpSummaries } from '@/lib/api/server-data'
import { FinancialProductJsonLd, BreadcrumbJsonLd } from '@/components/seo/JsonLd'
import { HomeClient } from '@/components/domain/HomeClient'
import { AppShell } from '@/components/layout/AppShell'
import { IndexSidebar } from '@/components/layout/IndexSidebar'
import { SourceSearch } from '@/components/layout/SourceSearch'

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params
  const t = await getTranslations({ locale, namespace: 'seo.sr_only' })
  return {
    title: t('h1'),
    description: t('markets.description'),
    alternates: {
      canonical: '/index',
    },
  }
}

export default async function Home({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params
  const [itps, t] = await Promise.all([
    getItpSummaries(),
    getTranslations({ locale, namespace: 'seo.sr_only' }),
  ])
  const tArticle = await getTranslations({ locale, namespace: 'seo.sr_only.itp_article' })
  const tBreadcrumbs = await getTranslations({ locale, namespace: 'seo.breadcrumbs' })
  const tJsonLd = await getTranslations({ locale, namespace: 'seo.json_ld' })

  return (
    <AppShell search={<SourceSearch />} sidebar={<IndexSidebar />}>
      {/* SEO-visible content */}
      <div className="sr-only">
        <h1>{t('h1')}</h1>
        <section aria-label={t('markets.title')}>
          <h2>{t('markets.title')}</h2>
          <p>{t('markets.description')}</p>
          {[...itps].sort((a, b) => (b.aum || 0) - (a.aum || 0)).slice(0, 50).map((itp) => (
            <article key={itp.itpId}>
              <h3>{itp.name} ({itp.symbol})</h3>
              <p>{tArticle('nav_per_share', { nav: itp.nav.toFixed(4) })}</p>
              <p>{tArticle('aum', { aum: itp.aum.toFixed(2) })}</p>
              <p>{tArticle('holdings', { count: itp.assetCount })}</p>
              <a href={`/itp/${itp.itpId}`}>{tArticle('view_details', { name: itp.name })}</a>
            </article>
          ))}
        </section>

        <section aria-label={t('portfolio.title')}>
          <h2>{t('portfolio.title')}</h2>
          <p>{t('portfolio.description')}</p>
        </section>

        <section aria-label={t('create.title')}>
          <h2>{t('create.title')}</h2>
          <p>{t('create.description')}</p>
        </section>

        <section aria-label={t('lending.title')}>
          <h2>{t('lending.title')}</h2>
          <p>{t('lending.description')}</p>
        </section>

        <section aria-label={t('backtesting.title')}>
          <h2>{t('backtesting.title')}</h2>
          <p>{t('backtesting.description')}</p>
        </section>
      </div>

      {/* JSON-LD structured data */}
      <FinancialProductJsonLd
        itps={itps}
        categoryLabel={tJsonLd('category_index_fund')}
        descriptionTemplate={(itp) => tJsonLd('itp_description', { name: itp.name, count: itp.assetCount, nav: itp.nav.toFixed(4) })}
      />
      <BreadcrumbJsonLd items={[
        { name: tBreadcrumbs('home'), url: 'https://www.generalmarket.io' },
        { name: tBreadcrumbs('markets'), url: 'https://www.generalmarket.io/index' },
      ]} />

      {/* Interactive client app */}
      <HomeClient />
    </AppShell>
  )
}
