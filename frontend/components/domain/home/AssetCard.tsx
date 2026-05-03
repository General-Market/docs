import type { ReactNode } from 'react'
import { Link } from '@/i18n/routing'
import { Sparkline } from './Sparkline'
import {
  sourceGradient,
  sourceStroke,
  sourceFill,
  avatarBackground,
  avatarForeground,
} from './source-hue'

export type Coverage = 'anticheat' | 'external' | 'soon'

export type AssetCardProps = {
  sourceId: string
  displayName: string
  meta: string
  series: number[]
  /** Specific sub-market label rendered over the chart. */
  assetName?: string
  /** Number printed beside the assetName. */
  assetValue?: string
  coverage?: Coverage
  hrefOverride?: string
  badge?: string
  /** Optional element rendered inside the avatar circle. */
  avatar?: ReactNode
}

function CoveragePill({ coverage }: { coverage: Coverage }) {
  if (coverage === 'anticheat') {
    return (
      <span
        className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-semibold"
        style={{
          background: '#0071e3',
          color: '#fff',
          fontSize: 10,
          letterSpacing: '0.04em',
        }}
        aria-label="Anti-Cheat verified"
      >
        <svg width="9" height="9" viewBox="0 0 12 12" aria-hidden>
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
        className="inline-flex items-center rounded-full px-2 py-0.5 font-medium"
        style={{
          background: 'rgba(255,255,255,0.85)',
          color: 'var(--apple-text-secondary)',
          fontSize: 10,
          letterSpacing: '0.04em',
          backdropFilter: 'saturate(180%) blur(8px)',
        }}
      >
        External
      </span>
    )
  }
  return (
    <span
      className="inline-flex items-center rounded-full px-2 py-0.5 font-medium"
      style={{
        background: 'rgba(255,255,255,0.85)',
        color: 'var(--apple-text-tertiary)',
        fontSize: 10,
        letterSpacing: '0.04em',
        backdropFilter: 'saturate(180%) blur(8px)',
      }}
    >
      Soon
    </span>
  )
}

export function AssetCard({
  sourceId,
  displayName,
  meta,
  series,
  assetName,
  assetValue,
  coverage = 'anticheat',
  hrefOverride,
  badge,
  avatar,
}: AssetCardProps) {
  const href = hrefOverride ?? `/source/${sourceId}`

  return (
    <Link
      href={href as never}
      className="group flex flex-col gap-3 text-left transition"
    >
      <div
        className="relative aspect-[16/10] w-full overflow-hidden"
        style={{
          borderRadius: 'var(--apple-r-md)',
          background: sourceGradient(sourceId),
        }}
      >
        {/* Top row: badge left, coverage pill right */}
        <div className="absolute top-3 left-3 right-3 z-10 flex items-start justify-between gap-2">
          {badge ? (
            <span
              className="inline-flex items-center rounded-full px-2 py-0.5 font-semibold text-white"
              style={{
                fontSize: 10,
                letterSpacing: '0.04em',
                background: 'rgba(0,0,0,0.65)',
                backdropFilter: 'saturate(180%) blur(8px)',
              }}
            >
              {badge}
            </span>
          ) : (
            <span />
          )}
          <CoveragePill coverage={coverage} />
        </div>

        {/* Asset label + value, mid-card */}
        {assetName && (
          <div className="absolute left-3 right-3 z-10" style={{ top: '46%' }}>
            <div
              className="font-semibold truncate"
              style={{
                fontFamily: 'var(--apple-font-display)',
                fontSize: 17,
                letterSpacing: 'var(--apple-track-tight)',
                color: 'var(--apple-text)',
                lineHeight: 1.1,
              }}
            >
              {assetName}
            </div>
            {assetValue && (
              <div
                className="num mt-0.5"
                style={{
                  fontFamily: 'var(--apple-font-text)',
                  fontSize: 12,
                  letterSpacing: 'var(--apple-track-tight)',
                  color: 'var(--apple-text-secondary)',
                  fontVariantNumeric: 'tabular-nums',
                }}
              >
                {assetValue}
              </div>
            )}
          </div>
        )}

        {/* Sparkline anchored to the bottom */}
        <div className="absolute inset-x-0 bottom-0 h-[44%]">
          <Sparkline
            series={series}
            width={400}
            height={120}
            stroke={sourceStroke(sourceId)}
            fill={sourceFill(sourceId)}
            ariaLabel={`${displayName} 24h activity`}
          />
        </div>
      </div>

      <div className="flex gap-3 items-center">
        <div
          className="grid h-9 w-9 shrink-0 place-items-center rounded-full overflow-hidden"
          style={{
            background: avatarBackground,
            color: avatarForeground,
            fontSize: 13,
            fontWeight: 600,
            letterSpacing: 'var(--apple-track-tighter)',
          }}
        >
          {avatar ?? displayName.charAt(0).toUpperCase()}
        </div>
        <div className="min-w-0 flex-1">
          <div
            className="truncate font-medium"
            style={{
              fontFamily: 'var(--apple-font-text)',
              fontSize: 14,
              letterSpacing: 'var(--apple-track-tighter)',
              color: 'var(--apple-text)',
              lineHeight: 1.3,
            }}
          >
            {displayName}
          </div>
          <div
            className="mt-0.5 truncate"
            style={{
              fontFamily: 'var(--apple-font-text)',
              fontSize: 12,
              color: 'var(--apple-text-secondary)',
            }}
          >
            {meta}
          </div>
        </div>
      </div>
    </Link>
  )
}
