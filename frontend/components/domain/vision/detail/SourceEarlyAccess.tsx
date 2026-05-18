import { Sparkline } from '@/components/domain/home/Sparkline'
import { sourceGradient, sourceStroke, sourceFill } from '@/components/domain/home/source-hue'
import { ShineOverlay } from '@/components/domain/home/ShineOverlay'
import {
  type EarlyAccessSource,
  seededSeries,
} from '@/lib/vision/early-access-sources'

/**
 * Rendered in place of SourceDetailV2 for sources we've announced on the
 * homepage but haven't yet wired into the data-node. No 404, no fake data,
 * no "Coming Soon" pill that the user pretended to like — just a brief
 * acknowledgement that the source exists and a way back.
 */
export function SourceEarlyAccess({ source }: { source: EarlyAccessSource }) {
  const series = seededSeries(source.id)

  return (
    <div className="mx-auto w-full max-w-[734px] px-6 py-10 md:py-16">
      <div
        className="relative aspect-[16/7] w-full overflow-hidden isolate border"
        style={{
          borderRadius: 'var(--apple-r-md)',
          background: sourceGradient(source.id),
          borderColor: 'var(--apple-line)',
        }}
      >
        <ShineOverlay size={320} intensity={0.22} />
        <div className="absolute top-4 left-5 right-4 z-10">
          <div
            className="font-semibold truncate"
            style={{
              fontFamily: 'var(--apple-font-display)',
              fontSize: 28,
              letterSpacing: 'var(--apple-track-tight)',
              color: 'var(--apple-text)',
              lineHeight: 1.05,
            }}
          >
            {source.displayName}
          </div>
          <div
            className="mt-1 truncate font-medium"
            style={{
              fontFamily: 'var(--apple-font-text)',
              fontSize: 13,
              color: 'var(--apple-text-secondary)',
              letterSpacing: 'var(--apple-track-tight)',
            }}
          >
            {source.assetName}
          </div>
        </div>
        <div className="absolute inset-x-0 bottom-0 h-[55%] overflow-hidden">
          <Sparkline
            series={series}
            width={400}
            height={120}
            stroke={sourceStroke(source.id)}
            fill={sourceFill(source.id)}
            ariaLabel={`${source.displayName} indicative shape`}
          />
        </div>
      </div>

      <div className="mt-10">
        <h1
          className="font-semibold"
          style={{
            fontFamily: 'var(--apple-font-display)',
            fontSize: 34,
            letterSpacing: 'var(--apple-track-tight)',
            lineHeight: 1.07,
            color: 'var(--apple-text)',
          }}
        >
          {source.displayName} is being wired up.
        </h1>
        <p
          className="mt-3"
          style={{
            fontFamily: 'var(--apple-font-text)',
            fontSize: 17,
            lineHeight: 1.47,
            letterSpacing: 'var(--apple-track-body)',
            color: 'var(--apple-text-secondary)',
          }}
        >
          {source.meta}. Markets open the moment the oracle agrees with itself.
        </p>

        <div className="mt-8 flex items-center gap-3">
          <a
            href="/"
            className="border transition hover:bg-[rgba(0,0,0,0.04)]"
            style={{
              background: 'var(--apple-panel)',
              color: 'var(--apple-text)',
              borderColor: 'var(--apple-line)',
              borderRadius: 'var(--apple-r-pill)',
              padding: '8px 18px',
              fontSize: 14,
              fontWeight: 500,
            }}
          >
            ‹ Back to markets
          </a>
          <a
            href="/explorer"
            className="transition"
            style={{
              color: 'var(--apple-text-secondary)',
              fontSize: 14,
              fontWeight: 500,
              padding: '8px 4px',
            }}
          >
            Browse what's live
          </a>
        </div>
      </div>
    </div>
  )
}
