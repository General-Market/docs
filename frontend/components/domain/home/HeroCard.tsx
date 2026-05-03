import Image from 'next/image'
import { Link } from '@/i18n/routing'
import { sourceGradient } from './source-hue'
import type { Coverage } from './AssetCard'
import type { SourceFeed } from '@/lib/vision/adapters'

type HeroSpec = {
  sourceId: string
  displayName: string
  meta: string
  coverage: Coverage
  assetName?: string
  assetValue?: string
  imageUrl?: string
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
        <ShieldDot />
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

function ShieldDot() {
  return (
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
  )
}

function FeaturedTag() {
  return (
    <div
      className="inline-flex items-center gap-1.5 font-medium"
      style={{
        fontFamily: 'var(--apple-font-text)',
        fontSize: 12,
        letterSpacing: '0.02em',
        color: 'var(--apple-text-secondary)',
      }}
    >
      <svg width="11" height="11" viewBox="0 0 12 12" aria-hidden>
        <path d="M6 1l1.4 3.2L11 5l-3.6.8L6 11 4.6 5.8 1 5l3.6-.8L6 1z" fill="#0071e3" />
      </svg>
      <span>Featured</span>
    </div>
  )
}

function PlayIcon() {
  return (
    <svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M8 5v14l11-7z" />
    </svg>
  )
}

export function HeroCard({ feature, side }: Props) {
  const href = feature.hrefOverride ?? `/source/${feature.sourceId}`

  return (
    <div
      className="grid gap-0 overflow-hidden border grid-cols-1 lg:grid-cols-[minmax(280px,340px)_1fr_minmax(260px,320px)]"
      style={{
        background: 'var(--apple-panel)',
        borderColor: 'var(--apple-line)',
        borderRadius: 'var(--apple-r-card)',
      }}
    >
      {/* Left + middle wrapped in one Link → fully clickable */}
      <Link
        href={href as never}
        className="contents group"
        aria-label={`Open ${feature.displayName} — ${feature.assetName ?? ''}`}
      >
        <div className="flex flex-col justify-between p-6 sm:p-8">
          <div>
            <FeaturedTag />
            <h2
              className="mt-3 font-semibold"
              style={{
                fontFamily: 'var(--apple-font-display)',
                fontSize: 32,
                letterSpacing: 'var(--apple-track-tight)',
                lineHeight: 1.07,
                color: 'var(--apple-text)',
              }}
            >
              {feature.assetName ?? feature.displayName}
            </h2>
            <p
              className="mt-3"
              style={{
                fontSize: 14,
                lineHeight: 1.4,
                color: 'var(--apple-text-secondary)',
              }}
            >
              {feature.meta}
            </p>
            <div className="mt-4 flex items-center gap-2">
              <PillCoverage coverage={feature.coverage} />
            </div>
          </div>
          <span
            className="inline-flex w-fit items-center gap-2 mt-6 transition group-hover:opacity-90"
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
          </span>
        </div>

        <div
          className="relative min-h-[240px] sm:min-h-[280px] lg:min-h-[320px] overflow-hidden"
          style={{ background: sourceGradient(feature.sourceId) }}
        >
          {feature.imageUrl && (
            <div className="absolute inset-0 flex items-center justify-center p-10 transition group-hover:scale-[1.03]">
              <div className="relative w-full h-full max-w-[60%] max-h-[60%]">
                <Image
                  src={feature.imageUrl}
                  alt={`${feature.displayName} logo`}
                  fill
                  className="object-contain"
                  sizes="(min-width: 1024px) 40vw, 100vw"
                  priority
                  unoptimized
                />
              </div>
            </div>
          )}
          {feature.assetValue && (
            <div
              className="absolute bottom-4 right-4 rounded-apple-sm px-2.5 py-1 font-semibold num"
              style={{
                fontSize: 12,
                letterSpacing: '0.02em',
                background: 'rgba(255,255,255,0.85)',
                color: 'var(--apple-text)',
                backdropFilter: 'saturate(180%) blur(8px)',
                fontVariantNumeric: 'tabular-nums',
              }}
            >
              {feature.assetValue}
            </div>
          )}
        </div>
      </Link>

      {/* Right side rail — independent links per row */}
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
        className="relative h-14 w-20 shrink-0 overflow-hidden flex items-center justify-center p-1.5"
        style={{
          borderRadius: 'var(--apple-r-sm)',
          background: sourceGradient(feed.sourceId),
        }}
      >
        {feed.imageUrl && (
          <div className="relative w-full h-full">
            <Image
              src={feed.imageUrl}
              alt=""
              fill
              className="object-contain"
              sizes="80px"
              unoptimized
            />
          </div>
        )}
      </div>
      <div className="min-w-0 flex-1">
        <div
          className="font-medium line-clamp-2"
          style={{
            fontSize: 13,
            letterSpacing: 'var(--apple-track-tighter)',
            color: 'var(--apple-text)',
            lineHeight: 1.3,
          }}
        >
          {feed.assetName ?? feed.displayName}
        </div>
        <div
          className="mt-0.5 truncate"
          style={{
            fontSize: 11,
            color: 'var(--apple-text-secondary)',
          }}
        >
          {feed.displayName}
        </div>
      </div>
    </Link>
  )
}
