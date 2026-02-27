import { Metadata } from 'next'
import { getTranslations } from 'next-intl/server'
import { Header } from '@/components/layout/Header'
import { Footer } from '@/components/layout/Footer'
import { Link } from '@/i18n/routing'
import { BreadcrumbJsonLd } from '@/components/seo/JsonLd'
import { AA_DATA_NODE_URL } from '@/lib/config'
import { FearGreedChart } from './FearGreedClient'

export const revalidate = 3600

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params
  const t = await getTranslations({ locale, namespace: 'seo.pages.fear_greed' })
  return {
    title: t('title'),
    description: t('description'),
    alternates: {
      canonical: '/fear-and-greed',
    },
    robots: {
      index: true,
      follow: true,
    },
    openGraph: {
      title: t('title'),
      description: t('description'),
      url: 'https://www.generalmarket.io/fear-and-greed',
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

// ---------- Types ----------

interface FngLatest {
  date: string
  value: number
  classification: string
}

interface HistoryEntry {
  date: string
  value: number
  classification: string
}

// ---------- Color helpers ----------

function getClassification(value: number): string {
  if (value <= 25) return 'Extreme Fear'
  if (value <= 40) return 'Fear'
  if (value <= 60) return 'Neutral'
  if (value <= 75) return 'Greed'
  return 'Extreme Greed'
}

function getColor(value: number): string {
  if (value <= 25) return '#DC2626'      // red
  if (value <= 40) return '#EA580C'      // orange
  if (value <= 60) return '#6B7280'      // gray
  if (value <= 75) return '#16A34A'      // green
  return '#15803D'                        // dark green
}

function getBgColor(value: number): string {
  if (value <= 25) return 'bg-red-50'
  if (value <= 40) return 'bg-orange-50'
  if (value <= 60) return 'bg-gray-50'
  if (value <= 75) return 'bg-green-50'
  return 'bg-emerald-50'
}

function getTextColor(value: number): string {
  if (value <= 25) return 'text-red-600'
  if (value <= 40) return 'text-orange-600'
  if (value <= 60) return 'text-gray-600'
  if (value <= 75) return 'text-green-600'
  return 'text-emerald-700'
}

// ---------- Data fetching ----------

async function fetchLatest(): Promise<FngLatest> {
  try {
    const res = await fetch(`${AA_DATA_NODE_URL}/fng/latest`, {
      next: { revalidate: 3600 },
    })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    return await res.json()
  } catch {
    return { date: new Date().toISOString().slice(0, 10), value: 50, classification: 'Neutral' }
  }
}

async function fetchHistory(): Promise<HistoryEntry[]> {
  try {
    const res = await fetch('https://api.alternative.me/fng/?limit=365&format=json', {
      next: { revalidate: 3600 },
    })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const json = await res.json()
    const entries: HistoryEntry[] = (json.data || []).map(
      (d: { value: string; value_classification: string; timestamp: string }) => ({
        date: new Date(Number(d.timestamp) * 1000).toISOString().slice(0, 10),
        value: Number(d.value),
        classification: d.value_classification,
      })
    )
    // API returns newest first — reverse for chronological order
    return entries.reverse()
  } catch {
    return []
  }
}

// ---------- Page ----------

export default async function FearAndGreedPage() {
  const [latest, history] = await Promise.all([fetchLatest(), fetchHistory()])

  const value = latest.value
  const classification = latest.classification || getClassification(value)
  const color = getColor(value)

  const datasetJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Dataset',
    name: 'Crypto Fear & Greed Index',
    description:
      'Daily sentiment index for cryptocurrency markets, ranging from 0 (Extreme Fear) to 100 (Extreme Greed). Based on volatility, momentum, social media, and market dominance.',
    url: 'https://www.generalmarket.io/fear-and-greed',
    license: 'https://creativecommons.org/licenses/by/4.0/',
    creator: {
      '@type': 'Organization',
      name: 'General Market',
      url: 'https://www.generalmarket.io',
    },
    temporalCoverage: history.length > 0
      ? `${history[0].date}/${history[history.length - 1].date}`
      : latest.date,
    variableMeasured: {
      '@type': 'PropertyValue',
      name: 'Fear & Greed Index',
      minValue: 0,
      maxValue: 100,
      unitText: 'index points',
    },
  }

  return (
    <main className="min-h-screen bg-page flex flex-col">
      <Header />

      {/* JSON-LD */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(datasetJsonLd) }}
      />
      <BreadcrumbJsonLd
        items={[
          { name: 'Home', url: 'https://www.generalmarket.io' },
          { name: 'Fear & Greed Index', url: 'https://www.generalmarket.io/fear-and-greed' },
        ]}
      />

      {/* Breadcrumb nav */}
      <nav className="max-w-site mx-auto px-6 lg:px-12 pt-8 pb-2">
        <ol className="flex items-center gap-1.5 text-[13px] text-text-secondary">
          <li>
            <Link href="/" className="hover:text-black transition-colors">Home</Link>
          </li>
          <li aria-hidden="true">/</li>
          <li className="text-black font-medium">Fear &amp; Greed Index</li>
        </ol>
      </nav>

      {/* Hero — current score */}
      <section className="max-w-site mx-auto px-6 lg:px-12 pt-6 pb-10">
        <h1 className="text-[28px] md:text-[36px] font-black tracking-[-0.02em] text-black leading-[1.1]">
          Crypto Fear &amp; Greed Index
        </h1>
        <p className="text-[14px] text-text-secondary mt-2 max-w-2xl leading-relaxed">
          A daily sentiment gauge for the crypto market. Ranges from 0 (Extreme Fear) to 100 (Extreme Greed), combining volatility, momentum, social signals, and market dominance into a single number.
        </p>

        {/* Score display */}
        <div className="mt-8 flex flex-col sm:flex-row items-start sm:items-center gap-8">
          {/* Gauge */}
          <div className={`relative w-48 h-48 rounded-full ${getBgColor(value)} flex items-center justify-center`}>
            {/* Ring */}
            <svg className="absolute inset-0 w-full h-full" viewBox="0 0 192 192">
              {/* Background track */}
              <circle
                cx="96" cy="96" r="84"
                fill="none"
                stroke="#E5E7EB"
                strokeWidth="8"
              />
              {/* Value arc — draws from bottom-left, clockwise proportional to value */}
              <circle
                cx="96" cy="96" r="84"
                fill="none"
                stroke={color}
                strokeWidth="8"
                strokeLinecap="round"
                strokeDasharray={`${(value / 100) * 527.79} 527.79`}
                transform="rotate(-90 96 96)"
                className="transition-all duration-700"
              />
            </svg>
            <div className="text-center z-10">
              <div className="text-[48px] font-black leading-none text-black">
                {value}
              </div>
              <div className={`text-[14px] font-bold mt-1 ${getTextColor(value)}`}>
                {classification}
              </div>
            </div>
          </div>

          {/* Details */}
          <div className="space-y-4">
            <div>
              <p className="text-[10px] uppercase tracking-[0.12em] text-text-secondary font-semibold">
                Last Updated
              </p>
              <p className="text-[15px] font-semibold text-black mt-0.5">
                {latest.date}
              </p>
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-[0.12em] text-text-secondary font-semibold">
                Scale
              </p>
              <div className="flex items-center gap-1 mt-1.5">
                {[
                  { label: 'Extreme Fear', min: 0, max: 25, color: '#DC2626' },
                  { label: 'Fear', min: 25, max: 40, color: '#EA580C' },
                  { label: 'Neutral', min: 40, max: 60, color: '#6B7280' },
                  { label: 'Greed', min: 60, max: 75, color: '#16A34A' },
                  { label: 'Extreme Greed', min: 75, max: 100, color: '#15803D' },
                ].map((zone) => (
                  <div key={zone.label} className="text-center">
                    <div
                      className="h-2 rounded-full"
                      style={{
                        width: `${(zone.max - zone.min) * 1.2}px`,
                        backgroundColor: zone.color,
                      }}
                    />
                    <p className="text-[9px] text-text-secondary mt-1 leading-tight whitespace-nowrap">
                      {zone.min}-{zone.max}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Divider */}
      <div className="max-w-site mx-auto px-6 lg:px-12">
        <div className="border-t border-border-light" />
      </div>

      {/* Historical Chart */}
      {history.length > 0 && (
        <section className="max-w-site mx-auto px-6 lg:px-12 py-12">
          <h2 className="text-[20px] md:text-[24px] font-black tracking-[-0.02em] text-black mb-6">
            Historical Chart
          </h2>
          <FearGreedChart history={history} />
        </section>
      )}

      {/* Divider */}
      <div className="max-w-site mx-auto px-6 lg:px-12">
        <div className="border-t border-border-light" />
      </div>

      {/* Methodology */}
      <section className="max-w-site mx-auto px-6 lg:px-12 py-12">
        <h2 className="text-[20px] md:text-[24px] font-black tracking-[-0.02em] text-black mb-6">
          Methodology
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {[
            {
              label: 'Volatility',
              weight: '25%',
              description:
                'Measures current volatility and max drawdowns compared to 30- and 90-day averages. Unusual spikes signal fear.',
            },
            {
              label: 'Market Momentum / Volume',
              weight: '25%',
              description:
                'Compares current volume and momentum to recent averages. High buying volume in a positive market indicates greed.',
            },
            {
              label: 'Social Media',
              weight: '15%',
              description:
                'Sentiment analysis across Twitter, Reddit, and crypto forums. Tracks interaction rates and trending topics.',
            },
            {
              label: 'Surveys',
              weight: '15%',
              description:
                'Weekly crypto polls sampling thousands of investors. Direct measurement of crowd sentiment.',
            },
            {
              label: 'Bitcoin Dominance',
              weight: '10%',
              description:
                'Rising BTC dominance signals fear (flight to safety). Falling dominance signals greed (risk-on altcoin speculation).',
            },
            {
              label: 'Google Trends',
              weight: '10%',
              description:
                'Search volume for Bitcoin and crypto-related queries. Spikes in fear-related searches push the index down.',
            },
          ].map((factor) => (
            <div key={factor.label} className="bg-white rounded-xl border border-border-light p-6">
              <div className="flex items-center justify-between mb-2">
                <p className="text-[10px] uppercase tracking-[0.12em] text-text-secondary font-semibold">
                  {factor.label}
                </p>
                <span className="text-[12px] font-bold text-black">{factor.weight}</span>
              </div>
              <p className="text-[14px] text-text-secondary leading-relaxed">
                {factor.description}
              </p>
            </div>
          ))}
        </div>
        <p className="text-[14px] text-text-secondary leading-relaxed mt-6 max-w-2xl">
          The index is computed daily. Each factor is normalized to a 0-100 scale, then weighted to produce the final composite score. Data sourced from{' '}
          <a
            href="https://alternative.me/crypto/fear-and-greed-index/"
            target="_blank"
            rel="noopener noreferrer"
            className="text-black font-semibold hover:underline"
          >
            Alternative.me
          </a>.
        </p>
      </section>

      {/* Divider */}
      <div className="max-w-site mx-auto px-6 lg:px-12">
        <div className="border-t border-border-light" />
      </div>

      {/* How to Use */}
      <section className="max-w-site mx-auto px-6 lg:px-12 py-12">
        <h2 className="text-[20px] md:text-[24px] font-black tracking-[-0.02em] text-black mb-6">
          How to Use the Fear &amp; Greed Index
        </h2>
        <div className="space-y-5 text-[14px] text-text-secondary leading-relaxed max-w-2xl">
          <p>
            <span className="font-semibold text-black">Contrarian signal.</span>{' '}
            Warren Buffett's famous advice: &ldquo;Be fearful when others are greedy, and greedy when others are fearful.&rdquo; Extreme readings often precede reversals. When the index hits Extreme Fear, historically it has been a better entry point than Extreme Greed.
          </p>
          <p>
            <span className="font-semibold text-black">Context, not conviction.</span>{' '}
            The index is a sentiment snapshot, not a trade signal. Use it alongside price data, on-chain metrics, and your own analysis. It tells you what the crowd feels, not what will happen next.
          </p>
          <p>
            <span className="font-semibold text-black">Track over time.</span>{' '}
            A single day's reading matters less than the trend. A slow grind from 20 to 60 over a month tells a different story than a spike from 40 to 80 overnight.
          </p>
        </div>
      </section>

      {/* Divider */}
      <div className="max-w-site mx-auto px-6 lg:px-12">
        <div className="border-t border-border-light" />
      </div>

      {/* Links */}
      <section className="max-w-site mx-auto px-6 lg:px-12 py-12">
        <h2 className="text-[20px] md:text-[24px] font-black tracking-[-0.02em] text-black mb-6">
          Explore More
        </h2>
        <ul className="space-y-3 text-[15px] leading-relaxed">
          <li>
            <Link
              href="/about"
              className="text-black font-bold underline hover:no-underline"
            >
              About General Market
            </Link>
            <span className="text-text-secondary"> &mdash; The team and technology behind the protocol.</span>
          </li>
          <li>
            <Link
              href="/data"
              className="text-black font-bold underline hover:no-underline"
            >
              Data Sources
            </Link>
            <span className="text-text-secondary"> &mdash; 100+ price feeds powering our index products and markets.</span>
          </li>
          <li>
            <Link
              href="/index"
              className="text-black font-bold underline hover:no-underline"
            >
              Browse Markets
            </Link>
            <span className="text-text-secondary"> &mdash; Explore all available index tracking products.</span>
          </li>
        </ul>
      </section>

      <div className="flex-1" />
      <Footer />
    </main>
  )
}
