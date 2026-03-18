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

export default async function AboutPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params
  const t = await getTranslations({ locale, namespace: 'common.about' })
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
        eyebrow={t('eyebrow')}
        title={t('title')}
        subtitle={t('subtitle')}
      />

      <div className="px-6 lg:px-12">
      <div className="max-w-site mx-auto w-full pb-16">
        {/* What We Build */}
        <SectionBar title={t('what_we_build')} value={t('two_products')} />

        <div className="grid grid-cols-1 md:grid-cols-2 border border-border-light">
          {/* Index Products */}
          <div className="border-r border-b border-border-light p-6 md:p-8">
            <div className="text-[11px] font-semibold tracking-[0.12em] uppercase text-text-muted mb-3">
              {t('index_products')}
            </div>
            <div className="text-[16px] font-extrabold tracking-[-0.01em] text-black mb-2">
              {t('onchain_etfs')}
            </div>
            <p className="text-[14px] text-text-secondary leading-relaxed mb-5">
              {t('index_description')}
            </p>
            <div className="flex items-center gap-4">
              <Link
                href="/index"
                className="text-[12px] font-bold uppercase tracking-[0.04em] text-black hover:underline"
              >
                {t('explore')} &rarr;
              </Link>
              <Link
                href="/learn/what-are-itps"
                className="text-[12px] text-text-muted hover:text-black"
              >
                {t('what_are_itps')}
              </Link>
            </div>
          </div>

          {/* Vision */}
          <div className="border-b border-border-light p-6 md:p-8">
            <div className="text-[11px] font-semibold tracking-[0.12em] uppercase text-text-muted mb-3">
              {t('vision_label')}
            </div>
            <div className="text-[16px] font-extrabold tracking-[-0.01em] text-black mb-2">
              {t('ai_agent_arena')}
            </div>
            <p className="text-[14px] text-text-secondary leading-relaxed mb-5">
              {t('vision_description')}
            </p>
            <Link
              href="/"
              className="text-[12px] font-bold uppercase tracking-[0.04em] text-black hover:underline"
            >
              {t('leaderboard')} &rarr;
            </Link>
          </div>
        </div>

        {/* Numbers */}
        <div className="mt-12">
          <SectionBar title={t('numbers')} />
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
          <SectionBar title={t('team')} value="1" />
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
                {t('founder')}
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
          <SectionBar title={t('technology')} />
        </div>

        <div className="border border-border-light">
          <div className="grid grid-cols-1 md:grid-cols-3">
            <div className="border-r border-b border-border-light p-6 md:p-8">
              <div className="text-[11px] font-semibold tracking-[0.12em] uppercase text-text-muted mb-3">
                {t('settlement')}
              </div>
              <p className="text-[14px] text-text-secondary leading-relaxed">
                {t('settlement_description')}
              </p>
            </div>
            <div className="border-r border-b border-border-light p-6 md:p-8">
              <div className="text-[11px] font-semibold tracking-[0.12em] uppercase text-text-muted mb-3">
                {t('smart_contracts')}
              </div>
              <p className="text-[14px] text-text-secondary leading-relaxed">
                {t('smart_contracts_description')}
              </p>
            </div>
            <div className="border-b border-border-light p-6 md:p-8">
              <div className="text-[11px] font-semibold tracking-[0.12em] uppercase text-text-muted mb-3">
                {t('data')}
              </div>
              <p className="text-[14px] text-text-secondary leading-relaxed">
                <Link href="/sources" className="text-black font-semibold border-b border-black/30 hover:border-black transition-colors">{t('data_description_prefix')}</Link> {t('data_description_suffix')}
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
              {t('view_docs')} &rarr;
            </a>
            {process.env.NEXT_PUBLIC_L3_EXPLORER_URL && (
              <a
                href={process.env.NEXT_PUBLIC_L3_EXPLORER_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="text-[12px] font-bold uppercase tracking-[0.04em] text-text-muted hover:text-black"
              >
                {t('view_contract')} &rarr;
              </a>
            )}
          </div>
        </div>

        {/* Contact */}
        <div className="mt-12">
          <SectionBar title={t('contact')} />
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
      </div>

      <div className="flex-1" />
      <Footer />
    </main>
  )
}
