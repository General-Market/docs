'use client'

import { cn } from '@/lib/utils/cn'

interface SkeletonProps {
  className?: string
  /** Width in pixels or CSS value */
  width?: number | string
  /** Height in pixels or CSS value */
  height?: number | string
  /** Use rounded corners */
  rounded?: boolean
}

/**
 * Skeleton component (Story 11-1, AC3)
 * Base component for loading states with red pulse animation
 *
 * - Uses monospace-width placeholders for consistent layout
 * - No content layout shift when data loads (CLS = 0)
 * - Red pulse animation matching brand colors
 * - Respects prefers-reduced-motion
 */
export function Skeleton({
  className,
  width,
  height,
  rounded = true
}: SkeletonProps) {
  const style: React.CSSProperties = {}
  if (width !== undefined) {
    style.width = typeof width === 'number' ? `${width}px` : width
  }
  if (height !== undefined) {
    style.height = typeof height === 'number' ? `${height}px` : height
  }

  return (
    <div
      className={cn(
        'skeleton',
        rounded && 'rounded',
        className
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
  className
}: {
  chars?: number
  className?: string
}) {
  // JetBrains Mono is ~0.6em per character
  const width = `${chars * 0.6}em`

  return (
    <Skeleton
      width={width}
      height="1em"
      className={cn('inline-block', className)}
    />
  )
}

/**
 * SkeletonCircle - A circular skeleton for avatars/icons
 */
export function SkeletonCircle({
  size = 40,
  className
}: {
  size?: number
  className?: string
}) {
  return (
    <Skeleton
      width={size}
      height={size}
      rounded={false}
      className={cn('rounded-full', className)}
    />
  )
}
