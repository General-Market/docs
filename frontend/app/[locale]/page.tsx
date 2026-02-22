import { getTranslations } from 'next-intl/server'
import { getItpSummaries } from '@/lib/api/server-data'
import { InvestmentFundJsonLd, BreadcrumbJsonLd } from '@/components/seo/JsonLd'
import { HomeClient } from '@/components/domain/HomeClient'

export default async function Home({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params
  const [itps, t] = await Promise.all([
    getItpSummaries(),
    getTranslations({ locale, namespace: 'seo.sr_only' }),
  ])
  const tArticle = await getTranslations({ locale, namespace: 'seo.sr_only.itp_article' })
  const tBreadcrumbs = await getTranslations({ locale, namespace: 'seo.breadcrumbs' })

  return (
    <main className="min-h-screen bg-page flex flex-col">
      {/* SEO shell — visible to crawlers, sr-only for users */}
      <h1 className="sr-only">{t('h1')}</h1>

      <div className="sr-only">
        <section aria-label={t('markets.title')}>
          <h2>{t('markets.title')}</h2>
          <p>{t('markets.description')}</p>
          {itps.map((itp) => (
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
      <InvestmentFundJsonLd itps={itps} />
      <BreadcrumbJsonLd items={[
        { name: tBreadcrumbs('home'), url: 'https://generalmarket.io' },
        { name: tBreadcrumbs('markets'), url: 'https://generalmarket.io/#markets' },
        { name: tBreadcrumbs('documentation'), url: 'https://generalmarket.io/docs' },
      ]} />

      {/* Interactive client app */}
      <HomeClient />
    </main>
  )
}
