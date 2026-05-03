import { Link } from '@/i18n/routing'
import { Sparkline } from './Sparkline'
import { sourceGradient, sourceStroke, sourceFill } from './source-hue'
import type { Coverage } from './AssetCard'
import type { SourceFeed } from '@/lib/vision/adapters'

type HeroSpec = {
  sourceId: string
  displayName: string
  meta: string
  series: number[]
  coverage: Coverage
  assetName?: string
  assetValue?: string
  hrefOverride?: string
}

interface Props {
  feature: HeroSpec
  side: SourceFeed[]
}

function PillCoverage({ coverage }: { coverage: Coverage }) {
  if (coverage === 'anticheat') {
    return (
      <span
        className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 font-semibold"
        style={{
          background: '#0071e3',
          color: '#fff',
          fontSize: 11,
          letterSpacing: '0.04em',
        }}
      >
        <svg width="11" height="11" viewBox="0 0 12 12" aria-hidden>
          <path
            d="M6 1L2 3v3.2c0 2.4 1.7 4.4 4 4.8 2.3-.4 4-2.4 4-4.8V3L6 1z"
            fill="currentColor"
          />
          <path
            d="M4.4 6l1.2 1.2L8 4.8"
            stroke="#0071e3"
            strokeWidth="1.4"
            fill="none"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
        Anti-Cheat
      </span>
    )
  }
  if (coverage === 'external') {
    return (
      <span
        className="inline-flex items-center rounded-full px-2.5 py-1 font-medium border"
        style={{
          color: 'var(--apple-text-secondary)',
          borderColor: 'var(--apple-line)',
          background: 'transparent',
          fontSize: 11,
          letterSpacing: '0.04em',
        }}
      >
        External source
      </span>
    )
  }
  return (
    <span
      className="inline-flex items-center rounded-full px-2.5 py-1 font-medium border"
      style={{
        color: 'var(--apple-text-tertiary)',
        borderColor: 'var(--apple-line)',
        fontSize: 11,
        letterSpacing: '0.04em',
      }}
    >
      Coming soon
    </span>
  )
}

export function HeroCard({ feature, side }: Props) {
  const href = feature.hrefOverride ?? `/source/${feature.sourceId}`

  return (
    <div
      className="grid gap-0 overflow-hidden border grid-cols-1 lg:grid-cols-[minmax(260px,320px)_1fr_minmax(240px,300px)]"
      style={{
        background: 'var(--apple-panel)',
        borderColor: 'var(--apple-line)',
        borderRadius: 'var(--apple-r-card)',
      }}
    >
      {/* Left column — text + CTA */}
      <div className="flex flex-col justify-between p-5 sm:p-7">
        <div>
          <div className="flex items-center gap-2">
            <span
              className="inline-flex items-center rounded-full px-2 py-0.5 font-semibold"
              style={{
                background: 'var(--apple-text)',
                color: '#fff',
                fontSize: 10,
                letterSpacing: '0.04em',
              }}
            >
              FEATURED
            </span>
            <PillCoverage coverage={feature.coverage} />
          </div>
          <h2
            className="mt-3 font-semibold"
            style={{
              fontFamily: 'var(--apple-font-display)',
              fontSize: 28,
              letterSpacing: 'var(--apple-track-tight)',
              lineHeight: 1.07,
              color: 'var(--apple-text)',
            }}
          >
            {feature.displayName}
          </h2>
          <p
            className="mt-2"
            style={{
              fontSize: 14,
              lineHeight: 1.4,
              color: 'var(--apple-text-secondary)',
            }}
          >
            {feature.meta}
          </p>
        </div>
        <Link
          href={href as never}
          className="inline-flex w-fit items-center gap-2 mt-6 transition hover:opacity-90"
          style={{
            background: 'var(--apple-text)',
            color: '#fff',
            borderRadius: 'var(--apple-r-pill)',
            padding: '10px 18px',
            fontSize: 14,
            fontWeight: 500,
            letterSpacing: '-0.01em',
          }}
        >
          <PlayIcon />
          Open
        </Link>
      </div>

      {/* Middle — gradient + asset name + sparkline */}
      <div
        className="relative min-h-[180px] sm:min-h-[220px] lg:min-h-[260px]"
        style={{ background: sourceGradient(feature.sourceId) }}
      >
        {feature.assetName && (
          <div className="absolute top-6 left-6 right-6 z-10">
            <div
              className="font-semibold"
              style={{
                fontFamily: 'var(--apple-font-display)',
                fontSize: 22,
                letterSpacing: 'var(--apple-track-tight)',
                color: 'var(--apple-text)',
                lineHeight: 1.1,
              }}
            >
              {feature.assetName}
            </div>
            {feature.assetValue && (
              <div
                className="mt-1"
                style={{
                  fontFamily: 'var(--apple-font-text)',
                  fontSize: 13,
                  letterSpacing: 'var(--apple-track-tight)',
                  color: 'var(--apple-text-secondary)',
                  fontVariantNumeric: 'tabular-nums',
                }}
              >
                {feature.assetValue}
              </div>
            )}
          </div>
        )}
        <div className="absolute inset-x-0 bottom-0 h-[60%]">
          <Sparkline
            series={feature.series}
            width={800}
            height={220}
            stroke={sourceStroke(feature.sourceId)}
            fill={sourceFill(feature.sourceId)}
            ariaLabel={`${feature.displayName} 24h activity`}
          />
        </div>
      </div>

      {/* Right side rail */}
      <div
        className="flex flex-col border-t lg:border-l lg:border-t-0"
        style={{ borderColor: 'var(--apple-line)' }}
      >
        {side.slice(0, 4).map((s) => (
          <SideRow key={s.sourceId} feed={s} />
        ))}
      </div>
    </div>
  )
}

function SideRow({ feed }: { feed: SourceFeed }) {
  const href = feed.hrefOverride ?? `/source/${feed.sourceId}`
  return (
    <Link
      href={href as never}
      className="flex flex-1 items-center gap-3 border-b px-4 py-3 last:border-b-0 transition hover:bg-[rgba(0,0,0,0.02)]"
      style={{ borderColor: 'var(--apple-line)' }}
    >
      <div
        className="relative h-12 w-20 shrink-0 overflow-hidden"
        style={{
          borderRadius: 'var(--apple-r-sm)',
          background: sourceGradient(feed.sourceId),
        }}
      >
        <div className="absolute inset-0">
          <Sparkline
            series={feed.series}
            width={160}
            height={48}
            stroke={sourceStroke(feed.sourceId)}
            fill={sourceFill(feed.sourceId)}
          />
        </div>
      </div>
      <div className="min-w-0 flex-1">
        <div
          className="truncate font-medium"
          style={{
            fontSize: 13,
            letterSpacing: 'var(--apple-track-tighter)',
            color: 'var(--apple-text)',
          }}
        >
          {feed.displayName}
        </div>
        <div
          className="truncate"
          style={{
            fontSize: 11,
            color: 'var(--apple-text-secondary)',
          }}
        >
          {feed.assetName ?? feed.meta}
        </div>
      </div>
    </Link>
  )
}

function PlayIcon() {
  return (
    <svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M8 5v14l11-7z" />
    </svg>
  )
}
