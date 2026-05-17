import { Link } from '@/i18n/routing'
import { Sparkline } from './Sparkline'
import { ShineOverlay } from './ShineOverlay'
import { sourceGradient, sourceStroke, sourceFill } from './source-hue'

export type Coverage = 'anticheat' | 'external' | 'soon'

export type AssetCardProps = {
  sourceId: string
  displayName: string
  meta: string
  series: number[]
  /** Sub-market label rendered as the secondary line on the chart. */
  assetName?: string
  /** Number printed on the chart's last point. */
  assetValue?: string
  coverage?: Coverage
  hrefOverride?: string
  badge?: string
}

function ShieldDot() {
  return (
    <svg width="9" height="9" viewBox="0 0 12 12" aria-hidden>
      <path
        d="M6 1L2 3v3.2c0 2.4 1.7 4.4 4 4.8 2.3-.4 4-2.4 4-4.8V3L6 1z"
        fill="currentColor"
      />
      <path
        d="M4.4 6l1.2 1.2L8 4.8"
        stroke="#F5F5F7"
        strokeWidth="1.4"
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

function CoveragePill({ coverage }: { coverage: Coverage }) {
  if (coverage === 'anticheat') {
    return (
      <span
        className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-semibold"
        style={{
          background: '#F5F5F7',
          color: '#6E6E73',
          fontSize: 10,
          letterSpacing: '0.04em',
        }}
        aria-label="Anti-Cheat verified"
      >
        <ShieldDot />
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
  return null
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
}: AssetCardProps) {
  const href = hrefOverride ?? `/source/${sourceId}`

  return (
    <Link
      href={href as never}
      className="group flex flex-col gap-2 text-left transition"
    >
      <div
        className="relative aspect-[16/8] w-full overflow-hidden isolate border"
        style={{
          borderRadius: 'var(--apple-r-md)',
          background: sourceGradient(sourceId),
          borderColor: 'var(--apple-line)',
        }}
      >
        <ShineOverlay size={260} intensity={0.22} />

        {/* Top row — big source name + Anti-Cheat pill */}
        <div className="absolute top-3 left-4 right-3 z-10 flex items-start justify-between gap-2">
          <div className="min-w-0">
            <div
              className="font-semibold truncate"
              style={{
                fontFamily: 'var(--apple-font-display)',
                fontSize: 22,
                letterSpacing: 'var(--apple-track-tight)',
                color: 'var(--apple-text)',
                lineHeight: 1.05,
              }}
            >
              {displayName}
            </div>
            {assetName && (
              <div
                className="mt-0.5 truncate font-medium"
                style={{
                  fontFamily: 'var(--apple-font-text)',
                  fontSize: 12,
                  letterSpacing: 'var(--apple-track-tight)',
                  color: 'var(--apple-text-secondary)',
                  maxWidth: '100%',
                }}
                title={assetName}
              >
                {assetName}
              </div>
            )}
          </div>
          <div className="flex flex-col items-end gap-1 shrink-0">
            {badge && (
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
            )}
            <CoveragePill coverage={coverage} />
          </div>
        </div>

        {/* Sparkline filling the bottom 60% of the tile */}
        <div className="absolute inset-x-0 bottom-0 h-[55%] overflow-hidden">
          <Sparkline
            series={series}
            width={400}
            height={120}
            stroke={sourceStroke(sourceId)}
            fill={sourceFill(sourceId)}
            ariaLabel={`${displayName} 24h activity`}
          />
        </div>

        {/* Value chip pinned to the bottom-right, sits above the sparkline */}
        {assetValue && (
          <div
            className="absolute bottom-3 right-3 z-10 rounded-full px-2 py-0.5 font-semibold num"
            style={{
              fontSize: 11,
              letterSpacing: '0.02em',
              background: 'rgba(255,255,255,0.92)',
              color: 'var(--apple-text)',
              backdropFilter: 'saturate(180%) blur(8px)',
              fontVariantNumeric: 'tabular-nums',
            }}
          >
            {assetValue}
          </div>
        )}
      </div>

      <div
        className="px-1 truncate"
        style={{
          fontFamily: 'var(--apple-font-text)',
          fontSize: 12,
          color: 'var(--apple-text-tertiary)',
          letterSpacing: 'var(--apple-track-tight)',
        }}
      >
        {meta}
      </div>
    </Link>
  )
}
