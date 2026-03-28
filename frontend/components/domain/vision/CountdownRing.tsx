'use client'

import { useSharedCountdown } from '@/hooks/useSharedCountdown'

interface CountdownRingProps {
  bettingEnd: string | null
  /** Total tick duration in seconds — used to compute progress (0→1) */
  tickDuration: number
  /** Outer diameter in px */
  size?: number
  /** Stroke width in px */
  strokeWidth?: number
}

/**
 * SVG circular countdown. The arc depletes clockwise as time runs out.
 * Color shifts: green → amber → red based on remaining fraction.
 * Respects prefers-reduced-motion (shows static arc).
 */
export function CountdownRing({
  bettingEnd,
  tickDuration,
  size = 48,
  strokeWidth = 3,
}: CountdownRingProps) {
  const remaining = useSharedCountdown(bettingEnd)

  if (!bettingEnd || tickDuration <= 0) return null

  const progress = Math.min(1, Math.max(0, remaining / tickDuration))
  const radius = (size - strokeWidth) / 2
  const circumference = 2 * Math.PI * radius
  const offset = circumference * (1 - progress)
  const urgent = remaining < 60
  const critical = remaining < 30

  // Color by urgency: green (>50%) → amber (10-50%) → red (<10%)
  const strokeColor = critical
    ? 'var(--color-down, #DC2626)'
    : urgent
      ? 'var(--color-warning, #D97706)'
      : 'var(--color-up, #16A34A)'

  const trackColor = critical
    ? 'rgba(220,38,38,0.1)'
    : urgent
      ? 'rgba(217,119,6,0.1)'
      : 'rgba(22,163,74,0.08)'

  const m = Math.floor(remaining / 60)
  const s = remaining % 60

  if (remaining <= 0) return null

  return (
    <div className="relative inline-flex items-center justify-center" style={{ width: size, height: size }}>
      <svg
        width={size}
        height={size}
        className="motion-safe:transition-all motion-safe:duration-1000 motion-safe:ease-linear"
        style={{ transform: 'rotate(-90deg)' }}
      >
        {/* Track */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={trackColor}
          strokeWidth={strokeWidth}
        />
        {/* Progress arc */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={strokeColor}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          className="motion-safe:transition-all motion-safe:duration-1000 motion-safe:ease-linear"
        />
      </svg>
      {/* Timer text inside the ring */}
      <span className={`absolute font-mono font-black tabular-nums tracking-tight leading-none ${
        size >= 48 ? 'text-[13px]' : 'text-[10px]'
      }`} style={{ color: strokeColor }}>
        {m}:{s.toString().padStart(2, '0')}
      </span>
    </div>
  )
}

interface ProgressBarProps {
  bettingEnd: string | null
  tickDuration: number
  isSettling: boolean
}

/**
 * Thin horizontal bar that depletes left-to-right over the betting period.
 * When settling, becomes a pulsing amber bar.
 */
export function BatchProgressBar({ bettingEnd, tickDuration, isSettling }: ProgressBarProps) {
  const remaining = useSharedCountdown(bettingEnd)

  if (isSettling) {
    return (
      <div className="h-[2px] w-full overflow-hidden">
        <div className="h-full w-full bg-color-warning/60 animate-pulse" />
      </div>
    )
  }

  if (!bettingEnd || tickDuration <= 0) {
    return <div className="h-[2px] w-full bg-border-light" />
  }

  const progress = Math.min(1, Math.max(0, remaining / tickDuration))
  const urgent = remaining < 60
  const critical = remaining < 30

  const barColor = critical
    ? 'bg-color-down'
    : urgent
      ? 'bg-color-warning'
      : 'bg-color-up'

  return (
    <div className="h-[2px] w-full bg-border-light/50 overflow-hidden">
      <div
        className={`h-full ${barColor} motion-safe:transition-all motion-safe:duration-1000 motion-safe:ease-linear`}
        style={{ width: `${progress * 100}%` }}
      />
    </div>
  )
}
