import Image from 'next/image'

/**
 * GeneralLoader — the only loader the app should show at page boundaries.
 * Logo, wordmark, a thin ring rotating around the mark. No skeleton stacks.
 * No prophecies. A moment is a moment.
 */

interface GeneralLoaderProps {
  /** Container min-height. Defaults to 60vh for full-page boundaries. */
  height?: string | number
  /** Optional sub-line. Render only if it earns its place. */
  caption?: string
}

const RING_DIAMETER = 48
const LOGO_SIZE = 32
const STROKE = 1.75
const RADIUS = (RING_DIAMETER - STROKE) / 2
const CIRC = 2 * Math.PI * RADIUS

export function GeneralLoader({ height = '60vh', caption }: GeneralLoaderProps) {
  return (
    <div
      role="status"
      aria-label="Loading"
      style={{
        minHeight: typeof height === 'number' ? `${height}px` : height,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 12,
        background: 'transparent',
      }}
    >
      <GeneralLoaderInline />
      {caption ? (
        <p
          style={{
            fontFamily: 'var(--apple-font-text)',
            fontSize: 12,
            color: 'var(--apple-text-tertiary)',
            margin: 0,
            letterSpacing: 'var(--apple-track-mid)',
          }}
        >
          {caption}
        </p>
      ) : null}
      <span
        style={{
          position: 'absolute',
          width: 1,
          height: 1,
          padding: 0,
          margin: -1,
          overflow: 'hidden',
          clip: 'rect(0,0,0,0)',
          whiteSpace: 'nowrap',
          border: 0,
        }}
      >
        Loading General
      </span>
      <GeneralLoaderStyles />
    </div>
  )
}

/**
 * Smaller inline variant — logo, ring, wordmark. Drop into a section that
 * already has its own framing. No min-height.
 */
export function GeneralLoaderInline() {
  return (
    <div
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 12,
      }}
    >
      <div
        style={{
          position: 'relative',
          width: RING_DIAMETER,
          height: RING_DIAMETER,
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
        }}
      >
        <svg
          width={RING_DIAMETER}
          height={RING_DIAMETER}
          viewBox={`0 0 ${RING_DIAMETER} ${RING_DIAMETER}`}
          aria-hidden="true"
          className="general-loader-ring"
          style={{ position: 'absolute', inset: 0 }}
        >
          <circle
            cx={RING_DIAMETER / 2}
            cy={RING_DIAMETER / 2}
            r={RADIUS}
            fill="none"
            stroke="var(--apple-text)"
            strokeOpacity={0.12}
            strokeWidth={STROKE}
          />
          <circle
            cx={RING_DIAMETER / 2}
            cy={RING_DIAMETER / 2}
            r={RADIUS}
            fill="none"
            stroke="var(--apple-text)"
            strokeWidth={STROKE}
            strokeLinecap="round"
            strokeDasharray={`${CIRC * 0.28} ${CIRC * 0.72}`}
          />
        </svg>
        <Image
          src="/logo.svg"
          alt=""
          width={LOGO_SIZE}
          height={LOGO_SIZE}
          style={{ borderRadius: 7, display: 'block' }}
          priority
        />
      </div>
      <span
        style={{
          fontFamily: 'var(--apple-font-display)',
          fontWeight: 600,
          fontSize: 20,
          letterSpacing: 'var(--apple-track-tight)',
          color: 'var(--apple-text)',
          lineHeight: 1,
        }}
      >
        General
      </span>
    </div>
  )
}

function GeneralLoaderStyles() {
  return (
    <style>{`
      @keyframes general-loader-spin {
        from { transform: rotate(0deg); }
        to { transform: rotate(360deg); }
      }
      .general-loader-ring {
        animation: general-loader-spin 1.3s linear infinite;
        transform-origin: 50% 50%;
      }
      @media (prefers-reduced-motion: reduce) {
        .general-loader-ring {
          animation-duration: 4s;
        }
      }
    `}</style>
  )
}

export default GeneralLoader
