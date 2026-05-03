import type { ReactNode } from 'react'
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
  hrefOverride?: string
  pillLabel?: string
}

interface Props {
  feature: HeroSpec
  side: SourceFeed[]
  logo?: ReactNode
}

export function HeroCard({ feature, side, logo }: Props) {
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
      <div className="flex flex-col justify-between p-5 sm:p-7">
        <div>
          <div
            className="flex items-center gap-1.5"
            style={{
              fontSize: 12,
              color: 'var(--apple-text-secondary)',
              letterSpacing: '0.02em',
            }}
          >
            <CheckBadge />
            <span>{feature.pillLabel ?? 'Featured · Anti-Cheat verified'}</span>
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

      <div
        className="relative min-h-[180px] sm:min-h-[220px] lg:min-h-[260px]"
        style={{ background: sourceGradient(feature.sourceId) }}
      >
        {logo && (
          <div className="absolute top-4 left-4">
            {logo}
          </div>
        )}
        <div className="absolute inset-0 flex items-end p-4 sm:p-6">
          <div className="w-full" style={{ height: 220 }}>
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
      </div>

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
            ariaLabel=""
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
          {feed.meta}
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

function CheckBadge() {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden>
      <path d="M6 1L2 3v3.2c0 2.4 1.7 4.4 4 4.8 2.3-.4 4-2.4 4-4.8V3L6 1z" fill="#0071e3" />
      <path
        d="M4.4 6l1.2 1.2L8 4.8"
        stroke="white"
        strokeWidth="1.2"
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}
