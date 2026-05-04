import { AssetCard } from './AssetCard'
import { HeroCard } from './HeroCard'
import type { SourceFeed } from '@/lib/vision/adapters'

type FeedMap = Record<string, SourceFeed>

const HERO_ID = 'polymarket'
const SIDE_RAIL_IDS = ['pumpfun', 'defillama', 'equities', 'espn'] as const
const FEATURED_ROW_IDS = ['defillama', 'equities', 'espn', 'iss'] as const
const TOP_MARKETS_IDS = ['twitch', 'steam', 'github', 'pumpfun'] as const

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
      {href && (
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
      )}
    </div>
  )
}

export function HomeDashboard({ feeds }: { feeds: FeedMap }) {
  const hero = pick(feeds, HERO_ID)
  const side = SIDE_RAIL_IDS.map((id) => pick(feeds, id))
  const featuredRow = FEATURED_ROW_IDS.map((id) => pick(feeds, id))
  const topMarkets = TOP_MARKETS_IDS.map((id) => pick(feeds, id))

  return (
    <div className="px-6 py-8 md:px-8 lg:px-10 lg:py-10">
      <div>
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
      </div>

      <div className="mt-8">
        <HeroCard
          feature={{
            sourceId: hero.sourceId,
            displayName: hero.displayName,
            meta: hero.meta,
            series: hero.series,
            coverage: hero.coverage,
            assetName: hero.assetName,
            assetValue: hero.assetValue,
            hrefOverride: hero.hrefOverride,
          }}
          side={side}
        />
      </div>

      <section className="mt-12">
        <SectionHeader title="Top markets" href="/explorer" />
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 sm:gap-6 lg:grid-cols-4">
          {featuredRow.map((feed) => (
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
        </div>
      </section>

      <section className="mt-12 mb-4">
        <SectionHeader title="Recently active" />
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 sm:gap-6 lg:grid-cols-4">
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
        </div>
      </section>
    </div>
  )
}
