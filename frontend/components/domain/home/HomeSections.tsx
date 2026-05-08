import { AssetCard } from './AssetCard'
import { HeroCarousel } from './HeroCarousel'
import { ScrollRow } from './ScrollRow'
import { Reveal } from '@/components/ui/Reveal'
import type { SourceFeed } from '@/lib/vision/adapters'

type FeedMap = Record<string, SourceFeed>

const HERO_ROTATION_IDS = ['polymarket', 'defillama', 'equities', 'sports'] as const
const SIDE_RAIL_IDS = ['pumpfun', 'iss', 'twitch', 'steam'] as const

// Top markets: every source we currently feed live data for, in display order.
const TOP_MARKETS_IDS = [
  'defillama',
  'equities',
  'sports',
  'twitch',
  'steam',
  'github',
  'iss',
  'pumpfun',
  'polymarket',
] as const

// Coming soon: surfaces in the registry without live feeds yet. Curated set —
// the ones a trader would actually want first. Each renders as a tile with
// the gradient + name; no fabricated sparklines.
const SOON_FEEDS: SourceFeed[] = [
  { sourceId: 'bitcoin', displayName: 'Bitcoin', meta: 'Mempool · hashrate · halving', coverage: 'soon', series: [] },
  { sourceId: 'finnhub', displayName: 'Finnhub', meta: 'Stocks · forex · earnings', coverage: 'soon', series: [] },
  { sourceId: 'sec', displayName: 'SEC', meta: '10-K · 13F · 8-K filings', coverage: 'soon', series: [] },
  { sourceId: 'treasury', displayName: 'US Treasury', meta: 'Yields · auctions · debt', coverage: 'soon', series: [] },
  { sourceId: 'ecb', displayName: 'ECB', meta: 'Rates · FX reference · M3', coverage: 'soon', series: [] },
  { sourceId: 'hackernews', displayName: 'Hacker News', meta: 'Front page · score · age', coverage: 'soon', series: [] },
  { sourceId: 'noaa', displayName: 'NOAA', meta: 'Storms · climate · records', coverage: 'soon', series: [] },
  { sourceId: 'flights', displayName: 'Flights', meta: 'Delays · cancellations · ETA', coverage: 'soon', series: [] },
  { sourceId: 'cftc', displayName: 'CFTC', meta: 'COT · futures positioning', coverage: 'soon', series: [] },
  { sourceId: 'eia', displayName: 'EIA', meta: 'Oil · gas · electricity', coverage: 'soon', series: [] },
]

function pick(feeds: FeedMap, id: string): SourceFeed {
  return (
    feeds[id] ?? {
      sourceId: id,
      displayName: id,
      meta: 'Loading…',
      coverage: 'soon',
      series: [],
    }
  )
}

function SectionHeader({
  title,
  href,
}: {
  title: string
  href?: string
}) {
  return (
    <div className="flex items-baseline justify-between mb-4">
      <Reveal mask>
        <h2
          className="font-semibold"
          style={{
            fontFamily: 'var(--apple-font-display)',
            fontSize: 22,
            letterSpacing: 'var(--apple-track-tight)',
            color: 'var(--apple-text)',
          }}
        >
          {title}
        </h2>
      </Reveal>
      {href && (
        <Reveal delay={0.08}>
          <a
            href={href}
            className="border transition hover:bg-[rgba(0,0,0,0.04)]"
            style={{
              background: 'var(--apple-panel)',
              color: 'var(--apple-text)',
              borderColor: 'var(--apple-line)',
              borderRadius: 'var(--apple-r-pill)',
              padding: '6px 14px',
              fontSize: 12,
              fontWeight: 500,
            }}
          >
            See All ›
          </a>
        </Reveal>
      )}
    </div>
  )
}

export function HomeDashboard({ feeds }: { feeds: FeedMap }) {
  const heroRotation = HERO_ROTATION_IDS.map((id) => {
    const f = pick(feeds, id)
    return {
      sourceId: f.sourceId,
      displayName: f.displayName,
      meta: f.meta,
      series: f.series,
      coverage: f.coverage,
      assetName: f.assetName,
      assetValue: f.assetValue,
      hrefOverride: f.hrefOverride,
    }
  })
  const side = SIDE_RAIL_IDS.map((id) => pick(feeds, id))
  const topMarkets = TOP_MARKETS_IDS.map((id) => pick(feeds, id))

  return (
    <div className="px-6 py-8 md:px-8 lg:px-10 lg:py-10">
      <Reveal mask>
        <h1
          className="font-semibold"
          style={{
            fontFamily: 'var(--apple-font-display)',
            fontSize: 32,
            letterSpacing: 'var(--apple-track-tight)',
            lineHeight: 1.07,
            color: 'var(--apple-text)',
          }}
        >
          Trading is easy with an Anti-Cheat
        </h1>
      </Reveal>

      <Reveal delay={0.08} className="mt-8">
        <HeroCarousel features={heroRotation} side={side} />
      </Reveal>

      <section className="mt-12">
        <SectionHeader title="Top markets" href="/explorer" />
        <ScrollRow>
          {topMarkets.map((feed) => (
            <AssetCard
              key={feed.sourceId}
              sourceId={feed.sourceId}
              displayName={feed.displayName}
              meta={feed.meta}
              series={feed.series}
              assetName={feed.assetName}
              assetValue={feed.assetValue}
              coverage={feed.coverage}
              hrefOverride={feed.hrefOverride}
            />
          ))}
        </ScrollRow>
      </section>

      <section className="mt-12 mb-4">
        <SectionHeader title="Coming soon" href="/explorer" />
        <ScrollRow>
          {SOON_FEEDS.map((feed) => (
            <AssetCard
              key={feed.sourceId}
              sourceId={feed.sourceId}
              displayName={feed.displayName}
              meta={feed.meta}
              series={feed.series}
              coverage={feed.coverage}
            />
          ))}
        </ScrollRow>
      </section>
    </div>
  )
}
