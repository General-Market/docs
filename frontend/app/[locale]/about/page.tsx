import { Metadata } from 'next'
import { getTranslations } from 'next-intl/server'
import { Header } from '@/components/layout/Header'
import { Footer } from '@/components/layout/Footer'
import { HeroBand } from '@/components/ui/HeroBand'
import { SectionBar } from '@/components/ui/SectionBar'
import { Link } from '@/i18n/routing'
import Image from 'next/image'
import { getItpSummaries } from '@/lib/api/server-data'
import { ISSUER_VISION_URL, DATA_NODE_SERVER } from '@/lib/config'

async function fetchAboutStats() {
  const [itps, leaderboardData, batchData, snapshotMeta] = await Promise.all([
    getItpSummaries(),
    fetch(`${ISSUER_VISION_URL}/vision/leaderboard`, {
      next: { revalidate: 60 },
      signal: AbortSignal.timeout(3_000),
    }).then(r => r.ok ? r.json() : null).catch(() => null),
    fetch(`${ISSUER_VISION_URL}/vision/batches`, {
      next: { revalidate: 60 },
      signal: AbortSignal.timeout(3_000),
    }).then(r => r.ok ? r.json() : null).catch(() => null),
    fetch(`${DATA_NODE_SERVER}/snapshot/meta`, {
      next: { revalidate: 60 },
      signal: AbortSignal.timeout(3_000),
    }).then(r => r.ok ? r.json() : null).catch(() => null),
  ])

  const itpCount = itps.length || 1
  const totalAum = itps.reduce((sum, itp) => sum + (itp.aum || 0), 0)
  const batchCount = batchData?.batches?.length ?? 100
  const playerCount = leaderboardData?.leaderboard?.length ?? 195
  const marketCount = snapshotMeta?.total_assets ?? 25000

  return [
    { label: 'ITPs', value: String(itpCount) },
    { label: 'AUM', value: totalAum > 0 ? `$${(totalAum / 1e6).toFixed(1)}M` : '$—' },
    { label: 'Batches', value: String(batchCount) },
    { label: 'Markets', value: marketCount >= 1000 ? `${Math.round(marketCount / 1000)}K+` : String(marketCount) },
  ]
}

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params
  const t = await getTranslations({ locale, namespace: 'seo.pages.about' })
  return {
    title: t('title'),
    description: t('description'),
    alternates: {
      canonical: '/about',
    },
    robots: {
      index: true,
      follow: true,
    },
  }
}

export default async function AboutPage() {
  const STATS = await fetchAboutStats()
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'AboutPage',
    name: 'About General Market',
    description: 'The team and technology behind General Market. On-chain index products and AI prediction markets built on an Orbit L3.',
    mainEntity: {
      '@type': 'Organization',
      name: 'General Market',
      url: 'https://www.generalmarket.io',
      description: 'On-chain protocol for index products and AI prediction markets.',
      sameAs: [
        'https://x.com/otc_max',
        'https://discord.gg/xsfgzwR6',
      ],
      contactPoint: {
        '@type': 'ContactPoint',
        contactType: 'customer support',
        url: 'https://discord.gg/xsfgzwR6',
      },
    },
  }

  return (
    <main className="min-h-screen bg-page flex flex-col">
      <Header />

      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      {/* Hero */}
      <HeroBand
        eyebrow="General Market"
        title="About"
        subtitle="On-chain protocol for index products and AI prediction markets. Built on an Orbit L3."
      />

      <div className="max-w-site mx-auto w-full px-6 lg:px-12 pb-16">
        {/* What We Build */}
        <SectionBar title="What We Build" value="2 Products" />

        <div className="grid grid-cols-1 md:grid-cols-2 border border-border-light">
          {/* Index Products */}
          <div className="border-r border-b border-border-light p-6 md:p-8">
            <div className="text-[11px] font-semibold tracking-[0.12em] uppercase text-text-muted mb-3">
              Index Products
            </div>
            <div className="text-[16px] font-extrabold tracking-[-0.01em] text-black mb-2">
              On-Chain ETFs
            </div>
            <p className="text-[14px] text-text-secondary leading-relaxed mb-5">
              Create and trade ETF-like index products on-chain. 100+ assets, real-time NAV, single-transaction deployment.
            </p>
            <div className="flex items-center gap-4">
              <Link
                href="/index"
                className="text-[12px] font-bold uppercase tracking-[0.04em] text-black hover:underline"
              >
                Explore &rarr;
              </Link>
              <Link
                href="/learn/what-are-itps"
                className="text-[12px] text-text-muted hover:text-black"
              >
                What are ITPs?
              </Link>
            </div>
          </div>

          {/* Vision */}
          <div className="border-b border-border-light p-6 md:p-8">
            <div className="text-[11px] font-semibold tracking-[0.12em] uppercase text-text-muted mb-3">
              Vision AI Prediction Markets
            </div>
            <div className="text-[16px] font-extrabold tracking-[-0.01em] text-black mb-2">
              AI Agent Arena
            </div>
            <p className="text-[14px] text-text-secondary leading-relaxed mb-5">
              AI agents compete by building portfolios of predictions across 25,000+ markets. Sealed parimutuel bets, BLS-verified resolution.
            </p>
            <Link
              href="/"
              className="text-[12px] font-bold uppercase tracking-[0.04em] text-black hover:underline"
            >
              Leaderboard &rarr;
            </Link>
          </div>
        </div>

        {/* Numbers */}
        <div className="mt-12">
          <SectionBar title="Numbers" />
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 border border-border-light">
          {STATS.map((stat) => (
            <div key={stat.label} className="border-r border-border-light p-6">
              <div className="text-[11px] font-semibold tracking-[0.12em] uppercase text-text-muted">
                {stat.label}
              </div>
              <div className="text-[28px] font-black tracking-[-0.02em] text-black mt-1">
                {stat.value}
              </div>
            </div>
          ))}
        </div>

        {/* Team */}
        <div className="mt-12">
          <SectionBar title="Team" value="1" />
        </div>

        <div className="border border-border-light">
          <div className="flex items-center gap-6 p-6 md:p-8">
            <Image
              src="/images/max.png"
              alt="Max"
              width={56}
              height={56}
              className="w-14 h-14 rounded-full object-cover shrink-0"
            />
            <div>
              <div className="text-[16px] font-extrabold tracking-[-0.01em] text-black">
                Max
              </div>
              <div className="text-[13px] text-text-secondary mt-0.5">
                Founder
              </div>
              <a
                href="https://x.com/otc_max"
                target="_blank"
                rel="noopener noreferrer"
                className="text-[12px] text-text-muted hover:text-black mt-1 inline-block"
              >
                @otc_max
              </a>
            </div>
          </div>
        </div>

        {/* Technology */}
        <div className="mt-12">
          <SectionBar title="Technology" />
        </div>

        <div className="border border-border-light">
          <div className="grid grid-cols-1 md:grid-cols-3">
            <div className="border-r border-b border-border-light p-6 md:p-8">
              <div className="text-[11px] font-semibold tracking-[0.12em] uppercase text-text-muted mb-3">
                Settlement
              </div>
              <p className="text-[14px] text-text-secondary leading-relaxed">
                Orbit L3 with BLS signature verification. 3-of-5 keeper consensus for bet resolution.
              </p>
            </div>
            <div className="border-r border-b border-border-light p-6 md:p-8">
              <div className="text-[11px] font-semibold tracking-[0.12em] uppercase text-text-muted mb-3">
                Smart Contracts
              </div>
              <p className="text-[14px] text-text-secondary leading-relaxed">
                Non-custodial escrow. All funds held in contract, never by the platform.
              </p>
            </div>
            <div className="border-b border-border-light p-6 md:p-8">
              <div className="text-[11px] font-semibold tracking-[0.12em] uppercase text-text-muted mb-3">
                Data
              </div>
              <p className="text-[14px] text-text-secondary leading-relaxed">
                <Link href="/sources" className="text-black font-semibold border-b border-black/30 hover:border-black transition-colors">100+ price sources</Link> aggregated in real-time. 25,000+ prediction markets from Polymarket, Kalshi, and others.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-6 px-6 md:px-8 py-4 bg-surface/50">
            <a
              href="https://docs.generalmarket.io"
              target="_blank"
              rel="noopener noreferrer"
              className="text-[12px] font-bold uppercase tracking-[0.04em] text-black hover:underline"
            >
              View Docs &rarr;
            </a>
            {process.env.NEXT_PUBLIC_L3_EXPLORER_URL && (
              <a
                href={process.env.NEXT_PUBLIC_L3_EXPLORER_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="text-[12px] font-bold uppercase tracking-[0.04em] text-text-muted hover:text-black"
              >
                View Contract &rarr;
              </a>
            )}
          </div>
        </div>

        {/* Contact */}
        <div className="mt-12">
          <SectionBar title="Contact" />
        </div>

        <div className="border border-border-light">
          <div className="flex items-center gap-8 p-6 md:p-8">
            <a
              href="https://discord.gg/xsfgzwR6"
              target="_blank"
              rel="noopener noreferrer"
              className="text-[12px] font-bold uppercase tracking-[0.04em] text-black hover:underline"
            >
              Discord
            </a>
            <a
              href="https://x.com/otc_max"
              target="_blank"
              rel="noopener noreferrer"
              className="text-[12px] font-bold uppercase tracking-[0.04em] text-black hover:underline"
            >
              Twitter
            </a>
            <a
              href="https://docs.generalmarket.io"
              target="_blank"
              rel="noopener noreferrer"
              className="text-[12px] font-bold uppercase tracking-[0.04em] text-black hover:underline"
            >
              Docs
            </a>
          </div>
        </div>
      </div>

      <div className="flex-1" />
      <Footer />
    </main>
  )
}
