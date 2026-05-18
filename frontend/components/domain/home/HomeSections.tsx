import { AssetCard } from './AssetCard'
import { HeroCarousel } from './HeroCarousel'
import { ScrollRow } from './ScrollRow'
import { Reveal } from '@/components/ui/Reveal'
import type { SourceFeed } from '@/lib/vision/adapters'
import {
  FEATURED_SOURCES,
  seededSeries,
} from '@/lib/vision/featured-sources'

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

const TOP_MARKETS_SET: ReadonlySet<string> = new Set(TOP_MARKETS_IDS)

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
  // Featured cards live alongside Top Markets — drop any that already
  // appear there to avoid double-listing the same source.
  const featured = FEATURED_SOURCES.filter((s) => !TOP_MARKETS_SET.has(s.id))

  return (
    <div className="px-6 py-6 md:px-8 lg:px-10 lg:py-7">
      <Reveal mask>
        <h1
          className="font-semibold"
          style={{
            fontFamily: 'var(--apple-font-display)',
            fontSize: 28,
            letterSpacing: 'var(--apple-track-tight)',
            lineHeight: 1.07,
            color: 'var(--apple-text)',
          }}
        >
          Trading is easy with an Anti-Cheat
        </h1>
      </Reveal>

      <Reveal delay={0.08} className="mt-4">
        <HeroCarousel features={heroRotation} side={side} />
      </Reveal>

      <section className="mt-6">
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

      {featured.length > 0 && (
        <section className="mt-6 mb-4">
          <SectionHeader title="More sources" href="/explorer" />
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-x-4 gap-y-8 lg:gap-y-10">
            {featured.map((s) => {
              const live = feeds[s.id]
              return (
                <AssetCard
                  key={s.id}
                  sourceId={s.id}
                  displayName={s.displayName}
                  meta={s.meta}
                  series={live?.series?.length ? live.series : seededSeries(s.id)}
                  assetName={live?.assetName ?? s.assetName}
                  assetValue={live?.assetValue}
                  coverage={live?.coverage ?? 'anticheat'}
                />
              )
            })}
          </div>
        </section>
      )}
    </div>
  )
}
