import { SourceFeatureCard } from './SourceFeatureCard'
import { NyseLogo } from './source-logos'
import type { SourceFeed } from '@/lib/vision/adapters'

type FeedMap = Record<string, SourceFeed>

const FEATURED_ROW_IDS = ['defillama', 'equities', 'espn'] as const
const TOP_MARKETS_IDS = ['twitch', 'steam', 'github', 'iss'] as const

function pick(feeds: FeedMap, id: string, fallbackName: string): SourceFeed {
  return (
    feeds[id] ?? {
      sourceId: id,
      displayName: fallbackName,
      meta: 'Loading…',
      coverage: 'soon',
      series: [],
    }
  )
}

function asCardProps(feed: SourceFeed) {
  return {
    sourceId: feed.sourceId,
    displayName: feed.displayName,
    meta: feed.meta,
    coverage: feed.coverage,
    series: feed.series,
    hrefOverride: feed.hrefOverride,
  }
}

export function FeaturedHero({ feeds }: { feeds: FeedMap }) {
  const f = pick(feeds, 'polymarket', 'Polymarket')
  return (
    <SourceFeatureCard
      {...asCardProps(f)}
      size="hero"
      accentColor="var(--apple-accent)"
    />
  )
}

const ROW_LOGO: Partial<Record<string, () => React.ReactNode>> = {
  equities: () => <NyseLogo height={28} />,
}

export function FeaturedRow({ feeds }: { feeds: FeedMap }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {FEATURED_ROW_IDS.map((id) => {
        const f = pick(feeds, id, id)
        const renderLogo = ROW_LOGO[id]
        return (
          <SourceFeatureCard
            key={id}
            {...asCardProps(f)}
            size="medium"
            accentColor="var(--apple-text)"
            logo={renderLogo ? renderLogo() : undefined}
          />
        )
      })}
    </div>
  )
}

export function TopMarketsStrip({ feeds }: { feeds: FeedMap }) {
  return (
    <section>
      <h2
        className="mb-3"
        style={{
          fontFamily: 'var(--apple-font-display)',
          fontSize: 'var(--apple-fs-21)',
          letterSpacing: 'var(--apple-track-tight)',
          color: 'var(--apple-text)',
          fontWeight: 600,
        }}
      >
        Top markets
      </h2>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {TOP_MARKETS_IDS.map((id) => {
          const f = pick(feeds, id, id)
          return (
            <SourceFeatureCard
              key={id}
              {...asCardProps(f)}
              size="small"
              accentColor="var(--apple-text-secondary)"
            />
          )
        })}
      </div>
    </section>
  )
}

export function SidebarFeatured({ feeds }: { feeds: FeedMap }) {
  const f = pick(feeds, 'pumpfun', 'Pumpfun')
  return (
    <div className="p-4 flex flex-col gap-4">
      <div
        className="px-2"
        style={{
          fontFamily: 'var(--apple-font-text)',
          fontSize: 'var(--apple-fs-12)',
          color: 'var(--apple-text-tertiary)',
          letterSpacing: 'var(--apple-track-loose)',
          textTransform: 'uppercase',
          fontWeight: 600,
        }}
      >
        On the side
      </div>
      <SourceFeatureCard
        {...asCardProps(f)}
        size="medium"
        accentColor="var(--apple-accent-on-dark)"
      />
    </div>
  )
}
