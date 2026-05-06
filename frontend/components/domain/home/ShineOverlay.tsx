'use client'

import { useEffect, useRef } from 'react'

interface ShineOverlayProps {
  /** 0–1 strength of the highlight. Default 0.18. */
  intensity?: number
  /** Radial gradient diameter in px. Default 220. */
  size?: number
  /** RGB triplet as a string, e.g. "255, 255, 255". */
  color?: string
  /** Override the default zIndex if the parent stacks differently. */
  zIndex?: number
  className?: string
}

/**
 * Pointer-tracked radial highlight — Apple icon-shine pattern.
 * Drop inside any `position: relative` parent. Uses rAF-throttled
 * mousemove on the parent and a CSS variable for the gradient
 * center. Pointer-events: none so it never blocks clicks.
 */
export function ShineOverlay({
  intensity = 0.18,
  size = 220,
  color = '255, 255, 255',
  zIndex = 5,
  className,
}: ShineOverlayProps) {
  const ref = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    const el = ref.current
    const parent = el?.parentElement
    if (!el || !parent) return

    let raf = 0
    let pendingX = 0
    let pendingY = 0

    const apply = () => {
      el.style.setProperty('--shine-mx', `${pendingX}px`)
      el.style.setProperty('--shine-my', `${pendingY}px`)
      raf = 0
    }

    const onMove = (e: MouseEvent) => {
      const rect = parent.getBoundingClientRect()
      pendingX = e.clientX - rect.left
      pendingY = e.clientY - rect.top
      if (!raf) raf = requestAnimationFrame(apply)
    }

    const onEnter = () => el.style.setProperty('--shine-opacity', '1')
    const onLeave = () => el.style.setProperty('--shine-opacity', '0')

    parent.addEventListener('mousemove', onMove)
    parent.addEventListener('mouseenter', onEnter)
    parent.addEventListener('mouseleave', onLeave)

    return () => {
      parent.removeEventListener('mousemove', onMove)
      parent.removeEventListener('mouseenter', onEnter)
      parent.removeEventListener('mouseleave', onLeave)
      if (raf) cancelAnimationFrame(raf)
    }
  }, [])

  return (
    <div
      ref={ref}
      aria-hidden
      className={className}
      style={{
        position: 'absolute',
        inset: 0,
        pointerEvents: 'none',
        opacity: 'var(--shine-opacity, 0)',
        transition: 'opacity 280ms cubic-bezier(0.32, 0.72, 0, 1)',
        background: `radial-gradient(${size}px circle at var(--shine-mx, 50%) var(--shine-my, 50%), rgba(${color}, ${intensity}), transparent 70%)`,
        mixBlendMode: 'overlay',
        zIndex,
      }}
    />
  )
}
