'use client'

import { cn } from '@/lib/utils/cn'

type SkeletonVariant = 'default' | 'shimmer'

interface SkeletonProps {
  className?: string
  /** Width in pixels or CSS value */
  width?: number | string
  /** Height in pixels or CSS value */
  height?: number | string
  /** Use rounded corners */
  rounded?: boolean
  /**
   * `default` keeps the legacy `.skeleton` class (green tint, 1.8s).
   * `shimmer` paints a flat zinc block with a 1.5s gradient sweep —
   * matches the calendar's hairline aesthetic.
   */
  variant?: SkeletonVariant
}

/**
 * Skeleton component (Story 11-1, AC3)
 * Base component for loading states.
 *
 * - Monospace-width placeholders: layout shift stays at zero.
 * - `variant="shimmer"` rides the `animate-shimmer` keyframe defined in
 *   `tailwind.config.js` (translateX -100% → 150%) for a 1.5s sweep.
 * - `variant="default"` is preserved verbatim for callers that depend
 *   on the legacy red/green pulse.
 */
export function Skeleton({
  className,
  width,
  height,
  rounded = true,
  variant = 'default',
}: SkeletonProps) {
  const style: React.CSSProperties = {}
  if (width !== undefined) {
    style.width = typeof width === 'number' ? `${width}px` : width
  }
  if (height !== undefined) {
    style.height = typeof height === 'number' ? `${height}px` : height
  }

  if (variant === 'shimmer') {
    return (
      <div
        className={cn(
          'relative overflow-hidden bg-zinc-800/60',
          rounded && 'rounded-md',
          className,
        )}
        style={style}
        aria-hidden="true"
      >
        <div
          className="absolute inset-0 -translate-x-full animate-shimmer bg-gradient-to-r from-transparent via-white/10 to-transparent"
          style={{ animationDuration: '1.5s' }}
        />
      </div>
    )
  }

  return (
    <div
      className={cn(
        'skeleton',
        rounded && 'rounded',
        className,
      )}
      style={style}
      aria-hidden="true"
    />
  )
}

/**
 * SkeletonText - A text-shaped skeleton with consistent monospace width
 */
export function SkeletonText({
  chars = 10,
  className,
  variant,
}: {
  chars?: number
  className?: string
  variant?: SkeletonVariant
}) {
  // JetBrains Mono is ~0.6em per character
  const width = `${chars * 0.6}em`

  return (
    <Skeleton
      width={width}
      height="1em"
      variant={variant}
      className={cn('inline-block', className)}
    />
  )
}

/**
 * SkeletonCircle - A circular skeleton for avatars/icons
 */
export function SkeletonCircle({
  size = 40,
  className,
  variant,
}: {
  size?: number
  className?: string
  variant?: SkeletonVariant
}) {
  return (
    <Skeleton
      width={size}
      height={size}
      rounded={false}
      variant={variant}
      className={cn('rounded-full', className)}
    />
  )
}
