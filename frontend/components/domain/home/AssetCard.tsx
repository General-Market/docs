import type { ReactNode } from 'react'
import { Link } from '@/i18n/routing'
import { Sparkline } from './Sparkline'
import { sourceGradient, sourceStroke, sourceFill, sourceAvatar } from './source-hue'

export type Coverage = 'anticheat' | 'external' | 'soon'

export type AssetCardProps = {
  sourceId: string
  displayName: string
  meta: string
  series: number[]
  coverage?: Coverage
  hrefOverride?: string
  badge?: string
  logo?: ReactNode
}

function CoverageDot({ coverage }: { coverage: Coverage }) {
  if (coverage === 'anticheat') {
    return (
      <svg width="12" height="12" viewBox="0 0 12 12" aria-label="Anti-Cheat verified">
        <path
          d="M6 1L2 3v3.2c0 2.4 1.7 4.4 4 4.8 2.3-.4 4-2.4 4-4.8V3L6 1z"
          fill="#0071e3"
        />
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
  if (coverage === 'external') {
    return (
      <span
        className="inline-block rounded-full"
        style={{
          width: 8,
          height: 8,
          background: 'rgba(0,0,0,0.18)',
        }}
        aria-label="External source"
      />
    )
  }
  return null
}

export function AssetCard({
  sourceId,
  displayName,
  meta,
  series,
  coverage = 'anticheat',
  hrefOverride,
  badge,
  logo,
}: AssetCardProps) {
  const href = hrefOverride ?? `/source/${sourceId}`

  return (
    <Link
      href={href as never}
      className="group flex flex-col gap-2.5 text-left transition"
    >
      <div
        className="relative aspect-[16/9] w-full overflow-hidden"
        style={{
          borderRadius: 'var(--apple-r-md)',
          background: sourceGradient(sourceId),
        }}
      >
        <div className="absolute inset-0 flex items-end p-3">
          <div className="w-full h-full">
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
        {badge && (
          <div
            className="absolute top-2 right-2 rounded-full px-2 py-0.5 font-semibold text-white"
            style={{
              fontSize: 10,
              letterSpacing: '0.04em',
              background: 'rgba(0,0,0,0.65)',
            }}
          >
            {badge}
          </div>
        )}
      </div>
      <div className="flex gap-3">
        <div
          className="grid h-9 w-9 shrink-0 place-items-center rounded-full font-medium text-white overflow-hidden"
          style={{
            fontSize: 12,
            background: sourceAvatar(sourceId),
          }}
        >
          {logo ? logo : displayName.charAt(0).toUpperCase()}
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
            className="mt-0.5 flex items-center gap-1.5 truncate"
            style={{
              fontFamily: 'var(--apple-font-text)',
              fontSize: 12,
              color: 'var(--apple-text-secondary)',
            }}
          >
            <span className="truncate">{meta}</span>
            <CoverageDot coverage={coverage} />
          </div>
        </div>
      </div>
    </Link>
  )
}
