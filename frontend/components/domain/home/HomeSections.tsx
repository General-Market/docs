import type { ReactNode } from 'react'
import { AssetCard } from './AssetCard'
import { HeroCard } from './HeroCard'
import { NyseLogo } from './source-logos'
import type { SourceFeed } from '@/lib/vision/adapters'

type FeedMap = Record<string, SourceFeed>

const HERO_ID = 'polymarket'
const SIDE_RAIL_IDS = ['pumpfun', 'defillama', 'equities', 'espn'] as const
const FEATURED_ROW_IDS = ['defillama', 'equities', 'espn', 'iss'] as const
const TOP_MARKETS_IDS = ['twitch', 'steam', 'github', 'pumpfun'] as const

const STATIC_LOGOS: Partial<Record<string, () => ReactNode>> = {
  equities: () => <NyseLogo height={20} />,
}

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
    <div className="px-4 py-6 sm:px-8 sm:py-8 max-w-[1200px] mx-auto">
      <div>
        <p
          className="mb-2"
          style={{
            fontFamily: 'var(--apple-font-text)',
            fontSize: 11,
            letterSpacing: '0.04em',
            color: 'var(--apple-accent)',
            textTransform: 'uppercase',
            fontWeight: 600,
          }}
        >
          Anti-Cheat
        </p>
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
          Trading is easy with an Anti-Cheat.
        </h1>
        <p
          className="mt-2 max-w-[640px]"
          style={{
            fontFamily: 'var(--apple-font-text)',
            fontSize: 15,
            letterSpacing: 'var(--apple-track-tighter)',
            color: 'var(--apple-text-secondary)',
            lineHeight: 1.4,
          }}
        >
          Sealed bets. Parimutuel pools. Oracle consensus you can verify.
          The market can&apos;t see your hand and neither can the house.
        </p>
      </div>

      <div className="mt-6">
        <HeroCard feature={hero} side={side} />
      </div>

      <section className="mt-10">
        <SectionHeader title="Top markets" href="/explorer" />
        <div className="grid grid-cols-2 gap-4 sm:gap-6 lg:grid-cols-4">
          {featuredRow.map((feed) => {
            const Logo = STATIC_LOGOS[feed.sourceId]
            return (
              <AssetCard
                key={feed.sourceId}
                sourceId={feed.sourceId}
                displayName={feed.displayName}
                meta={feed.meta}
                series={feed.series}
                coverage={feed.coverage}
                hrefOverride={feed.hrefOverride}
                logo={Logo ? Logo() : undefined}
              />
            )
          })}
        </div>
      </section>

      <section className="mt-10 mb-4">
        <SectionHeader title="Recently active" />
        <div className="grid grid-cols-2 gap-4 sm:gap-6 lg:grid-cols-4">
          {topMarkets.map((feed) => {
            const Logo = STATIC_LOGOS[feed.sourceId]
            return (
              <AssetCard
                key={feed.sourceId}
                sourceId={feed.sourceId}
                displayName={feed.displayName}
                meta={feed.meta}
                series={feed.series}
                coverage={feed.coverage}
                hrefOverride={feed.hrefOverride}
                logo={Logo ? Logo() : undefined}
              />
            )
          })}
        </div>
      </section>
    </div>
  )
}
