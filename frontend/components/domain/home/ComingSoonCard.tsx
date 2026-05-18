import { ShineOverlay } from './ShineOverlay'
import { sourceGradient } from './source-hue'

type Props = {
  sourceId: string
  displayName: string
  meta: string
  assetName?: string
}

/**
 * Mirrors AssetCard's outer shell but renders a static, non-clickable card
 * with a teaser sparkline. No Link wrapper, no real data, no /source route.
 * The chart is obviously synthetic — it signals "not live yet" instead of
 * pretending to plot something.
 */
export function ComingSoonCard({
  sourceId,
  displayName,
  meta,
  assetName,
}: Props) {
  return (
    <div
      className="flex flex-col gap-2 text-left select-none"
      aria-disabled="true"
    >
      <div
        className="relative aspect-[16/7] w-full overflow-hidden isolate border"
        style={{
          borderRadius: 'var(--apple-r-md)',
          background: sourceGradient(sourceId),
          borderColor: 'var(--apple-line)',
          opacity: 0.88,
        }}
      >
        <ShineOverlay size={260} intensity={0.18} />

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
          <div className="shrink-0">
            <span
              className="inline-flex items-center rounded-full px-2 py-0.5 font-medium whitespace-nowrap"
              style={{
                background: 'rgba(255,255,255,0.85)',
                color: 'var(--apple-text-secondary)',
                fontSize: 10,
                letterSpacing: '0.04em',
                textTransform: 'uppercase',
                backdropFilter: 'saturate(180%) blur(8px)',
              }}
            >
              Coming soon
            </span>
          </div>
        </div>

        <div className="absolute inset-x-0 bottom-0 h-[55%] overflow-hidden">
          <TeaserSparkline seed={sourceId} />
        </div>
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
    </div>
  )
}

/**
 * Dashed grey sketch of a line. Deterministic per seed so each card has its
 * own silhouette, but every shape reads as a placeholder, not a chart.
 */
function TeaserSparkline({ seed }: { seed: string }) {
  const w = 400
  const h = 120
  const points = synthesize(seed, 9, w, h)
  const d = points
    .map((p, i) => (i === 0 ? `M${p[0]},${p[1]}` : `L${p[0]},${p[1]}`))
    .join(' ')

  return (
    <svg
      viewBox={`0 0 ${w} ${h}`}
      width="100%"
      height="100%"
      preserveAspectRatio="none"
      aria-hidden
    >
      <path
        d={d}
        fill="none"
        stroke="var(--apple-text-tertiary)"
        strokeOpacity={0.55}
        strokeWidth={1.5}
        strokeDasharray="3 4"
        strokeLinecap="round"
        strokeLinejoin="round"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  )
}

function synthesize(
  seed: string,
  count: number,
  width: number,
  height: number,
): Array<[number, number]> {
  let h = 0
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0
  const rand = () => {
    h = (h * 1664525 + 1013904223) >>> 0
    return (h & 0xffff) / 0xffff
  }
  const padY = 18
  const stepX = width / (count - 1)
  const pts: Array<[number, number]> = []
  for (let i = 0; i < count; i++) {
    const x = i * stepX
    const y = padY + rand() * (height - padY * 2)
    pts.push([x, y])
  }
  return pts
}
