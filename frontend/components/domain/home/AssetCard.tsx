import Image from 'next/image'
import { Link } from '@/i18n/routing'
import { sourceGradient } from './source-hue'

export type Coverage = 'anticheat' | 'external' | 'soon'

export type AssetCardProps = {
  sourceId: string
  displayName: string
  meta: string
  imageUrl?: string
  /** Specific sub-market label rendered as the card title. */
  assetName?: string
  /** Number printed under the title. */
  assetValue?: string
  coverage?: Coverage
  hrefOverride?: string
  badge?: string
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
          backdropFilter: 'saturate(180%) blur(8px)',
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

function ShieldDot() {
  return (
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
  )
}

function VerifiedDot() {
  return (
    <svg width="11" height="11" viewBox="0 0 24 24" fill="#0071e3" aria-hidden>
      <path d="M9.4 1.5L8 4l-2.6.4 1.4 2.4L6 9.5l2.4-1L10 11l1.4-2.5 2.4 1-.8-2.7L14.4 4.4 11.7 4 10.4 1.5 9.4 1.5z M9.6 7l-1.5-1.5.7-.7 0.8.8 1.7-1.7.7.7L9.6 7z" />
    </svg>
  )
}

export function AssetCard({
  sourceId,
  displayName,
  meta,
  imageUrl,
  assetName,
  assetValue,
  coverage = 'anticheat',
  hrefOverride,
  badge,
}: AssetCardProps) {
  const href = hrefOverride ?? `/source/${sourceId}`
  const initial = displayName.charAt(0).toUpperCase()

  return (
    <Link
      href={href as never}
      className="group flex flex-col gap-2.5 text-left transition"
    >
      <div
        className="relative aspect-[16/10] w-full overflow-hidden"
        style={{
          borderRadius: 'var(--apple-r-md)',
          background: sourceGradient(sourceId),
        }}
      >
        {imageUrl && (
          <div className="absolute inset-0 flex items-center justify-center p-6 transition group-hover:scale-[1.04]">
            <div className="relative w-full h-full max-w-[55%] max-h-[55%]">
              <Image
                src={imageUrl}
                alt={`${displayName} logo`}
                fill
                className="object-contain"
                sizes="(min-width: 1024px) 12vw, (min-width: 640px) 25vw, 50vw"
                unoptimized
              />
            </div>
          </div>
        )}
        {/* Bottom-left asset label on a low-opacity scrim — readable on any tint */}
        {assetName && (
          <div className="absolute left-3 right-3 bottom-3 z-10">
            <div
              className="inline-block px-2.5 py-1 rounded-apple-sm font-semibold"
              style={{
                fontFamily: 'var(--apple-font-display)',
                fontSize: 13,
                letterSpacing: 'var(--apple-track-tight)',
                lineHeight: 1.15,
                color: 'var(--apple-text)',
                background: 'rgba(255,255,255,0.85)',
                backdropFilter: 'saturate(180%) blur(8px)',
                maxWidth: '85%',
              }}
            >
              {assetName}
            </div>
          </div>
        )}
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

        {/* Bottom-right value chip */}
        {assetValue && (
          <div
            className="absolute bottom-3 right-3 z-10 rounded-apple-sm px-2 py-1 font-semibold num"
            style={{
              fontSize: 11,
              letterSpacing: '0.02em',
              background: 'rgba(255,255,255,0.85)',
              color: 'var(--apple-text)',
              backdropFilter: 'saturate(180%) blur(8px)',
              fontVariantNumeric: 'tabular-nums',
            }}
          >
            {assetValue}
          </div>
        )}
      </div>

      <div className="flex gap-3 items-start">
        <div
          className="grid h-9 w-9 shrink-0 place-items-center rounded-full overflow-hidden"
          style={{
            background: '#f5f5f7',
            color: 'var(--apple-text)',
            fontSize: 13,
            fontWeight: 600,
          }}
          aria-hidden
        >
          {initial}
        </div>
        <div className="min-w-0 flex-1">
          <div
            className="font-medium line-clamp-2"
            style={{
              fontFamily: 'var(--apple-font-text)',
              fontSize: 14,
              letterSpacing: 'var(--apple-track-tighter)',
              color: 'var(--apple-text)',
              lineHeight: 1.3,
            }}
          >
            {assetName ?? displayName}
          </div>
          <div
            className="mt-0.5 flex items-center gap-1 truncate"
            style={{
              fontFamily: 'var(--apple-font-text)',
              fontSize: 12,
              color: 'var(--apple-text-secondary)',
            }}
          >
            <span className="truncate">{displayName}</span>
            {coverage === 'anticheat' && <VerifiedDot />}
          </div>
          <div
            className="mt-0.5 truncate"
            style={{
              fontFamily: 'var(--apple-font-text)',
              fontSize: 12,
              color: 'var(--apple-text-tertiary)',
            }}
          >
            {meta}
          </div>
        </div>
      </div>
    </Link>
  )
}
