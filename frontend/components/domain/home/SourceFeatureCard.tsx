import type { ReactNode } from 'react'
import { Link } from '@/i18n/routing'
import { Sparkline } from './Sparkline'

export type Coverage = 'anticheat' | 'external' | 'soon'
export type CardSize = 'hero' | 'medium' | 'small'

export type SourceFeatureCardProps = {
  sourceId: string
  displayName: string
  series: number[]
  meta?: string
  size?: CardSize
  coverage?: Coverage
  hrefOverride?: string
  badge?: string
  accentColor?: string
  /** Optional brand logo. When set, renders above the displayName which becomes sr-only. */
  logo?: ReactNode
}

const SIZE_HEIGHT: Record<CardSize, number> = {
  hero: 200,
  medium: 120,
  small: 84,
}

const SIZE_TITLE: Record<CardSize, string> = {
  hero: 'var(--apple-fs-32)',
  medium: 'var(--apple-fs-24)',
  small: 'var(--apple-fs-19)',
}

const SIZE_PADDING: Record<CardSize, string> = {
  hero: '24px',
  medium: '20px',
  small: '16px',
}

function CoveragePill({ coverage }: { coverage: Coverage }) {
  if (coverage === 'anticheat') {
    return (
      <span className="apple-pill apple-pill--anticheat" aria-label="Anti-Cheat verified">
        <svg viewBox="0 0 12 12" width="11" height="11" aria-hidden="true">
          <path
            d="M6 1L2 3v3.2c0 2.4 1.7 4.4 4 4.8 2.3-.4 4-2.4 4-4.8V3L6 1z"
            fill="currentColor"
          />
          <path d="M4.4 6l1.2 1.2L8 4.8" stroke="white" strokeWidth="1.2" fill="none" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        Anti-Cheat
      </span>
    )
  }
  if (coverage === 'external') {
    return <span className="apple-pill apple-pill--external">Source · External</span>
  }
  return <span className="apple-pill apple-pill--external">Coming soon</span>
}

export function SourceFeatureCard({
  sourceId,
  displayName,
  series,
  meta,
  size = 'medium',
  coverage = 'anticheat',
  hrefOverride,
  badge = 'Featured',
  accentColor,
  logo,
}: SourceFeatureCardProps) {
  const href = hrefOverride ?? `/source/${sourceId}`
  const stroke = accentColor ?? 'var(--apple-text)'
  const titleSize = SIZE_TITLE[size]
  const sparkH = SIZE_HEIGHT[size]
  const padding = SIZE_PADDING[size]

  return (
    <Link
      href={href as never}
      className="apple-card group relative flex flex-col overflow-hidden"
      style={{ padding }}
    >
      <div className="flex items-start justify-between gap-3 relative z-10">
        <div className="min-w-0">
          {logo ? (
            <>
              <span className="sr-only">{displayName}</span>
              <div className="flex items-center" aria-hidden="true">
                {logo}
              </div>
            </>
          ) : (
            <div
              className="font-semibold truncate"
              style={{
                fontFamily: 'var(--apple-font-display)',
                fontSize: titleSize,
                letterSpacing: 'var(--apple-track-tighter)',
                color: 'var(--apple-text)',
                lineHeight: 1.0714,
              }}
            >
              {displayName}
            </div>
          )}
          {meta && (
            <div
              className="mt-1 truncate"
              style={{
                fontFamily: 'var(--apple-font-text)',
                fontSize: 'var(--apple-fs-12)',
                color: 'var(--apple-text-secondary)',
                letterSpacing: 'var(--apple-track-tight)',
              }}
            >
              {meta}
            </div>
          )}
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          <span className="apple-pill apple-pill--featured">{badge}</span>
          <CoveragePill coverage={coverage} />
        </div>
      </div>

      <div className="mt-3 -mx-1" style={{ height: sparkH }}>
        <Sparkline
          series={series}
          height={sparkH}
          stroke={stroke}
          fill={stroke}
          ariaLabel={`${displayName} 24h activity`}
        />
      </div>
    </Link>
  )
}
