import { AssetCard } from './AssetCard'
import { HeroCarousel } from './HeroCarousel'
import { ScrollRow } from './ScrollRow'
import { Reveal } from '@/components/ui/Reveal'
import type { SourceFeed } from '@/lib/vision/adapters'

type FeedMap = Record<string, SourceFeed>

const HERO_ROTATION_IDS = ['polymarket', 'defillama', 'nasdaq', 'sports'] as const
const SIDE_RAIL_IDS = ['pumpfun', 'iss', 'twitch', 'steam'] as const

// Top markets: every source we currently feed live data for, in display order.
const TOP_MARKETS_IDS = [
  'defillama',
  'nasdaq',
  'sports',
  'twitch',
  'steam',
  'github',
  'iss',
  'pumpfun',
  'polymarket',
] as const

// Coming soon: four curated surfaces, rendered as a normal grid of cards.
// Same visual language as Top markets — no fabricated sparklines.
const SOON_FEEDS: SourceFeed[] = [
  {
    sourceId: '4chan',
    displayName: '4chan',
    meta: 'Boards · post velocity · thread heat',
    assetName: '/biz/ posts per hour',
    coverage: 'soon',
    series: [],
  },
  {
    sourceId: 'rust',
    displayName: 'Rust',
    meta: 'crates.io · downloads · releases',
    assetName: 'tokio downloads · 24h',
    coverage: 'soon',
    series: [],
  },
  {
    sourceId: 'binance-options',
    displayName: 'Binance Options',
    meta: 'BTC · ETH · open interest',
    assetName: 'BTC option open interest',
    coverage: 'soon',
    series: [],
  },
  {
    sourceId: 'cloudflare',
    displayName: 'Cloudflare',
    meta: 'Radar · global traffic · outages',
    assetName: 'Worldwide traffic index',
    coverage: 'soon',
    series: [],
  },
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

export function HomeDashboard({
  feeds,
  liveSourceIds,
}: {
  feeds: FeedMap
  liveSourceIds?: ReadonlySet<string>
}) {
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
  // Four curated surfaces. Still hide any that quietly went live in the
  // registry — promising a Coming Soon for something already shipped looks bad.
  const soonFeeds = liveSourceIds
    ? SOON_FEEDS.filter((f) => !liveSourceIds.has(f.sourceId))
    : SOON_FEEDS

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

      <Reveal delay={0.08} className="mt-6">
        <HeroCarousel features={heroRotation} side={side} />
      </Reveal>

      <section className="mt-8">
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

      {soonFeeds.length > 0 && (
        <section className="mt-8 mb-4">
          <SectionHeader title="Coming soon" href="/explorer" />
          <div className="grid gap-5 grid-cols-1 md:grid-cols-2 lg:grid-cols-4">
            {soonFeeds.map((feed) => (
              <AssetCard
                key={feed.sourceId}
                sourceId={feed.sourceId}
                displayName={feed.displayName}
                meta={feed.meta}
                series={feed.series}
                assetName={feed.assetName}
                assetValue={feed.assetValue}
                coverage={feed.coverage}
              />
            ))}
          </div>
        </section>
      )}
    </div>
  )
}
