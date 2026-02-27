import { Metadata } from 'next'
import { getTranslations } from 'next-intl/server'
import { Header } from '@/components/layout/Header'
import { Footer } from '@/components/layout/Footer'
import { BreadcrumbJsonLd } from '@/components/seo/JsonLd'
import { Link } from '@/i18n/routing'
import { BacktestClient } from './BacktestClient'

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params
  const t = await getTranslations({ locale, namespace: 'seo.pages.backtest' })
  return {
    title: t('title'),
    description: t('description'),
    alternates: {
      canonical: '/backtest',
    },
    robots: {
      index: true,
      follow: true,
    },
    openGraph: {
      title: t('title'),
      description: t('description'),
      url: 'https://www.generalmarket.io/backtest',
      type: 'website',
      siteName: 'General Market',
    },
    twitter: {
      card: 'summary_large_image',
      title: t('title'),
      description: t('description'),
    },
  }
}

export const revalidate = 3600

const webApplicationJsonLd = {
  '@context': 'https://schema.org',
  '@type': 'WebApplication',
  name: 'General Market Backtester',
  applicationCategory: 'FinanceApplication',
  operatingSystem: 'Web',
  offers: {
    '@type': 'Offer',
    price: '0',
    priceCurrency: 'USD',
  },
  description:
    'Free crypto portfolio backtesting tool. Simulate strategies across 100+ assets with historical price data. Test category-based portfolios, weighting schemes, and rebalance frequencies.',
  url: 'https://www.generalmarket.io/backtest',
  author: {
    '@type': 'Organization',
    name: 'General Market',
    url: 'https://www.generalmarket.io',
  },
}

const howToJsonLd = {
  '@context': 'https://schema.org',
  '@type': 'HowTo',
  name: 'How to Backtest a Crypto Portfolio',
  description:
    'Step-by-step guide to backtesting crypto portfolio strategies using General Market\'s free simulator.',
  step: [
    {
      '@type': 'HowToStep',
      name: 'Select a market category',
      text: 'Select a market category such as DeFi, Layer 1, AI tokens, or meme coins. The backtester pulls historical prices for the top assets in each category.',
    },
    {
      '@type': 'HowToStep',
      name: 'Choose portfolio size and weighting',
      text: 'Choose how many assets to include (top N) and a weighting scheme: equal weight, market-cap weighted, or multi-factor optimized.',
    },
    {
      '@type': 'HowToStep',
      name: 'Set rebalance frequency',
      text: 'Set how often the portfolio rebalances — daily, weekly, monthly, or custom intervals. Shorter intervals capture drift but incur higher simulated fees.',
    },
    {
      '@type': 'HowToStep',
      name: 'Review performance metrics',
      text: 'Review total return, max drawdown, Sharpe ratio, and per-asset holdings. Compare strategies side by side using sweep mode, then deploy winning portfolios as on-chain ITPs.',
    },
  ],
}

export default async function BacktestPage() {
  return (
    <main className="min-h-screen bg-page flex flex-col">
      <Header />

      {/* JSON-LD */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(webApplicationJsonLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(howToJsonLd) }}
      />
      <BreadcrumbJsonLd
        items={[
          { name: 'Home', url: 'https://www.generalmarket.io' },
          { name: 'Backtest', url: 'https://www.generalmarket.io/backtest' },
        ]}
      />

      {/* Breadcrumb nav */}
      <nav className="max-w-site mx-auto px-6 lg:px-12 pt-6" aria-label="Breadcrumb">
        <ol className="flex items-center gap-1.5 text-[13px] text-text-secondary">
          <li>
            <Link href="/" className="hover:text-black transition-colors">Home</Link>
          </li>
          <li aria-hidden="true">/</li>
          <li className="text-black font-medium" aria-current="page">Backtest</li>
        </ol>
      </nav>

      {/* SEO intro section — static, crawlable */}
      <section className="max-w-site mx-auto px-6 lg:px-12 pt-8 pb-6">
        <h1 className="text-[28px] md:text-[36px] font-black tracking-[-0.02em] text-black leading-[1.1]">
          Crypto Portfolio Backtester
        </h1>
        <p className="text-[14px] text-text-secondary mt-3 max-w-2xl leading-relaxed">
          Test portfolio strategies against historical price data before deploying real capital.
          Select from 60+ market categories, choose a weighting scheme, set rebalance frequency,
          and see exactly how your strategy would have performed. Free, no signup required.
        </p>
      </section>

      {/* Interactive backtester — client-side only */}
      <section className="max-w-site mx-auto px-6 lg:px-12 pb-10 w-full">
        <BacktestClient />
      </section>

      {/* Divider */}
      <div className="max-w-site mx-auto px-6 lg:px-12">
        <div className="border-t border-border-light" />
      </div>

      {/* Methodology section */}
      <section className="max-w-site mx-auto px-6 lg:px-12 py-12">
        <h2 className="text-[20px] md:text-[24px] font-black tracking-[-0.02em] text-black mb-6">
          Methodology
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-white rounded-xl border border-border-light p-6">
            <p className="text-[10px] uppercase tracking-[0.12em] text-text-secondary font-semibold mb-2">
              Category Selection
            </p>
            <p className="text-[14px] text-text-secondary leading-relaxed">
              Choose from 60+ curated market categories including DeFi, Layer 1, Layer 2, AI tokens,
              meme coins, gaming, real-world assets, and more. Each category tracks the top assets
              by market cap with daily-resolution historical prices.
            </p>
          </div>
          <div className="bg-white rounded-xl border border-border-light p-6">
            <p className="text-[10px] uppercase tracking-[0.12em] text-text-secondary font-semibold mb-2">
              Weighting Schemes
            </p>
            <p className="text-[14px] text-text-secondary leading-relaxed">
              Equal weight distributes capital evenly across assets. Market-cap weighting allocates
              proportionally to each asset's market capitalization. Multi-factor optimization
              combines momentum, volatility, and correlation signals to maximize risk-adjusted returns.
            </p>
          </div>
          <div className="bg-white rounded-xl border border-border-light p-6">
            <p className="text-[10px] uppercase tracking-[0.12em] text-text-secondary font-semibold mb-2">
              Rebalance Frequency
            </p>
            <p className="text-[14px] text-text-secondary leading-relaxed">
              Controls how often portfolio weights are reset to target allocations. Shorter intervals
              (daily, weekly) capture drift and lock in gains but incur higher simulated trading fees.
              Longer intervals (monthly, quarterly) reduce costs but allow more drift from targets.
            </p>
          </div>
          <div className="bg-white rounded-xl border border-border-light p-6">
            <p className="text-[10px] uppercase tracking-[0.12em] text-text-secondary font-semibold mb-2">
              Performance Metrics
            </p>
            <p className="text-[14px] text-text-secondary leading-relaxed">
              Total return, annualized return, maximum drawdown, Sharpe ratio, and Sortino ratio.
              The simulator accounts for trading fees and spread costs at each rebalance.
              Results reflect net-of-fee performance.
            </p>
          </div>
        </div>
      </section>

      {/* Divider */}
      <div className="max-w-site mx-auto px-6 lg:px-12">
        <div className="border-t border-border-light" />
      </div>

      {/* Advanced features section */}
      <section className="max-w-site mx-auto px-6 lg:px-12 py-12">
        <h2 className="text-[20px] md:text-[24px] font-black tracking-[-0.02em] text-black mb-6">
          Advanced Features
        </h2>
        <div className="space-y-5 text-[14px] text-text-secondary leading-relaxed max-w-2xl">
          <p>
            <span className="font-semibold text-black">Sweep mode.</span>{' '}
            Compare multiple strategies side by side. Sweep across weighting schemes, rebalance
            intervals, portfolio sizes, or entire categories. Identify the best-performing
            configuration in a single run.
          </p>
          <p>
            <span className="font-semibold text-black">Fear &amp; Greed filter.</span>{' '}
            Optionally reduce exposure during extreme greed and increase during extreme fear,
            using the Crypto Fear &amp; Greed Index as a signal overlay.
          </p>
          <p>
            <span className="font-semibold text-black">BTC dominance filter.</span>{' '}
            Adjust allocation based on Bitcoin dominance trends. Rotate into alts when dominance
            is falling, or shift to safety when dominance is rising.
          </p>
          <p>
            <span className="font-semibold text-black">Deploy to chain.</span>{' '}
            Found a strategy that works? Deploy it directly as an on-chain ITP (Index Tracking Product)
            with a single click. Your backtest becomes a live, tradeable index.
          </p>
        </div>
      </section>

      {/* Divider */}
      <div className="max-w-site mx-auto px-6 lg:px-12">
        <div className="border-t border-border-light" />
      </div>

      {/* Internal links */}
      <section className="max-w-site mx-auto px-6 lg:px-12 py-12">
        <h2 className="text-[20px] md:text-[24px] font-black tracking-[-0.02em] text-black mb-6">
          Explore More
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
          <Link
            href="/index"
            className="bg-white rounded-xl border border-border-light p-6 hover:border-border-medium transition-colors group"
          >
            <p className="text-[10px] uppercase tracking-[0.12em] text-text-secondary font-semibold mb-2">
              Markets
            </p>
            <p className="text-[15px] font-bold text-black group-hover:underline">
              Browse ITPs &rarr;
            </p>
            <p className="text-[13px] text-text-secondary mt-1">
              Explore live index products and trade on-chain.
            </p>
          </Link>
          <Link
            href="/data"
            className="bg-white rounded-xl border border-border-light p-6 hover:border-border-medium transition-colors group"
          >
            <p className="text-[10px] uppercase tracking-[0.12em] text-text-secondary font-semibold mb-2">
              Data Sources
            </p>
            <p className="text-[15px] font-bold text-black group-hover:underline">
              Price Feeds &rarr;
            </p>
            <p className="text-[13px] text-text-secondary mt-1">
              100+ assets with real-time price aggregation.
            </p>
          </Link>
          <Link
            href="/about"
            className="bg-white rounded-xl border border-border-light p-6 hover:border-border-medium transition-colors group"
          >
            <p className="text-[10px] uppercase tracking-[0.12em] text-text-secondary font-semibold mb-2">
              Protocol
            </p>
            <p className="text-[15px] font-bold text-black group-hover:underline">
              About &rarr;
            </p>
            <p className="text-[13px] text-text-secondary mt-1">
              The team and technology behind General Market.
            </p>
          </Link>
        </div>
      </section>

      <div className="flex-1" />
      <Footer />
    </main>
  )
}
