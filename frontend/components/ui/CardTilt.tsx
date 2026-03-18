'use client'

import { useRef, useCallback, useEffect } from 'react'

interface CardTiltProps {
  children: React.ReactNode
  /** Diagonal cascade delay index (row + col) */
  delay?: number
  /** Brand background color for glow effect */
  brandColor?: string
}

/**
 * 3D perspective tilt on hover + scroll-cascade entrance.
 * Wraps source cards in the grid to make them feel physical.
 */
export function CardTilt({ children, delay = 0, brandColor }: CardTiltProps) {
  const wrapperRef = useRef<HTMLDivElement>(null)
  const innerRef = useRef<HTMLDivElement>(null)
  const rafRef = useRef(0)
  const timers = useRef<ReturnType<typeof setTimeout>[]>([])
  const reduced = useRef(false)

  useEffect(() => {
    reduced.current = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  }, [])

  // Scroll-cascade fallback for browsers without animation-timeline: view()
  useEffect(() => {
    if (typeof CSS !== 'undefined' && CSS.supports?.('animation-timeline: view()')) return
    const el = wrapperRef.current
    if (!el) return
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          el.classList.add('cascade-revealed')
          io.disconnect()
        }
      },
      { threshold: 0.05 },
    )
    io.observe(el)
    return () => io.disconnect()
  }, [])

  const glow =
    brandColor && !brandColor.startsWith('linear-gradient')
      ? `0 14px 36px -6px color-mix(in srgb, ${brandColor} 40%, transparent), 0 4px 12px color-mix(in srgb, ${brandColor} 20%, transparent)`
      : '0 14px 36px -6px rgba(0,0,0,0.2)'

  const clearTimers = useCallback(() => {
    timers.current.forEach(clearTimeout)
    timers.current = []
  }, [])

  const handleMouseEnter = useCallback(() => {
    if (reduced.current) return
    clearTimers()
    const el = innerRef.current
    if (!el) return
    el.style.transition = 'transform 60ms linear, box-shadow 200ms ease-out'
    el.style.willChange = 'transform, box-shadow'
    el.style.zIndex = '10'
    el.style.position = 'relative'
    el.style.boxShadow = glow
  }, [glow, clearTimers])

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (reduced.current) return
    const el = innerRef.current
    if (!el) return
    cancelAnimationFrame(rafRef.current)
    rafRef.current = requestAnimationFrame(() => {
      const rect = el.getBoundingClientRect()
      const x = (e.clientX - rect.left) / rect.width - 0.5
      const y = (e.clientY - rect.top) / rect.height - 0.5
      el.style.transform = `perspective(800px) rotateX(${(-y * 7).toFixed(2)}deg) rotateY(${(x * 7).toFixed(2)}deg) translateZ(14px) scale(1.025)`
    })
  }, [])

  const handleMouseLeave = useCallback(() => {
    cancelAnimationFrame(rafRef.current)
    clearTimers()
    const el = innerRef.current
    if (!el) return
    el.style.transform = ''
    el.style.boxShadow = ''
    el.style.transition =
      'transform 500ms cubic-bezier(0.25,1,0.5,1), box-shadow 400ms cubic-bezier(0.25,1,0.5,1)'
    timers.current.push(
      setTimeout(() => {
        el.style.zIndex = ''
        el.style.position = ''
      }, 500),
      setTimeout(() => {
        el.style.willChange = ''
      }, 600),
    )
  }, [clearTimers])

  useEffect(
    () => () => {
      cancelAnimationFrame(rafRef.current)
      clearTimers()
    },
    [clearTimers],
  )

  return (
    <div
      ref={wrapperRef}
      className="source-card-cascade"
      style={{ '--d': delay } as React.CSSProperties}
      onMouseEnter={handleMouseEnter}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
    >
      <div ref={innerRef}>{children}</div>
    </div>
  )
}
